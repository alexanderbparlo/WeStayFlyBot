// app/api/preferences/route.ts
// GET /api/preferences?token=<unsubscribe_token>
// Called by the manage preferences page on load to pre-populate the form.
// Returns the subscriber's current settings without exposing sensitive DB ids.
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getRawSql, getOriginAirports, getDestinations } from '@/lib/db';
import { checkRateLimit, getRequestIp } from '@/lib/rate-limit';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Rate limiting: 10 preference fetches per IP per 15 min
  const ip = getRequestIp(req);
  const rl = await checkRateLimit(`${ip}:preferences`, 10);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': String(rl.retryAfterSeconds) },
      }
    );
  }

  const token = req.nextUrl.searchParams.get('token');

  if (!token || !UUID_RE.test(token)) {
    return NextResponse.json({ error: 'Missing or invalid token' }, { status: 400 });
  }

  try {
    const sql = getRawSql();
    const subRows = await sql`
      SELECT id, email, airlines, min_hotel_stars
      FROM subscribers
      WHERE unsubscribe_token = ${token} AND is_active = TRUE
      LIMIT 1
    `;

    if (!subRows.length) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 404 });
    }

    const sub = subRows[0];

    const origins = await getOriginAirports(sub.id);
    const destinations = await getDestinations(sub.id);

    const flightDests = destinations
      .filter(d => d.dest_type === 'flight')
      .map(d => ({ code: d.iata_code, city: d.city_name }));

    const roadDests = destinations
      .filter(d => d.dest_type === 'roadtrip')
      .map(d => d.city_name);

    return NextResponse.json({
      email: sub.email,
      originAirports: origins.map(a => ({ code: a.iata_code, city: a.city })),
      flightDestinations: flightDests,
      roadDestinations: roadDests,
      airlines: sub.airlines,
      minHotelStars: sub.min_hotel_stars,
    });

  } catch (err) {
    console.error('[preferences] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
