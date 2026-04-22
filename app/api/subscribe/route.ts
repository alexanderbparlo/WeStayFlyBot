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
import { checkRateLimit, getRequestIp } from '@/lib/rate-limit';

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const BODY_SIZE_LIMIT = 10_000; // bytes
const IATA_RE = /^[A-Z]{3}$/;
const XSS_RE = /<|>|javascript:|data:/i;

// ─── VALIDATION ──────────────────────────────────────────────────────────────

interface SubscribePayload {
  email: string;
  originAirports: { code: string; city: string }[];
  flightDestinations: { code: string; city: string }[];
  roadDestinations: string[];
  airlines: string[];
  minHotelStars: number;
}

function safeCity(val: unknown, field: string): string | null {
  if (typeof val !== 'string') return null;
  if (val.length > 100) return null;
  if (XSS_RE.test(val)) return null;
  return val.trim();
}

function validatePayload(body: unknown): { valid: true; data: SubscribePayload } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') return { valid: false, error: 'Invalid request body' };
  const b = body as Record<string, unknown>;

  // Email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (typeof b.email !== 'string' || b.email.length > 254 || !emailRegex.test(b.email)) {
    return { valid: false, error: 'Valid email is required' };
  }

  // Origin airports
  if (!Array.isArray(b.originAirports) || b.originAirports.length === 0) {
    return { valid: false, error: 'At least one origin airport is required' };
  }
  if (b.originAirports.length > 10) {
    return { valid: false, error: 'Maximum 10 origin airports allowed' };
  }
  for (const a of b.originAirports) {
    if (!a || typeof a !== 'object') return { valid: false, error: 'Invalid origin airport entry' };
    const ap = a as Record<string, unknown>;
    if (typeof ap.code !== 'string' || !IATA_RE.test(ap.code)) {
      return { valid: false, error: `Invalid IATA code: ${ap.code}` };
    }
    if (!safeCity(ap.city, 'origin city')) {
      return { valid: false, error: 'Invalid origin city name' };
    }
  }

  // Destinations
  const hasFlightDest = Array.isArray(b.flightDestinations) && b.flightDestinations.length > 0;
  const hasRoadDest = Array.isArray(b.roadDestinations) && b.roadDestinations.length > 0;
  if (!hasFlightDest && !hasRoadDest) {
    return { valid: false, error: 'At least one destination is required' };
  }

  if (Array.isArray(b.flightDestinations)) {
    if (b.flightDestinations.length > 20) {
      return { valid: false, error: 'Maximum 20 flight destinations allowed' };
    }
    for (const d of b.flightDestinations) {
      if (!d || typeof d !== 'object') return { valid: false, error: 'Invalid flight destination entry' };
      const fd = d as Record<string, unknown>;
      if (typeof fd.code !== 'string' || !IATA_RE.test(fd.code)) {
        return { valid: false, error: `Invalid destination IATA code: ${fd.code}` };
      }
      if (!safeCity(fd.city, 'destination city')) {
        return { valid: false, error: 'Invalid destination city name' };
      }
    }
  }

  if (Array.isArray(b.roadDestinations)) {
    if (b.roadDestinations.length > 50) {
      return { valid: false, error: 'Maximum 50 road trip destinations allowed' };
    }
    for (const city of b.roadDestinations) {
      if (!safeCity(city, 'road destination')) {
        return { valid: false, error: 'Invalid road trip destination name' };
      }
    }
  }

  // Hotel stars — must be an integer 1–5
  if (
    typeof b.minHotelStars !== 'number' ||
    !Number.isInteger(b.minHotelStars) ||
    b.minHotelStars < 1 ||
    b.minHotelStars > 5
  ) {
    return { valid: false, error: 'minHotelStars must be an integer between 1 and 5' };
  }

  // Airlines
  if (!Array.isArray(b.airlines) || b.airlines.length === 0) {
    return { valid: false, error: 'Airlines selection is required' };
  }
  if (b.airlines.length > 12) {
    return { valid: false, error: 'Maximum 12 airlines allowed' };
  }
  for (const airline of b.airlines) {
    if (typeof airline !== 'string' || airline.length > 100 || XSS_RE.test(airline)) {
      return { valid: false, error: 'Invalid airline value' };
    }
  }

  return {
    valid: true,
    data: {
      email: (b.email as string).toLowerCase().trim(),
      originAirports: b.originAirports as SubscribePayload['originAirports'],
      flightDestinations: (b.flightDestinations as SubscribePayload['flightDestinations']) ?? [],
      roadDestinations: (b.roadDestinations as string[]) ?? [],
      airlines: b.airlines as string[],
      minHotelStars: b.minHotelStars as number,
    }
  };
}

// ─── HANDLER ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Rate limiting: 5 subscribe attempts per IP per 15 min
  const ip = getRequestIp(req);
  const rl = await checkRateLimit(`${ip}:subscribe`, 5);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': String(rl.retryAfterSeconds) },
      }
    );
  }

  // Body size guard
  const contentLength = Number(req.headers.get('content-length') ?? 0);
  if (contentLength > BODY_SIZE_LIMIT) {
    return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
  }

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
