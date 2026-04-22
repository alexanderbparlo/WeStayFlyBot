// lib/deal-evaluator.ts
// Applies the WeStayFlyBot deal rule table to flight and hotel scan results.
// Handles deduplication and determines which email template to send.

import { isDealAlreadySent, recordDealSent } from './db';
import { FlightDeal } from './flight-scanner';
import { HotelDeal } from './hotel-scanner';
import { FLIGHT_DEAL_THRESHOLD, FLIGHT_COMBO_THRESHOLD, FLIGHT_COMBO_MIN } from './flight-scanner';
import { sendDealEmail } from './email';

// ─── TYPES ───────────────────────────────────────────────────────────────────

export type DealType = 'flight' | 'bundle' | 'combo' | 'roadtrip_hotel';

export interface EvaluatedDeal {
  type: DealType;
  label: string;           // Human-readable label for email subject
  isBundle: boolean;       // true = ⭐ Special Bundle Deal
  originIata?: string;
  flight?: FlightDeal;
  hotel?: HotelDeal;
  destCity: string;
  destIata?: string;
}

// ─── DEAL KEY ────────────────────────────────────────────────────────────────
// Deterministic string that uniquely identifies a deal for dedup purposes.

function makeDealKey(deal: EvaluatedDeal): string {
  const parts = [
    deal.type,
    deal.originIata ?? '',
    deal.destIata ?? '',
    deal.destCity.trim(),
    deal.flight?.departDate ?? '',
    deal.hotel?.checkIn ?? '',
  ];
  return parts.join('|').toLowerCase();
}

// ─── OVERLAP CHECK ───────────────────────────────────────────────────────────
// For combo/bundle deals, the hotel stay must overlap with the flight dates.

function datesOverlap(
  flightDepart: string, flightReturn: string,
  hotelCheckIn: string, hotelCheckOut: string
): boolean {
  const fd = new Date(flightDepart).getTime();
  const fr = new Date(flightReturn).getTime();
  const hci = new Date(hotelCheckIn).getTime();
  const hco = new Date(hotelCheckOut).getTime();
  // Hotel check-in on or after flight departure, hotel check-out on or before flight return
  return hci >= fd && hco <= fr;
}

// ─── RULE TABLE ──────────────────────────────────────────────────────────────
// Applies the 5 WeStayFlyBot notification rules.

export function evaluateFlightDestination(params: {
  flightDeals: FlightDeal[];           // flights ≥35% off
  comboEligibleFlights: FlightDeal[];  // flights 15–34% off
  hotelDeals: HotelDeal[];             // hotels ≥35% off (flight destination)
  destCity: string;
  destIata: string;
}): EvaluatedDeal[] {
  const { flightDeals, comboEligibleFlights, hotelDeals, destCity, destIata } = params;
  const results: EvaluatedDeal[] = [];
  const usedHotelKeys = new Set<string>(); // prevent same hotel from triggering multiple alerts

  // ── Rule 1 & 2: Flight ≥35% off ──────────────────────────────────────────
  for (const flight of flightDeals) {
    // Check Rule 2: Is there also a hotel deal on overlapping dates? → Bundle
    const matchingHotel = hotelDeals.find(h =>
      datesOverlap(flight.departDate, flight.returnDate, h.checkIn, h.checkOut)
    );

    if (matchingHotel) {
      // Rule 2: ⭐ Special Bundle Deal
      const hotelKey = `${matchingHotel.hotelName}:${matchingHotel.checkIn}`;
      usedHotelKeys.add(hotelKey);
      results.push({
        type: 'bundle',
        label: `⭐ Special Bundle Deal: ${destCity}`,
        isBundle: true,
        originIata: flight.originIata,
        destCity,
        destIata,
        flight,
        hotel: matchingHotel,
      });
    } else {
      // Rule 1: Flight-only deal
      results.push({
        type: 'flight',
        label: `✈️ Flight Deal: ${flight.originIata} → ${destCity}`,
        isBundle: false,
        originIata: flight.originIata,
        destCity,
        destIata,
        flight,
      });
    }
  }

  // ── Rule 3 & 4: Hotel ≥35% off, check flight discount ───────────────────
  for (const hotel of hotelDeals) {
    const hotelKey = `${hotel.hotelName}:${hotel.checkIn}`;
    if (usedHotelKeys.has(hotelKey)) continue; // already emitted as bundle

    // Find best available flight with overlapping dates
    const overlappingComboFlight = comboEligibleFlights.find(f =>
      datesOverlap(f.departDate, f.returnDate, hotel.checkIn, hotel.checkOut)
    );
    const overlappingDealFlight = flightDeals.find(f =>
      datesOverlap(f.departDate, f.returnDate, hotel.checkIn, hotel.checkOut)
    );

    const bestFlight = overlappingDealFlight ?? overlappingComboFlight;

    if (!bestFlight) {
      // Rule 4: Hotel ≥35% but no qualifying flight → no notification
      continue;
    }

    if (bestFlight.discountPct < FLIGHT_COMBO_MIN) {
      // Rule 4: Flight <20% off → suppress hotel notification
      continue;
    }

    if (bestFlight.discountPct >= FLIGHT_COMBO_THRESHOLD) {
      // Rule 3: Combo (flight 15–34% + hotel ≥35%)
      usedHotelKeys.add(hotelKey);
      results.push({
        type: 'combo',
        label: `✈️🏨 Flight + Hotel Combo: ${destCity}`,
        isBundle: false,
        originIata: bestFlight.originIata,
        destCity,
        destIata,
        flight: bestFlight,
        hotel,
      });
    }
  }

  return results;
}

// ── Rule 5: Road trip hotel ≥35% off ─────────────────────────────────────────

export function evaluateRoadtripDestination(params: {
  hotelDeals: HotelDeal[];
  destCity: string;
}): EvaluatedDeal[] {
  return params.hotelDeals.map(hotel => ({
    type: 'roadtrip_hotel' as DealType,
    label: `🚗🏨 Road Trip Deal: ${params.destCity}`,
    isBundle: false,
    destCity: params.destCity,
    hotel,
  }));
}

// ─── PROCESS DEALS FOR SUBSCRIBER ────────────────────────────────────────────
// Deduplicates against DB, records sent deals, fires emails.

export async function processDealsForSubscriber(params: {
  subscriberId: string;
  email: string;
  subscriberToken: string;
  deals: EvaluatedDeal[];
}): Promise<{ sent: number; skipped: number }> {
  let sent = 0;
  let skipped = 0;

  for (const deal of params.deals) {
    const dealKey = makeDealKey(deal);

    // Dedup check
    const alreadySent = await isDealAlreadySent(params.subscriberId, dealKey);
    if (alreadySent) {
      skipped++;
      continue;
    }

    // Record in DB first — if email succeeds but record fails, the subscriber
    // gets spammed on every subsequent scan. Recording first means a failed send
    // suppresses the deal for 72h (conservative), which is far preferable.
    try {
      await recordDealSent({
        subscriberId: params.subscriberId,
        dealKey,
        dealType: deal.type,
        originIata: deal.originIata,
        destIata: deal.destIata,
        destCity: deal.destCity,
        departDate: deal.flight?.departDate,
        returnDate: deal.flight?.returnDate,
        flightPrice: deal.flight?.pricePerPerson,
        hotelPrice: deal.hotel?.pricePerNight,
      });
    } catch (err) {
      console.error(`[deal-evaluator] Failed to record deal ${dealKey}, skipping send:`, err);
      skipped++;
      continue;
    }

    // Send email
    try {
      await sendDealEmail({
        email: params.email,
        subscriberToken: params.subscriberToken,
        deal,
      });
      sent++;
    } catch (err) {
      console.error(`[deal-evaluator] Failed to send deal ${dealKey}:`, err);
      // Deal is recorded but not delivered; it will be suppressed for 72h.
    }
  }

  return { sent, skipped };
}
