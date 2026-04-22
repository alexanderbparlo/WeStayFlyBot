// lib/email.ts
// Email sending via Resend (free tier: 3,000 emails/month).
// Includes welcome email and all deal alert email templates.

import { Resend } from 'resend';
import { EvaluatedDeal } from './deal-evaluator';

function getResend() {
  return new Resend(process.env.RESEND_API_KEY!);
}
const FROM_EMAIL = process.env.FROM_EMAIL ?? 'WeStayFlyBot <alerts@westayflybot.com>';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://westayflybot.vercel.app';

// ─── SHARED HELPERS ───────────────────────────────────────────────────────────

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function money(n: number): string {
  return `$${n.toFixed(0)}`;
}

function manageLink(token: string): string {
  return `${SITE_URL}/manage?token=${token}`;
}

function unsubLink(token: string): string {
  return `${SITE_URL}/api/unsubscribe?token=${token}`;
}

// ─── SHARED EMAIL WRAPPER ────────────────────────────────────────────────────

function emailWrapper(title: string, body: string, token: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
<style>
  body { margin:0; padding:0; background:#fdf6ed; font-family:'Helvetica Neue',Arial,sans-serif; color:#2d2a26; }
  .outer { max-width:600px; margin:0 auto; padding:32px 16px; }
  .card { background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(160,72,40,0.1); }
  .header { background:linear-gradient(135deg,#c8603a,#a04828); padding:28px 32px; }
  .header-logo { font-size:22px; color:#fff; font-weight:700; letter-spacing:-0.3px; }
  .header-sub { color:rgba(255,255,255,0.8); font-size:13px; margin-top:4px; }
  .body { padding:28px 32px; }
  .deal-badge { display:inline-block; padding:5px 14px; border-radius:50px; font-size:12px; font-weight:600; margin-bottom:16px; }
  .badge-bundle { background:#fef3cd; color:#856404; }
  .badge-combo { background:#d1ecf1; color:#0c5460; }
  .badge-flight { background:#d4edda; color:#155724; }
  .badge-hotel { background:#e2d9f3; color:#4a1d96; }
  .badge-roadtrip { background:#d1f0e0; color:#0a5c36; }
  h1 { font-size:22px; font-weight:700; margin:0 0 8px; color:#2d2a26; }
  h2 { font-size:16px; font-weight:600; margin:20px 0 8px; color:#c8603a; border-bottom:1px solid #f0e8dc; padding-bottom:6px; }
  .detail-row { display:flex; justify-content:space-between; font-size:14px; padding:6px 0; border-bottom:1px solid #f9f4ef; }
  .detail-label { color:#7a6f63; }
  .detail-value { font-weight:500; color:#2d2a26; }
  .price-highlight { font-size:28px; font-weight:700; color:#c8603a; }
  .was-price { font-size:13px; color:#7a6f63; text-decoration:line-through; }
  .saving-pct { font-size:13px; color:#4a7c59; font-weight:600; margin-left:6px; }
  .cta-btn { display:block; background:linear-gradient(135deg,#c8603a,#a04828); color:#fff; text-decoration:none; text-align:center; padding:14px 24px; border-radius:10px; font-size:15px; font-weight:600; margin:20px 0 4px; }
  .footer { padding:20px 32px; background:#fdf6ed; border-top:1px solid #f0e8dc; }
  .footer p { font-size:12px; color:#a09488; margin:0 0 6px; line-height:1.5; }
  .footer a { color:#c8603a; text-decoration:none; }
</style>
</head>
<body>
<div class="outer">
  <div class="card">
    <div class="header">
      <div class="header-logo">✈️ WeStayFlyBot</div>
      <div class="header-sub">Deal alerts for the restless</div>
    </div>
    <div class="body">
      ${body}
    </div>
    <div class="footer">
      <p>You're receiving this because you subscribed to WeStayFlyBot deal alerts.</p>
      <p>
        <a href="${manageLink(token)}">Update my preferences</a> &nbsp;·&nbsp;
        <a href="${unsubLink(token)}">Unsubscribe</a>
      </p>
      <p style="margin-top:10px;">
        <a href="${SITE_URL}" style="font-weight:600;">westayflybot.com</a>
      </p>
    </div>
  </div>
</div>
</body>
</html>
  `.trim();
}

// ─── WELCOME EMAIL ────────────────────────────────────────────────────────────

export async function sendWelcomeEmail(params: {
  email: string;
  subscriberToken: string;
  originAirports: { code: string; city: string }[];
  flightDestinations: { code: string; city: string }[];
  roadDestinations: string[];
  airlines: string[];
  minHotelStars: number;
}): Promise<void> {
  const { email, subscriberToken, originAirports, flightDestinations, roadDestinations, airlines, minHotelStars } = params;

  const originsStr = originAirports.map(a => `${a.code} (${a.city})`).join(', ');
  const flightDestsStr = flightDestinations.length ? flightDestinations.map(d => `${d.code} (${d.city})`).join(', ') : 'None';
  const roadDestsStr = roadDestinations.length ? roadDestinations.join(', ') : 'None';
  const airlinesStr = airlines.join(', ');
  const stars = '⭐'.repeat(minHotelStars) + '☆'.repeat(5 - minHotelStars);

  const body = `
    <h1>You're locked in! 🎉</h1>
    <p style="color:#7a6f63;font-size:15px;margin-bottom:24px;">
      Welcome to WeStayFlyBot. We'll scan deals twice daily and email you only when something genuinely hits your threshold — no spam, no fluff.
    </p>

    <h2>Your Subscription Summary</h2>
    <div class="detail-row"><span class="detail-label">Origin airport(s)</span><span class="detail-value">${originsStr}</span></div>
    <div class="detail-row"><span class="detail-label">Flight destinations</span><span class="detail-value">${flightDestsStr}</span></div>
    <div class="detail-row"><span class="detail-label">Road trip destinations</span><span class="detail-value">${roadDestsStr}</span></div>
    <div class="detail-row"><span class="detail-label">Preferred airlines</span><span class="detail-value">${airlinesStr}</span></div>
    <div class="detail-row"><span class="detail-label">Min hotel rating</span><span class="detail-value">${stars} (${minHotelStars}+ stars)</span></div>

    <h2>How We Alert You</h2>
    <div style="font-size:13px;color:#5a5248;line-height:1.7;">
      <div>✅ <strong>Flight ≥35% off</strong> → Flight Deal alert</div>
      <div>⭐ <strong>Flight ≥35% + Hotel ≥35% (same dates)</strong> → Special Bundle Deal</div>
      <div>✈️🏨 <strong>Flight ≥15% + Hotel ≥35% (same dates)</strong> → Combo alert</div>
      <div>🚗🏨 <strong>Road trip hotel ≥35% off</strong> → Hotel Deal alert</div>
      <div>❌ <strong>Hotel ≥35% but flight &lt;20% off</strong> → No alert</div>
    </div>

    <a href="${manageLink(subscriberToken)}" class="cta-btn">Manage My Subscription →</a>
  `;

  await getResend().emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: '✈️ Welcome to WeStayFlyBot — You\'re subscribed!',
    html: emailWrapper('Welcome to WeStayFlyBot', body, subscriberToken),
  });
}

// ─── DEAL ALERT EMAILS ────────────────────────────────────────────────────────

export async function sendDealEmail(params: {
  email: string;
  subscriberToken: string;
  deal: EvaluatedDeal;
}): Promise<void> {
  const { email, subscriberToken, deal } = params;
  const html = buildDealEmailHtml(deal, subscriberToken);
  const subject = buildSubject(deal);

  await getResend().emails.send({
    from: FROM_EMAIL,
    to: email,
    subject,
    html,
  });
}

function buildSubject(deal: EvaluatedDeal): string {
  switch (deal.type) {
    case 'bundle':
      return `⭐ BUNDLE DEAL: ${pct(deal.flight!.discountPct)} off flight + ${pct(deal.hotel!.discountPct)} off hotel → ${deal.destCity}`;
    case 'combo':
      return `✈️🏨 Flight + Hotel Combo: ${deal.destCity} (hotel ${pct(deal.hotel!.discountPct)} off)`;
    case 'flight':
      return `✈️ Flight Deal: ${deal.originIata} → ${deal.destCity} — ${pct(deal.flight!.discountPct)} off`;
    case 'roadtrip_hotel':
      return `🚗🏨 Road Trip Deal: ${deal.destCity} hotel ${pct(deal.hotel!.discountPct)} off`;
    default:
      return `WeStayFlyBot Deal Alert: ${deal.destCity}`;
  }
}

function buildDealEmailHtml(deal: EvaluatedDeal, token: string): string {
  let badgeClass = 'badge-flight';
  let badgeText = '✈️ Flight Deal';
  if (deal.type === 'bundle') { badgeClass = 'badge-bundle'; badgeText = '⭐ Special Bundle Deal'; }
  if (deal.type === 'combo') { badgeClass = 'badge-combo'; badgeText = '✈️🏨 Flight + Hotel Combo'; }
  if (deal.type === 'roadtrip_hotel') { badgeClass = 'badge-roadtrip'; badgeText = '🚗🏨 Road Trip Hotel Deal'; }

  let flightSection = '';
  if (deal.flight) {
    const f = deal.flight;
    flightSection = `
      <h2>✈️ Flight Details</h2>
      <div class="detail-row"><span class="detail-label">Route</span><span class="detail-value">${f.originIata} → ${deal.destIata} (roundtrip)</span></div>
      <div class="detail-row"><span class="detail-label">Depart</span><span class="detail-value">${f.departDate}</span></div>
      <div class="detail-row"><span class="detail-label">Return</span><span class="detail-value">${f.returnDate}</span></div>
      <div class="detail-row"><span class="detail-label">Airline</span><span class="detail-value">${f.airline}</span></div>
      <div class="detail-row">
        <span class="detail-label">Price (per person)</span>
        <span class="detail-value">
          <span class="price-highlight">${money(f.pricePerPerson)}</span>
          <span class="was-price">${money(f.baselineLow)}</span>
          <span class="saving-pct">↓ ${pct(f.discountPct)} off</span>
        </span>
      </div>
      <a href="${f.bookingUrl}" class="cta-btn">Book This Flight →</a>
    `;
  }

  let hotelSection = '';
  if (deal.hotel) {
    const h = deal.hotel;
    const starStr = '⭐'.repeat(h.hotelStars);
    hotelSection = `
      <h2>🏨 Hotel Details</h2>
      <div class="detail-row"><span class="detail-label">Hotel</span><span class="detail-value">${h.hotelName} ${starStr}</span></div>
      <div class="detail-row"><span class="detail-label">Check-in</span><span class="detail-value">${h.checkIn}</span></div>
      <div class="detail-row"><span class="detail-label">Check-out</span><span class="detail-value">${h.checkOut} (${h.nights} nights)</span></div>
      <div class="detail-row">
        <span class="detail-label">Price per night</span>
        <span class="detail-value">
          <span class="price-highlight">${money(h.pricePerNight)}</span>
          <span class="was-price">${money(h.baselineAvg)}/night typical</span>
          <span class="saving-pct">↓ ${pct(h.discountPct)} off</span>
        </span>
      </div>
      <div class="detail-row"><span class="detail-label">Total stay</span><span class="detail-value"><strong>${money(h.totalPrice)}</strong></span></div>
      <a href="${h.bookingUrl}" class="cta-btn" style="background:linear-gradient(135deg,#4a7c59,#2d5c3f);">Book This Hotel →</a>
    `;
  }

  const body = `
    <span class="deal-badge ${badgeClass}">${badgeText}</span>
    <h1>${deal.destCity}</h1>
    <p style="color:#7a6f63;font-size:14px;margin-bottom:8px;">
      This deal was spotted by WeStayFlyBot and meets your alert threshold.
    </p>
    ${flightSection}
    ${hotelSection}
    <p style="font-size:12px;color:#a09488;margin-top:16px;">
      Prices fluctuate. Book soon — deals at this discount level typically last 24–72 hours.
    </p>
  `;

  return emailWrapper(deal.label, body, token);
}
