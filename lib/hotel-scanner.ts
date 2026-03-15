// lib/hotel-scanner.ts
// Fetches hotel rates via Xotelo API (free, no key required).
// Uses Xotelo's heatmap endpoint to determine the typical/average price baseline.
// Returns qualifying hotel deals per the WeStayFlyBot discount rules.

import { getCachedBaseline, setCachedBaseline } from './db';

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface HotelDeal {
  destCity: string;
  destIata: string | null; // null for roadtrip destinations
  hotelName: string;
  hotelStars: number;
  checkIn: string;         // YYYY-MM-DD
  checkOut: string;        // YYYY-MM-DD
  nights: number;
  pricePerNight: number;
  totalPrice: number;
  discountPct: number;     // e.g. 0.40 = 40% below typical
  baselineAvg: number;
  bookingUrl: string;
}

interface XoteloHotel {
  key: string;             // Xotelo hotel key
  name: string;
  stars: number;
  reviewScore: number;
  url: string;
}

interface XoteloRate {
  checkIn: string;
  checkOut: string;
  price: number;
  currency: string;
}

interface XoteloHeatmapEntry {
  date: string;
  price: number;
  label: 'cheap' | 'average' | 'expensive';
}

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const XOTELO_BASE = 'https://data.xotelo.com/api';
const HOTEL_DEAL_THRESHOLD = 0.35;       // 35% below typical avg = deal

const SCAN_DAYS_OUT = 180;
const SCAN_INTERVAL_DAYS = 7;
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

// ─── XOTELO: HOTEL LIST ──────────────────────────────────────────────────────
// Fetches hotels in a city. Xotelo uses city slugs (e.g. "miami-fl").

function cityToSlug(cityName: string): string {
  return cityName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

async function fetchHotelsInCity(citySlug: string, minStars: number): Promise<XoteloHotel[]> {
  try {
    const res = await fetch(
      `${XOTELO_BASE}/list?location=${citySlug}&stars=${minStars}`,
      { next: { revalidate: 0 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.result ?? []).filter((h: XoteloHotel) => h.stars >= minStars).slice(0, 10); // top 10
  } catch {
    return [];
  }
}

// ─── XOTELO: HEATMAP BASELINE ────────────────────────────────────────────────
// The heatmap returns average prices per date. We average the "average" labeled
// entries to get a reliable typical nightly rate for this hotel.

async function fetchHotelBaseline(hotelKey: string, destSlug: string): Promise<number | null> {
  const cacheKey = `hotel:${destSlug}:${hotelKey}`;
  const cached = await getCachedBaseline(cacheKey);
  if (cached) return Number(cached.baseline_low);

  try {
    const res = await fetch(
      `${XOTELO_BASE}/heatmap?hotel_key=${hotelKey}`,
      { next: { revalidate: 0 } }
    );
    if (!res.ok) return null;

    const data = await res.json();
    const entries: XoteloHeatmapEntry[] = data.result ?? [];
    const avgEntries = entries.filter(e => e.label === 'average' && e.price > 0);
    if (!avgEntries.length) return null;

    const avgPrice = avgEntries.reduce((sum, e) => sum + e.price, 0) / avgEntries.length;

    await setCachedBaseline({
      cacheKey,
      baselineLow: avgPrice,
      baselineHigh: avgPrice,
      source: 'xotelo_heatmap',
    });

    return avgPrice;
  } catch {
    return null;
  }
}

// ─── XOTELO: LIVE RATES ──────────────────────────────────────────────────────

async function fetchHotelRates(hotelKey: string, checkIn: string, checkOut: string): Promise<number | null> {
  try {
    const res = await fetch(
      `${XOTELO_BASE}/rates?hotel_key=${hotelKey}&chk_in=${checkIn}&chk_out=${checkOut}`,
      { next: { revalidate: 0 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const rates: XoteloRate[] = data.result ?? [];
    if (!rates.length) return null;

    // Return the lowest available rate in USD
    const usdRates = rates.filter(r => r.currency === 'USD');
    const pool = usdRates.length ? usdRates : rates;
    return Math.min(...pool.map(r => r.price));
  } catch {
    return null;
  }
}

// ─── DISCOUNT CALCULATION ────────────────────────────────────────────────────

function calcDiscount(currentPrice: number, baselineAvg: number): number {
  if (baselineAvg <= 0) return 0;
  return (baselineAvg - currentPrice) / baselineAvg;
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

export async function scanHotelsForDestination(params: {
  destCity: string;
  destIata: string | null;
  minStars: number;
}): Promise<HotelDeal[]> {
  const deals: HotelDeal[] = [];
  const destSlug = cityToSlug(params.destCity);

  const hotels = await fetchHotelsInCity(destSlug, params.minStars);
  if (!hotels.length) {
    console.warn(`[hotel-scanner] No hotels found for ${params.destCity}`);
    return deals;
  }

  const today = new Date();

  for (const hotel of hotels) {
    const baselineAvgPerNight = await fetchHotelBaseline(hotel.key, destSlug);
    if (!baselineAvgPerNight) continue;

    for (let i = 7; i <= SCAN_DAYS_OUT; i += SCAN_INTERVAL_DAYS) {
      const checkIn = formatDate(addDays(today, i));

      for (const nights of STAY_DURATIONS) {
        const checkOut = formatDate(addDays(new Date(checkIn), nights));

        const totalPrice = await fetchHotelRates(hotel.key, checkIn, checkOut);
        if (!totalPrice) continue;

        const pricePerNight = totalPrice / nights;
        const discount = calcDiscount(pricePerNight, baselineAvgPerNight);

        if (discount >= HOTEL_DEAL_THRESHOLD) {
          deals.push({
            destCity: params.destCity,
            destIata: params.destIata,
            hotelName: hotel.name,
            hotelStars: hotel.stars,
            checkIn,
            checkOut,
            nights,
            pricePerNight,
            totalPrice,
            discountPct: discount,
            baselineAvg: baselineAvgPerNight,
            bookingUrl: hotel.url,
          });
        }

        await new Promise(r => setTimeout(r, 200));
      }
    }
  }

  return deals;
}

export { HOTEL_DEAL_THRESHOLD };
