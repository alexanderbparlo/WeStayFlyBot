// app/api/update-preferences/route.ts
// POST /api/update-preferences
// Allows a subscriber to update their airports, destinations, airlines,
// and hotel star rating via the landing page "manage subscription" flow.
// Authenticated via the unsubscribe_token (sent in every email footer link).
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  updateSubscriberPreferences,
  setOriginAirports,
  setDestinations,
  getRawSql,
} from '@/lib/db';
import { checkRateLimit, getRequestIp } from '@/lib/rate-limit';

const BODY_SIZE_LIMIT = 10_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IATA_RE = /^[A-Z]{3}$/;
const XSS_RE = /<|>|javascript:|data:/i;

function safeCity(val: unknown): string | null {
  if (typeof val !== 'string') return null;
  if (val.length > 100) return null;
  if (XSS_RE.test(val)) return null;
  return val.trim();
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Rate limiting: 5 preference updates per IP per 15 min
  const ip = getRequestIp(req);
  const rl = await checkRateLimit(`${ip}:update-preferences`, 5);
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
    const { token, originAirports, flightDestinations, roadDestinations, airlines, minHotelStars } = body;

    if (!token || !UUID_RE.test(String(token))) {
      return NextResponse.json({ error: 'Missing or invalid token' }, { status: 400 });
    }

    // Validate originAirports if provided
    if (originAirports !== undefined) {
      if (!Array.isArray(originAirports) || originAirports.length === 0 || originAirports.length > 10) {
        return NextResponse.json({ error: 'originAirports must be an array of 1–10 items' }, { status: 400 });
      }
      for (const a of originAirports) {
        if (!a || typeof a !== 'object') return NextResponse.json({ error: 'Invalid origin airport entry' }, { status: 400 });
        const ap = a as Record<string, unknown>;
        if (typeof ap.code !== 'string' || !IATA_RE.test(ap.code)) {
          return NextResponse.json({ error: `Invalid IATA code: ${ap.code}` }, { status: 400 });
        }
        if (!safeCity(ap.city)) {
          return NextResponse.json({ error: 'Invalid origin city name' }, { status: 400 });
        }
      }
    }

    // Validate flightDestinations if provided
    if (flightDestinations !== undefined) {
      if (!Array.isArray(flightDestinations) || flightDestinations.length > 20) {
        return NextResponse.json({ error: 'flightDestinations must be an array of at most 20 items' }, { status: 400 });
      }
      for (const d of flightDestinations) {
        if (!d || typeof d !== 'object') return NextResponse.json({ error: 'Invalid flight destination entry' }, { status: 400 });
        const fd = d as Record<string, unknown>;
        if (typeof fd.code !== 'string' || !IATA_RE.test(fd.code)) {
          return NextResponse.json({ error: `Invalid destination IATA code: ${fd.code}` }, { status: 400 });
        }
        if (!safeCity(fd.city)) {
          return NextResponse.json({ error: 'Invalid destination city name' }, { status: 400 });
        }
      }
    }

    // Validate roadDestinations if provided
    if (roadDestinations !== undefined) {
      if (!Array.isArray(roadDestinations) || roadDestinations.length > 50) {
        return NextResponse.json({ error: 'roadDestinations must be an array of at most 50 items' }, { status: 400 });
      }
      for (const city of roadDestinations) {
        if (!safeCity(city)) {
          return NextResponse.json({ error: 'Invalid road trip destination name' }, { status: 400 });
        }
      }
    }

    // Validate airlines if provided
    if (airlines !== undefined) {
      if (!Array.isArray(airlines) || airlines.length === 0 || airlines.length > 12) {
        return NextResponse.json({ error: 'airlines must be an array of 1–12 items' }, { status: 400 });
      }
      for (const airline of airlines) {
        if (typeof airline !== 'string' || airline.length > 100 || XSS_RE.test(airline)) {
          return NextResponse.json({ error: 'Invalid airline value' }, { status: 400 });
        }
      }
    }

    // Validate minHotelStars if provided
    if (minHotelStars !== undefined) {
      if (
        typeof minHotelStars !== 'number' ||
        !Number.isInteger(minHotelStars) ||
        minHotelStars < 1 ||
        minHotelStars > 5
      ) {
        return NextResponse.json({ error: 'minHotelStars must be an integer between 1 and 5' }, { status: 400 });
      }
    }

    // Look up subscriber by token
    const sql = getRawSql();
    const subRows = await sql`
      SELECT id FROM subscribers
      WHERE unsubscribe_token = ${token} AND is_active = TRUE
    `;
    if (!subRows.length) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 404 });
    }
    const subscriberId = subRows[0].id as string;

    // Update scalar preferences
    if (airlines || minHotelStars) {
      await updateSubscriberPreferences(token, airlines ?? ['Any airline'], minHotelStars ?? 3);
    }

    // Replace origin airports if provided
    if (Array.isArray(originAirports) && originAirports.length > 0) {
      await setOriginAirports(
        subscriberId,
        originAirports.map((a: { code: string; city: string }) => ({ iata_code: a.code, city: a.city }))
      );
    }

    // Replace destinations if provided
    const allDestinations = [
      ...(flightDestinations ?? []).map((d: { code: string; city: string }) => ({
        dest_type: 'flight' as const,
        iata_code: d.code,
        city_name: d.city,
      })),
      ...(roadDestinations ?? []).map((city: string) => ({
        dest_type: 'roadtrip' as const,
        iata_code: null,
        city_name: city,
      })),
    ];
    if (allDestinations.length > 0) {
      await setDestinations(subscriberId, allDestinations);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[update-preferences] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
