// app/api/preferences/route.ts
// GET /api/preferences?token=<unsubscribe_token>
// Called by the manage preferences page on load to pre-populate the form.
// Returns the subscriber's current settings without exposing sensitive DB ids.
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getRawSql, getOriginAirports, getDestinations } from '@/lib/db';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const token = req.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  try {
    // Look up subscriber by token
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

    // Fetch airports and destinations
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
