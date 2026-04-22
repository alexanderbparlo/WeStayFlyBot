// lib/db.ts
// Neon Postgres client.
// getSql() is called inside each function rather than at module level,
// so the DATABASE_URL is only read at request time — never during next build.

import { neon } from '@neondatabase/serverless';

function getSql() {
  // Vercel Postgres auto-injects POSTGRES_URL; DATABASE_URL is the manual/Neon name.
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url) throw new Error('No database URL configured (DATABASE_URL or POSTGRES_URL)');
  return neon(url);
}

// ─── TYPE DEFINITIONS ────────────────────────────────────────────────────────

export interface Subscriber {
  id: string;
  email: string;
  is_active: boolean;
  min_hotel_stars: number;
  airlines: string[];
  created_at: string;
  updated_at: string;
  unsubscribe_token: string;
}

export interface OriginAirport {
  id: string;
  subscriber_id: string;
  iata_code: string;
  city: string;
}

export interface Destination {
  id: string;
  subscriber_id: string;
  dest_type: 'flight' | 'roadtrip';
  iata_code: string | null;
  city_name: string;
}

export interface DealSent {
  id: string;
  subscriber_id: string;
  deal_key: string;
  deal_type: 'flight' | 'hotel' | 'bundle' | 'combo' | 'roadtrip_hotel';
  origin_iata: string | null;
  dest_iata: string | null;
  dest_city: string | null;
  depart_date: string | null;
  return_date: string | null;
  flight_price: number | null;
  hotel_price: number | null;
  sent_at: string;
}

export interface PriceBaselineCache {
  id: string;
  cache_key: string;
  baseline_low: number;
  baseline_high: number;
  baseline_source: string;
  fetched_at: string;
}

// ─── SUBSCRIBER QUERIES ──────────────────────────────────────────────────────

export async function createSubscriber(
  email: string,
  airlines: string[],
  minHotelStars: number
): Promise<Subscriber> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO subscribers (email, airlines, min_hotel_stars)
    VALUES (${email}, ${airlines}, ${minHotelStars})
    ON CONFLICT (email) DO UPDATE
      SET airlines = EXCLUDED.airlines,
          min_hotel_stars = EXCLUDED.min_hotel_stars,
          is_active = TRUE,
          updated_at = NOW()
    RETURNING *
  `;
  return rows[0] as Subscriber;
}

export async function getSubscriberByEmail(email: string): Promise<Subscriber | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM subscribers WHERE email = ${email}
  `;
  return (rows[0] as Subscriber) ?? null;
}

export async function getAllActiveSubscribers(): Promise<Subscriber[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM subscribers WHERE is_active = TRUE
  `;
  return rows as Subscriber[];
}

export async function deactivateSubscriber(token: string): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`
    UPDATE subscribers SET is_active = FALSE, updated_at = NOW()
    WHERE unsubscribe_token = ${token}
    RETURNING id
  `;
  return rows.length > 0;
}

export async function updateSubscriberPreferences(
  token: string,
  airlines: string[],
  minHotelStars: number
): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`
    UPDATE subscribers
    SET airlines = ${airlines}, min_hotel_stars = ${minHotelStars}, updated_at = NOW()
    WHERE unsubscribe_token = ${token} AND is_active = TRUE
    RETURNING id
  `;
  return rows.length > 0;
}

// ─── ORIGIN AIRPORT QUERIES ──────────────────────────────────────────────────

export async function setOriginAirports(
  subscriberId: string,
  airports: { iata_code: string; city: string }[]
): Promise<void> {
  const sql = getSql();
  // Atomic: delete + re-insert in a single transaction so a mid-operation crash
  // cannot leave the subscriber with no airports.
  await sql.transaction([
    sql`DELETE FROM origin_airports WHERE subscriber_id = ${subscriberId}`,
    ...airports.map(a => sql`
      INSERT INTO origin_airports (subscriber_id, iata_code, city)
      VALUES (${subscriberId}, ${a.iata_code}, ${a.city})
      ON CONFLICT DO NOTHING
    `),
  ]);
}

export async function getOriginAirports(subscriberId: string): Promise<OriginAirport[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM origin_airports WHERE subscriber_id = ${subscriberId}
  `;
  return rows as OriginAirport[];
}

// ─── DESTINATION QUERIES ─────────────────────────────────────────────────────

export async function setDestinations(
  subscriberId: string,
  destinations: { dest_type: 'flight' | 'roadtrip'; iata_code: string | null; city_name: string }[]
): Promise<void> {
  const sql = getSql();
  // Atomic: delete + re-insert in a single transaction so a mid-operation crash
  // cannot leave the subscriber with no destinations.
  await sql.transaction([
    sql`DELETE FROM destinations WHERE subscriber_id = ${subscriberId}`,
    ...destinations.map(d => sql`
      INSERT INTO destinations (subscriber_id, dest_type, iata_code, city_name)
      VALUES (${subscriberId}, ${d.dest_type}, ${d.iata_code}, ${d.city_name})
      ON CONFLICT DO NOTHING
    `),
  ]);
}

export async function getDestinations(subscriberId: string): Promise<Destination[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM destinations WHERE subscriber_id = ${subscriberId}
  `;
  return rows as Destination[];
}

// ─── DEDUP QUERIES ───────────────────────────────────────────────────────────

export async function isDealAlreadySent(
  subscriberId: string,
  dealKey: string
): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`
    SELECT 1 FROM deals_sent
    WHERE subscriber_id = ${subscriberId}
      AND deal_key = ${dealKey}
      AND sent_at > NOW() - INTERVAL '72 hours'
    LIMIT 1
  `;
  return rows.length > 0;
}

export async function recordDealSent(params: {
  subscriberId: string;
  dealKey: string;
  dealType: DealSent['deal_type'];
  originIata?: string;
  destIata?: string;
  destCity?: string;
  departDate?: string;
  returnDate?: string;
  flightPrice?: number;
  hotelPrice?: number;
}): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO deals_sent (
      subscriber_id, deal_key, deal_type,
      origin_iata, dest_iata, dest_city,
      depart_date, return_date,
      flight_price, hotel_price
    ) VALUES (
      ${params.subscriberId}, ${params.dealKey}, ${params.dealType},
      ${params.originIata ?? null}, ${params.destIata ?? null}, ${params.destCity ?? null},
      ${params.departDate ?? null}, ${params.returnDate ?? null},
      ${params.flightPrice ?? null}, ${params.hotelPrice ?? null}
    )
    ON CONFLICT (subscriber_id, deal_key) DO UPDATE SET sent_at = NOW()
  `;
}

// ─── PRICE BASELINE CACHE ────────────────────────────────────────────────────

export async function getCachedBaseline(cacheKey: string): Promise<PriceBaselineCache | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM price_baseline_cache
    WHERE cache_key = ${cacheKey}
      AND fetched_at > NOW() - INTERVAL '24 hours'
    LIMIT 1
  `;
  return (rows[0] as PriceBaselineCache) ?? null;
}

export async function setCachedBaseline(params: {
  cacheKey: string;
  baselineLow: number;
  baselineHigh: number;
  source: string;
}): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO price_baseline_cache (cache_key, baseline_low, baseline_high, baseline_source)
    VALUES (${params.cacheKey}, ${params.baselineLow}, ${params.baselineHigh}, ${params.source})
    ON CONFLICT (cache_key) DO UPDATE
      SET baseline_low = EXCLUDED.baseline_low,
          baseline_high = EXCLUDED.baseline_high,
          baseline_source = EXCLUDED.baseline_source,
          fetched_at = NOW()
  `;
}

// ─── RAW SQL EXPORT ──────────────────────────────────────────────────────────
// For API routes that need to run ad-hoc queries directly.

export function getRawSql() {
  return getSql();
}
