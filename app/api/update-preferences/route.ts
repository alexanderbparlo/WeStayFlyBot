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

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { token, originAirports, flightDestinations, roadDestinations, airlines, minHotelStars } = body;

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
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
