'use client';
// app/page.tsx
// WeStayFlyBot landing / subscribe page.
// Converted from index.html into a Next.js client component.

import { useState } from 'react';
import type { Metadata } from 'next';
import {
  AirportSearch,
  DestinationPanel,
  AirlineSelector,
  StarRating,
} from './components/AirportSearch';
import { Airport } from '@/lib/airport-data';
import styles from './page.module.css';

// ─── PAGE ────────────────────────────────────────────────────────────────────

export default function SubscribePage() {
  // Form state
  const [originAirports, setOriginAirports] = useState<Airport[]>([]);
  const [flightDests, setFlightDests] = useState<Airport[]>([]);
  const [roadDests, setRoadDests] = useState<string[]>([]);
  const [airlines, setAirlines] = useState<string[]>(['Any airline']);
  const [minStars, setMinStars] = useState(3);
  const [email, setEmail] = useState('');

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');

    // Validation
    if (!originAirports.length) { setError('Please select at least one origin airport.'); return; }
    if (!flightDests.length && !roadDests.length) { setError('Please select at least one destination.'); return; }
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailValid) { setError('Please enter a valid email address.'); return; }

    setSubmitting(true);
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          originAirports: originAirports.map(a => ({ code: a.code, city: a.city })),
          flightDestinations: flightDests.map(a => ({ code: a.code, city: a.city })),
          roadDestinations: roadDests,
          airlines,
          minHotelStars: minStars,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Something went wrong');
      }

      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* ── HERO ────────────────────────────────────────────── */}
      <header className="wsfb-header">
        <div className="wsfb-header-inner" style={{ textAlign: 'center' }}>
          <div className={styles.logoRow} style={{ animationDelay: '0ms' }}>
            <span className={styles.logoIcon}>✈️</span>
            <span className={styles.logoText}>WeStayFlyBot</span>
          </div>
          <h1 className={styles.heroTitle} style={{ animationDelay: '80ms' }}>
            Great deals find <em>you</em>,<br />not the other way around.
          </h1>
          <p className={styles.heroSub} style={{ animationDelay: '160ms' }}>
            Set your airports and dream destinations once. We scan flights and hotels daily
            and email you only when a real deal appears — 35% off or more.
          </p>
          <div className={styles.badges} style={{ animationDelay: '240ms' }}>
            {['✈️ Flight deals', '🏨 Hotel deals', '🚗 Road trip deals', '🎯 35%+ off threshold', '📬 Email alerts only'].map(b => (
              <span key={b} className={styles.badge}>{b}</span>
            ))}
          </div>
        </div>
      </header>

      {/* ── FORM CARD ───────────────────────────────────────── */}
      <section className={styles.formSection}>
        <div className={styles.formCard}>

          {/* Success state */}
          {success ? (
            <div className={styles.successCard}>
              <div className={styles.successIcon}>🎉</div>
              <h2>You&apos;re on the list!</h2>
              <p>
                Welcome to WeStayFlyBot. Check your inbox for a confirmation —
                then sit back while we hunt deals for you.
              </p>
              <a href="/manage" className={styles.manageLink}>
                Update your preferences anytime →
              </a>
            </div>
          ) : (
            <>
              {/* Origin airports */}
              <div className="wsfb-section-title">🛫 Your Origin Airport(s)</div>
              <AirportSearch
                label="Search by city — we'll show nearby airports"
                placeholder="e.g. Chicago, New York, Los Angeles…"
                selected={originAirports}
                onChange={setOriginAirports}
                hint="Select all airports you're willing to depart from."
              />

              <div className="wsfb-divider" />

              {/* Destinations */}
              <div className="wsfb-section-title">📍 Your Destination(s)</div>
              <DestinationPanel
                flightDests={flightDests}
                roadDests={roadDests}
                onFlightChange={setFlightDests}
                onRoadChange={setRoadDests}
              />

              <div className="wsfb-divider" />

              {/* Airlines */}
              <div className="wsfb-section-title">🛩️ Preferred Airlines</div>
              <label className="wsfb-label">Alert me for deals on…</label>
              <AirlineSelector selected={airlines} onChange={setAirlines} />
              <p className="wsfb-hint" style={{ marginTop: '0.5rem' }}>
                Leave &quot;Any airline&quot; selected to get all deals regardless of carrier.
              </p>

              <div className="wsfb-divider" />

              {/* Hotel rating */}
              <div className="wsfb-section-title">🏨 Minimum Hotel Rating</div>
              <label className="wsfb-label">Only notify me for hotels rated at least…</label>
              <StarRating value={minStars} onChange={setMinStars} />

              <div className="wsfb-divider" />

              {/* Email */}
              <div className="wsfb-section-title">📬 Your Email</div>
              <label className="wsfb-label">Where should we send deal alerts?</label>
              <input
                type="email"
                className={styles.emailInput}
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
              <p className="wsfb-hint">
                We&apos;ll send a welcome confirmation first, then only reach out when deals hit your threshold.
              </p>

              {error && <p className={styles.errorMsg}>⚠️ {error}</p>}

              <button
                className={styles.submitBtn}
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? '⏳ Subscribing…' : '🚀 Start Getting Deals'}
              </button>
            </>
          )}
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────── */}
      <section className={styles.howSection}>
        <h2 className={styles.howTitle}>How it works</h2>
        <p className={styles.howSub}>Set it once. Let the deals come to you.</p>
        <div className={styles.howGrid}>
          {[
            { emoji: '⚙️', title: 'You set your preferences', body: 'Origin airports, dream destinations, airlines, and minimum hotel quality.' },
            { emoji: '🔍', title: 'We scan twice daily',       body: 'Morning and evening scans compare live prices against typical baselines across 6 months of dates.' },
            { emoji: '📊', title: 'Smart deal logic',          body: 'We evaluate flights and hotels together — and flag bundle deals when both drop at once.' },
            { emoji: '📬', title: 'Email when it matters',     body: 'No spam. You only hear from us when something genuinely hits 35%+ off.' },
          ].map(card => (
            <div key={card.title} className={styles.howCard}>
              <div className={styles.howEmoji}>{card.emoji}</div>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── DEAL LOGIC CALLOUT ───────────────────────────────── */}
      <section className={styles.logicSection}>
        <div className={styles.logicCard}>
          <h3>🎯 Our deal notification rules</h3>
          {[
            { dot: 'green', text: <><strong>Flight ≥35% off</strong> → Flight Deal alert</> },
            { dot: 'green', text: <><strong>Flight ≥35% + Hotel ≥35% (same dates)</strong> → ⭐ Special Bundle Deal</> },
            { dot: 'gold',  text: <><strong>Flight ≥15% + Hotel ≥35% (same dates)</strong> → Flight + Hotel Combo alert</> },
            { dot: 'red',   text: <><strong>Hotel ≥35%, flight &lt;20% off</strong> → No alert</> },
            { dot: 'sky',   text: <><strong>Road trip hotel ≥35% off</strong> → Hotel Deal alert (no flight needed)</> },
          ].map((row, i) => (
            <div key={i} className={styles.logicRow}>
              <span className={`${styles.logicDot} ${styles['dot_' + row.dot]}`} />
              <span>{row.text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────── */}
      <footer className="wsfb-footer">
        © 2025 WeStayFlyBot — built for the deal-hunters. &nbsp;|&nbsp;
        <a href="/manage">Update my subscription</a>
      </footer>
    </>
  );
}
