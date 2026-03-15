// lib/flight-scanner.ts
// Fetches roundtrip flight prices via SerpApi (Google Flights engine).
// Compares against Google's native typical_price_range baseline.
// Returns qualifying deals per the WeStayFlyBot discount rules.

import { getCachedBaseline, setCachedBaseline } from './db';

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface FlightDeal {
  originIata: string;
  destIata: string;
  destCity: string;
  departDate: string;      // YYYY-MM-DD
  returnDate: string;      // YYYY-MM-DD
  pricePerPerson: number;
  discountPct: number;     // e.g. 0.42 = 42% below typical
  baselineLow: number;
  airline: string;
  bookingUrl: string;
}

interface SerpApiPriceInsights {
  lowest_price: number;
  typical_price_range: [number, number]; // [low, high]
  price_level: string; // 'low' | 'typical' | 'high'
  price_history?: [number, number][]; // [timestamp, price][]
}

interface SerpApiFlight {
  price: number;
  airline: string;
  booking_token?: string;
}

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const SERPAPI_BASE = 'https://serpapi.com/search.json';
const FLIGHT_DEAL_THRESHOLD = 0.35;    // 35% below typical = deal
const FLIGHT_COMBO_THRESHOLD = 0.15;   // 15% below typical = eligible for combo
const FLIGHT_COMBO_MIN = 0.20;         // must be at least 20% below for hotel-only guard

// Scan window: today + 1 day through today + 6 months
// We sample every 7 days to stay within SerpApi free tier
const SCAN_DAYS_OUT = 180;
const SCAN_INTERVAL_DAYS = 7;

// Stay durations to check (nights)
const STAY_DURATIONS = [2, 3, 5, 7, 10, 14];

// ─── DATE HELPERS ─────────────────────────────────────────────────────────────

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function generateDepartureDates(): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = 7; i <= SCAN_DAYS_OUT; i += SCAN_INTERVAL_DAYS) {
    dates.push(formatDate(addDays(today, i)));
  }
  return dates;
}

// ─── AIRLINE FILTER ──────────────────────────────────────────────────────────

function airlineMatches(flightAirline: string, preferredAirlines: string[]): boolean {
  if (preferredAirlines.includes('Any airline')) return true;
  return preferredAirlines.some(a => flightAirline.toLowerCase().includes(a.toLowerCase()));
}

// ─── SERPAPI CALL ─────────────────────────────────────────────────────────────

async function fetchFlightPrices(params: {
  originIata: string;
  destIata: string;
  departDate: string;
  returnDate: string;
}): Promise<{ bestPrice: number | null; priceInsights: SerpApiPriceInsights | null; bestAirline: string; bookingUrl: string }> {
  const searchParams = new URLSearchParams({
    engine: 'google_flights',
    api_key: process.env.SERPAPI_API_KEY!,
    departure_id: params.originIata,
    arrival_id: params.destIata,
    outbound_date: params.departDate,
    return_date: params.returnDate,
    currency: 'USD',
    hl: 'en',
    type: '1', // roundtrip
    adults: '1',
  });

  const url = `${SERPAPI_BASE}?${searchParams.toString()}`;

  try {
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) {
      console.warn(`[flight-scanner] SerpApi returned ${res.status} for ${params.originIata}→${params.destIata}`);
      return { bestPrice: null, priceInsights: null, bestAirline: '', bookingUrl: '' };
    }

    const data = await res.json();

    // SerpApi Google Flights response shape
    const bestFlight: SerpApiFlight | undefined = data.best_flights?.[0] ?? data.other_flights?.[0];
    const priceInsights: SerpApiPriceInsights | null = data.price_insights ?? null;

    const bookingUrl = bestFlight
      ? `https://www.google.com/flights#search;f=${params.originIata};t=${params.destIata};d=${params.departDate};r=${params.returnDate}`
      : '';

    return {
      bestPrice: bestFlight?.price ?? null,
      priceInsights,
      bestAirline: bestFlight?.airline ?? '',
      bookingUrl,
    };
  } catch (err) {
    console.error('[flight-scanner] Fetch error:', err);
    return { bestPrice: null, priceInsights: null, bestAirline: '', bookingUrl: '' };
  }
}

// ─── BASELINE RESOLUTION ─────────────────────────────────────────────────────
// Uses Google's typical_price_range[0] (low end of "typical") as baseline.
// This is the most accurate available signal for what a route "should" cost.

async function getFlightBaseline(
  originIata: string,
  destIata: string,
  priceInsights: SerpApiPriceInsights | null
): Promise<{ baselineLow: number; baselineHigh: number } | null> {
  const cacheKey = `flight:${originIata}:${destIata}`;

  // 1. Try DB cache first
  const cached = await getCachedBaseline(cacheKey);
  if (cached) {
    return { baselineLow: Number(cached.baseline_low), baselineHigh: Number(cached.baseline_high) };
  }

  // 2. Use live API response
  if (priceInsights?.typical_price_range) {
    const [low, high] = priceInsights.typical_price_range;
    await setCachedBaseline({ cacheKey, baselineLow: low, baselineHigh: high, source: 'serpapi_typical' });
    return { baselineLow: low, baselineHigh: high };
  }

  return null;
}

// ─── DISCOUNT CALCULATION ────────────────────────────────────────────────────

function calcDiscount(currentPrice: number, baselineLow: number): number {
  if (baselineLow <= 0) return 0;
  return (baselineLow - currentPrice) / baselineLow;
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

export interface FlightScanResult {
  deals: FlightDeal[];
  comboEligible: FlightDeal[]; // 15–34% off — eligible for hotel combo pairing
}

export async function scanFlightsForRoute(params: {
  originIata: string;
  destIata: string;
  destCity: string;
  preferredAirlines: string[];
}): Promise<FlightScanResult> {
  const deals: FlightDeal[] = [];
  const comboEligible: FlightDeal[] = [];

  const departureDates = generateDepartureDates();

  for (const departDate of departureDates) {
    for (const nights of STAY_DURATIONS) {
      const returnDate = formatDate(addDays(new Date(departDate), nights));

      const { bestPrice, priceInsights, bestAirline, bookingUrl } = await fetchFlightPrices({
        originIata: params.originIata,
        destIata: params.destIata,
        departDate,
        returnDate,
      });

      if (!bestPrice) continue;
      if (!airlineMatches(bestAirline, params.preferredAirlines)) continue;

      const baseline = await getFlightBaseline(params.originIata, params.destIata, priceInsights);
      if (!baseline) continue;

      const discount = calcDiscount(bestPrice, baseline.baselineLow);

      const deal: FlightDeal = {
        originIata: params.originIata,
        destIata: params.destIata,
        destCity: params.destCity,
        departDate,
        returnDate,
        pricePerPerson: bestPrice,
        discountPct: discount,
        baselineLow: baseline.baselineLow,
        airline: bestAirline,
        bookingUrl,
      };

      if (discount >= FLIGHT_DEAL_THRESHOLD) {
        deals.push(deal);
      } else if (discount >= FLIGHT_COMBO_THRESHOLD) {
        comboEligible.push(deal);
      }

      // Small delay between API calls to be respectful of rate limits
      await new Promise(r => setTimeout(r, 300));
    }
  }

  return { deals, comboEligible };
}

// Export thresholds for use in deal evaluator
export { FLIGHT_DEAL_THRESHOLD, FLIGHT_COMBO_THRESHOLD, FLIGHT_COMBO_MIN };
