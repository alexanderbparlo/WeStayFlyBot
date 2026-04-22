// app/api/cron/scan-deals/route.ts
// GET /api/cron/scan-deals
// Called by Vercel Cron on schedule (8:00 AM and 8:00 PM ET).
// Protected by CRON_SECRET to prevent unauthorized triggers.
// Iterates all active subscribers, scans their routes, evaluates deals, sends alerts.
export const dynamic = 'force-dynamic';

import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  getAllActiveSubscribers,
  getOriginAirports,
  getDestinations,
} from '@/lib/db';
import { scanFlightsForRoute } from '@/lib/flight-scanner';
import { scanHotelsForDestination } from '@/lib/hotel-scanner';
import { evaluateFlightDestination, evaluateRoadtripDestination, EvaluatedDeal } from '@/lib/deal-evaluator';
import { processDealsForSubscriber } from '@/lib/deal-evaluator';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

// Leave ~10s of buffer before Vercel's function limit (60s on Pro).
const MAX_RUNTIME_MS = parseInt(process.env.CRON_MAX_RUNTIME_MS ?? '50000', 10);

// ─── AUTH ─────────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret || !authHeader) return false;
  try {
    // Constant-time comparison to prevent timing-based secret enumeration.
    const expected = Buffer.from(`Bearer ${secret}`);
    const received = Buffer.from(authHeader);
    if (expected.length !== received.length) return false;
    return timingSafeEqual(expected, received);
  } catch {
    return false;
  }
}

// ─── HANDLER ─────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  console.log(`[scan-deals] Starting scan at ${new Date().toISOString()}`);

  let totalSent = 0;
  let totalSkipped = 0;
  let errorCount = 0;
  let processedCount = 0;
  let timedOut = false;

  try {
    const subscribers = await getAllActiveSubscribers();
    console.log(`[scan-deals] Found ${subscribers.length} active subscriber(s)`);

    for (const subscriber of subscribers) {
      // Timeout guard: stop before Vercel kills the function mid-subscriber.
      if (Date.now() - startTime > MAX_RUNTIME_MS) {
        timedOut = true;
        console.warn(
          `[scan-deals] Timeout guard triggered after ${processedCount}/${subscribers.length} subscribers`
        );
        break;
      }

      console.log(`[scan-deals] Processing subscriber ${processedCount + 1}/${subscribers.length}`);

      try {
        const origins = await getOriginAirports(subscriber.id);
        const destinations = await getDestinations(subscriber.id);

        const flightDests = destinations.filter(d => d.dest_type === 'flight');
        const roadDests = destinations.filter(d => d.dest_type === 'roadtrip');

        const allDeals: EvaluatedDeal[] = [];

        // ── Scan flight destinations ─────────────────────────────────────────
        for (const dest of flightDests) {
          const hotelDeals = await scanHotelsForDestination({
            destCity: dest.city_name,
            destIata: dest.iata_code,
            minStars: subscriber.min_hotel_stars,
          });

          for (const origin of origins) {
            const { deals: flightDeals, comboEligible } = await scanFlightsForRoute({
              originIata: origin.iata_code,
              destIata: dest.iata_code!,
              destCity: dest.city_name,
              preferredAirlines: subscriber.airlines,
            });

            const evaluated = evaluateFlightDestination({
              flightDeals,
              comboEligibleFlights: comboEligible,
              hotelDeals,
              destCity: dest.city_name,
              destIata: dest.iata_code!,
            });

            allDeals.push(...evaluated);
          }
        }

        // ── Scan road trip destinations ───────────────────────────────────────
        for (const dest of roadDests) {
          const hotelDeals = await scanHotelsForDestination({
            destCity: dest.city_name,
            destIata: null,
            minStars: subscriber.min_hotel_stars,
          });

          const evaluated = evaluateRoadtripDestination({
            hotelDeals,
            destCity: dest.city_name,
          });

          allDeals.push(...evaluated);
        }

        console.log(`[scan-deals] Subscriber ${processedCount + 1}: ${allDeals.length} deal(s) found`);

        // ── Dedup + send ──────────────────────────────────────────────────────
        const { sent, skipped } = await processDealsForSubscriber({
          subscriberId: subscriber.id,
          email: subscriber.email,
          subscriberToken: subscriber.unsubscribe_token,
          deals: allDeals,
        });

        totalSent += sent;
        totalSkipped += skipped;
        console.log(`[scan-deals] Subscriber ${processedCount + 1}: sent=${sent}, skipped=${skipped}`);

      } catch (subErr) {
        console.error(`[scan-deals] Error for subscriber ${processedCount + 1}:`, subErr);
        errorCount++;
      }

      processedCount++;
    }

  } catch (err) {
    console.error('[scan-deals] Fatal error:', err);
    return NextResponse.json({ error: 'Fatal scan error', detail: String(err) }, { status: 500 });
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[scan-deals] Completed in ${elapsed}s`);

  return NextResponse.json({
    success: true,
    elapsed: `${elapsed}s`,
    processed: processedCount,
    totalSent,
    totalSkipped,
    errors: errorCount,
    ...(timedOut && { warning: 'Timeout guard triggered — not all subscribers were processed.' }),
  });
}
