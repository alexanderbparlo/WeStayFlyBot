// app/api/subscribe/route.ts
// POST /api/subscribe
// Accepts the form payload from the landing page, creates/updates the subscriber,
// stores origin airports + destinations, and fires the welcome email.
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import {
  createSubscriber,
  setOriginAirports,
  setDestinations,
} from '@/lib/db';
import { sendWelcomeEmail } from '@/lib/email';

// ─── VALIDATION ──────────────────────────────────────────────────────────────

interface SubscribePayload {
  email: string;
  originAirports: { code: string; city: string }[];
  flightDestinations: { code: string; city: string }[];
  roadDestinations: string[]; // plain city strings
  airlines: string[];
  minHotelStars: number;
}

function validatePayload(body: unknown): { valid: true; data: SubscribePayload } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') return { valid: false, error: 'Invalid request body' };
  const b = body as Record<string, unknown>;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (typeof b.email !== 'string' || !emailRegex.test(b.email)) {
    return { valid: false, error: 'Valid email is required' };
  }

  if (!Array.isArray(b.originAirports) || b.originAirports.length === 0) {
    return { valid: false, error: 'At least one origin airport is required' };
  }

  const hasFlightDest = Array.isArray(b.flightDestinations) && b.flightDestinations.length > 0;
  const hasRoadDest = Array.isArray(b.roadDestinations) && b.roadDestinations.length > 0;
  if (!hasFlightDest && !hasRoadDest) {
    return { valid: false, error: 'At least one destination is required' };
  }

  if (typeof b.minHotelStars !== 'number' || b.minHotelStars < 1 || b.minHotelStars > 5) {
    return { valid: false, error: 'minHotelStars must be between 1 and 5' };
  }

  if (!Array.isArray(b.airlines) || b.airlines.length === 0) {
    return { valid: false, error: 'Airlines selection is required' };
  }

  return {
    valid: true,
    data: {
      email: b.email.toLowerCase().trim(),
      originAirports: b.originAirports as SubscribePayload['originAirports'],
      flightDestinations: (b.flightDestinations as SubscribePayload['flightDestinations']) ?? [],
      roadDestinations: (b.roadDestinations as string[]) ?? [],
      airlines: b.airlines as string[],
      minHotelStars: b.minHotelStars,
    }
  };
}

// ─── HANDLER ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const validation = validatePayload(body);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { email, originAirports, flightDestinations, roadDestinations, airlines, minHotelStars } = validation.data;

    // 1. Upsert subscriber
    const subscriber = await createSubscriber(email, airlines, minHotelStars);

    // 2. Set origin airports (replaces any existing)
    await setOriginAirports(
      subscriber.id,
      originAirports.map(a => ({ iata_code: a.code, city: a.city }))
    );

    // 3. Set destinations (replaces any existing)
    const allDestinations = [
      ...flightDestinations.map(d => ({
        dest_type: 'flight' as const,
        iata_code: d.code,
        city_name: d.city,
      })),
      ...roadDestinations.map(city => ({
        dest_type: 'roadtrip' as const,
        iata_code: null,
        city_name: city,
      })),
    ];
    await setDestinations(subscriber.id, allDestinations);

    // 4. Send welcome email (non-blocking — a Resend failure should not prevent subscription)
    sendWelcomeEmail({
      email,
      subscriberToken: subscriber.unsubscribe_token,
      originAirports,
      flightDestinations,
      roadDestinations,
      airlines,
      minHotelStars,
    }).catch(err => console.error('[subscribe] Welcome email failed:', err));

    return NextResponse.json({ success: true, subscriberId: subscriber.id }, { status: 201 });

  } catch (err) {
    console.error('[subscribe] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
