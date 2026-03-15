// app/api/cron/scan-deals/route.ts
// GET /api/cron/scan-deals
// Called by Vercel Cron on schedule (8:00 AM and 8:00 PM ET).
// Protected by CRON_SECRET to prevent unauthorized triggers.
// Iterates all active subscribers, scans their routes, evaluates deals, sends alerts.

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

// ─── AUTH ─────────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return authHeader === `Bearer ${secret}`;
}

// ─── HANDLER ─────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  console.log(`[scan-deals] Starting scan at ${new Date().toISOString()}`);

  const runLog: {
    subscriberId: string;
    email: string;
    dealsSent: number;
    dealsSkipped: number;
    error?: string;
  }[] = [];

  try {
    const subscribers = await getAllActiveSubscribers();
    console.log(`[scan-deals] Found ${subscribers.length} active subscriber(s)`);

    for (const subscriber of subscribers) {
      console.log(`[scan-deals] Processing ${subscriber.email}`);

      try {
        // Fetch subscriber's origins and destinations
        const origins = await getOriginAirports(subscriber.id);
        const destinations = await getDestinations(subscriber.id);

        const flightDests = destinations.filter(d => d.dest_type === 'flight');
        const roadDests = destinations.filter(d => d.dest_type === 'roadtrip');

        const allDeals: EvaluatedDeal[] = [];

        // ── Scan flight destinations ─────────────────────────────────────────
        for (const dest of flightDests) {
          // Hotel scan for this destination (shared across all origin airports)
          const hotelDeals = await scanHotelsForDestination({
            destCity: dest.city_name,
            destIata: dest.iata_code,
            minStars: subscriber.min_hotel_stars,
          });

          // Flight scan per origin airport
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

        console.log(`[scan-deals] ${subscriber.email}: ${allDeals.length} deal(s) found`);

        // ── Dedup + send ──────────────────────────────────────────────────────
        const { sent, skipped } = await processDealsForSubscriber({
          subscriberId: subscriber.id,
          email: subscriber.email,
          subscriberToken: subscriber.unsubscribe_token,
          deals: allDeals,
        });

        runLog.push({
          subscriberId: subscriber.id,
          email: subscriber.email,
          dealsSent: sent,
          dealsSkipped: skipped,
        });

        console.log(`[scan-deals] ${subscriber.email}: sent=${sent}, skipped=${skipped}`);

      } catch (subErr) {
        console.error(`[scan-deals] Error for subscriber ${subscriber.email}:`, subErr);
        runLog.push({
          subscriberId: subscriber.id,
          email: subscriber.email,
          dealsSent: 0,
          dealsSkipped: 0,
          error: String(subErr),
        });
      }
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
    subscribers: runLog.length,
    totalSent: runLog.reduce((s, r) => s + r.dealsSent, 0),
    log: runLog,
  });
}
