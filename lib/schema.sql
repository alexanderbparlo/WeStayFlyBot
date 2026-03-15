-- ============================================================
-- WeStayFlyBot — Database Schema
-- Target: Vercel Postgres (Neon-compatible)
-- Run this once via Vercel Postgres query console or psql
-- ============================================================

-- SUBSCRIBERS
-- One row per email address. Stores all user preferences.
CREATE TABLE IF NOT EXISTS subscribers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email            TEXT NOT NULL UNIQUE,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  min_hotel_stars  INTEGER NOT NULL DEFAULT 3 CHECK (min_hotel_stars BETWEEN 1 AND 5),
  airlines         TEXT[] NOT NULL DEFAULT ARRAY['Any airline'],
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unsubscribe_token UUID NOT NULL DEFAULT gen_random_uuid()
);

-- ORIGIN AIRPORTS
-- Many-to-one with subscribers. A subscriber can have multiple origin airports.
CREATE TABLE IF NOT EXISTS origin_airports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id UUID NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  iata_code     CHAR(3) NOT NULL,
  city          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (subscriber_id, iata_code)
);

-- DESTINATIONS
-- Covers both flight and road trip destinations.
-- dest_type: 'flight' | 'roadtrip'
-- For flight destinations: iata_code is populated, city_name is optional label.
-- For roadtrip destinations: iata_code is NULL, city_name holds the city string.
CREATE TABLE IF NOT EXISTS destinations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id UUID NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  dest_type     TEXT NOT NULL CHECK (dest_type IN ('flight', 'roadtrip')),
  iata_code     CHAR(3),
  city_name     TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (subscriber_id, dest_type, COALESCE(iata_code, city_name))
);

-- DEALS SENT
-- Deduplication log. Prevents re-alerting on the same deal within a cooldown window.
-- deal_key is a deterministic hash: origin|destination|dates|deal_type
-- cooldown: we won't re-alert the same deal_key for 72 hours.
CREATE TABLE IF NOT EXISTS deals_sent (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id UUID NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  deal_key      TEXT NOT NULL,
  deal_type     TEXT NOT NULL, -- 'flight' | 'hotel' | 'bundle' | 'combo' | 'roadtrip_hotel'
  origin_iata   CHAR(3),
  dest_iata     CHAR(3),
  dest_city     TEXT,
  depart_date   DATE,
  return_date   DATE,
  flight_price  NUMERIC(10,2),
  hotel_price   NUMERIC(10,2),
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (subscriber_id, deal_key)
);

-- PRICE BASELINE CACHE
-- Stores the "typical price" fetched from APIs so we can reuse it
-- across multiple subscribers scanning the same route, reducing API calls.
-- TTL: 24 hours (application-level check on fetched_at).
CREATE TABLE IF NOT EXISTS price_baseline_cache (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key       TEXT NOT NULL UNIQUE, -- e.g. "flight:ORD:MIA" or "hotel:miami-fl"
  baseline_low    NUMERIC(10,2),
  baseline_high   NUMERIC(10,2),
  baseline_source TEXT, -- 'serpapi_typical' | 'xotelo_heatmap'
  fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── INDEXES ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_origin_airports_subscriber ON origin_airports(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_destinations_subscriber ON destinations(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_destinations_type ON destinations(dest_type);
CREATE INDEX IF NOT EXISTS idx_deals_sent_subscriber ON deals_sent(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_deals_sent_key ON deals_sent(deal_key);
CREATE INDEX IF NOT EXISTS idx_deals_sent_at ON deals_sent(sent_at);
CREATE INDEX IF NOT EXISTS idx_price_cache_key ON price_baseline_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_subscribers_active ON subscribers(is_active);

-- ─── AUTO-UPDATE updated_at TRIGGER ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER subscribers_updated_at
  BEFORE UPDATE ON subscribers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
