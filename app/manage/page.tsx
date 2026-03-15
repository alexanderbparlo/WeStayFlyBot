'use client';
// app/manage/page.tsx
// WeStayFlyBot manage preferences page.
// Loaded via the token link in every email footer.
// Reads token from URL, fetches current prefs, allows editing + saving.

import { useState, useEffect, useCallback } from 'react';
import {
  AirportSearch,
  DestinationPanel,
  AirlineSelector,
  StarRating,
} from '../components/AirportSearch';
import { Airport } from '@/lib/airport-data';
import styles from './manage.module.css';

// ─── TYPES ───────────────────────────────────────────────────────────────────

type LoadState = 'loading' | 'ready' | 'error' | 'unsubscribed';

interface Prefs {
  email: string;
  originAirports: Airport[];
  flightDestinations: Airport[];
  roadDestinations: string[];
  airlines: string[];
  minHotelStars: number;
}

// ─── ACCORDION SECTION ───────────────────────────────────────────────────────

function Section({
  title, summary, children, defaultOpen = false,
}: {
  title: string;
  summary: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={styles.sectionCard}>
      <button className={styles.sectionHeader} onClick={() => setOpen(o => !o)}>
        <span className={styles.sectionTitle}>{title}</span>
        <span className={styles.sectionRight}>
          <span className={styles.sectionSummary}>{summary}</span>
          <span className={`${styles.chevron}${open ? ` ${styles.chevronOpen}` : ''}`}>▼</span>
        </span>
      </button>
      {open && <div className={styles.sectionBody}>{children}</div>}
    </div>
  );
}

// ─── TOAST ───────────────────────────────────────────────────────────────────

function Toast({ message, type }: { message: string; type: 'success' | 'error' | '' }) {
  return (
    <div className={`${styles.toast}${type ? ` ${styles['toast_' + type]} ${styles.toastShow}` : ''}`}>
      {message}
    </div>
  );
}

// ─── PAGE ────────────────────────────────────────────────────────────────────

export default function ManagePage() {
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [token, setToken] = useState('');
  const [prefs, setPrefs] = useState<Prefs | null>(null);

  // Editable fields (copied from prefs on load)
  const [originAirports, setOriginAirports] = useState<Airport[]>([]);
  const [flightDests, setFlightDests] = useState<Airport[]>([]);
  const [roadDests, setRoadDests] = useState<string[]>([]);
  const [airlines, setAirlines] = useState<string[]>(['Any airline']);
  const [minStars, setMinStars] = useState(3);

  // UI state
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | '' }>({ message: '', type: '' });
  const [showUnsubModal, setShowUnsubModal] = useState(false);

  // ── Load token from URL and fetch preferences ───────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token') ?? '';
    setToken(t);

    if (!t) { setLoadState('error'); return; }

    fetch(`/api/preferences?token=${encodeURIComponent(t)}`)
      .then(res => {
        if (!res.ok) throw new Error('not found');
        return res.json();
      })
      .then((data: Prefs) => {
        setPrefs(data);
        setOriginAirports(data.originAirports);
        setFlightDests(data.flightDestinations);
        setRoadDests(data.roadDestinations);
        setAirlines(data.airlines);
        setMinStars(data.minHotelStars);
        setLoadState('ready');
      })
      .catch(() => setLoadState('error'));
  }, []);

  // ── Toast helper ─────────────────────────────────────────────────────────
  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: '', type: '' }), 3500);
  }, []);

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!originAirports.length) { showToast('Please add at least one origin airport.', 'error'); return; }
    if (!flightDests.length && !roadDests.length) { showToast('Please add at least one destination.', 'error'); return; }

    setSaving(true);
    try {
      const res = await fetch('/api/update-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          originAirports: originAirports.map(a => ({ code: a.code, city: a.city })),
          flightDestinations: flightDests.map(a => ({ code: a.code, city: a.city })),
          roadDestinations: roadDests,
          airlines,
          minHotelStars: minStars,
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      showToast('✅ Preferences saved! Your next scan will use these settings.', 'success');
    } catch {
      showToast('Something went wrong. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Unsubscribe ───────────────────────────────────────────────────────────
  const handleUnsubscribe = async () => {
    setShowUnsubModal(false);
    try {
      const res = await fetch(`/api/unsubscribe?token=${encodeURIComponent(token)}`);
      if (!res.ok) throw new Error();
      setLoadState('unsubscribed');
    } catch {
      showToast('Unsubscribe failed. Please try again.', 'error');
    }
  };

  // ── Computed summaries for accordion headers ──────────────────────────────
  const originSummary = originAirports.length
    ? originAirports.map(a => a.code).join(', ')
    : 'None set';

  const destCount = flightDests.length + roadDests.length;
  const destSummary = destCount ? `${destCount} destination${destCount > 1 ? 's' : ''}` : 'None set';

  // ── RENDER ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── HEADER ───────────────────────────────────────────── */}
      <header className="wsfb-header" style={{ paddingBottom: '4.5rem' }}>
        <div className="wsfb-header-inner">
          <a href="/" className={styles.backLink}>← Back to WeStayFlyBot</a>
          <div className={styles.logoRow}>
            <span style={{ fontSize: '1.6rem' }}>✈️</span>
            <span className={styles.logoText}>WeStayFlyBot</span>
          </div>
          <h1 className={styles.headerTitle}>
            Manage your <em>subscription</em>
          </h1>
          <p className={styles.headerSub}>
            Update your airports, destinations, airlines, and hotel preferences anytime.
          </p>
        </div>
      </header>

      {/* ── MAIN CONTENT ─────────────────────────────────────── */}
      <main className={styles.main}>

        {/* Loading */}
        {loadState === 'loading' && (
          <div className={styles.stateCard}>
            <div className={styles.spinner} />
            <p style={{ color: 'var(--warm-gray)' }}>Loading your preferences…</p>
          </div>
        )}

        {/* Error / invalid token */}
        {loadState === 'error' && (
          <div className={`${styles.stateCard} ${styles.stateError}`}>
            <div className={styles.stateIcon}>🔗</div>
            <h2>Invalid or expired link</h2>
            <p>
              This manage link may have expired or is incorrect. Check your welcome email
              or most recent deal alert for a fresh link, or{' '}
              <a href="/">re-subscribe on the homepage</a>.
            </p>
          </div>
        )}

        {/* Unsubscribed confirmation */}
        {loadState === 'unsubscribed' && (
          <div className={`${styles.stateCard} ${styles.stateError}`}>
            <div className={styles.stateIcon}>👋</div>
            <h2>You&apos;ve been unsubscribed</h2>
            <p>
              You won&apos;t receive any more deal alerts. Changed your mind?{' '}
              <a href="/">Re-subscribe anytime →</a>
            </p>
          </div>
        )}

        {/* Ready — show preference form */}
        {loadState === 'ready' && prefs && (
          <>
            {/* Email (read-only) */}
            <Section title="📬 Email Address" summary={prefs.email} defaultOpen>
              <label className="wsfb-label">Alerts are sent to</label>
              <div className={styles.emailDisplay}>
                <span>✉️</span>
                <span>{prefs.email}</span>
              </div>
              <p className="wsfb-hint">
                Email address cannot be changed. To use a different email, unsubscribe and re-subscribe.
              </p>
            </Section>

            {/* Origin airports */}
            <Section title="🛫 Origin Airports" summary={originSummary}>
              <AirportSearch
                label="Search by city — airports within 100 miles"
                placeholder="e.g. Chicago, New York…"
                selected={originAirports}
                onChange={setOriginAirports}
                hint="Select all airports you're willing to depart from."
              />
            </Section>

            {/* Destinations */}
            <Section title="📍 Destinations" summary={destSummary}>
              <DestinationPanel
                flightDests={flightDests}
                roadDests={roadDests}
                onFlightChange={setFlightDests}
                onRoadChange={setRoadDests}
              />
            </Section>

            {/* Airlines */}
            <Section title="🛩️ Preferred Airlines" summary={airlines.join(', ')}>
              <label className="wsfb-label">Alert me for deals on…</label>
              <AirlineSelector selected={airlines} onChange={setAirlines} />
              <p className="wsfb-hint" style={{ marginTop: '0.5rem' }}>
                Leave &quot;Any airline&quot; selected to receive all deals.
              </p>
            </Section>

            {/* Hotel rating */}
            <Section title="🏨 Minimum Hotel Rating" summary={`${minStars}+ stars`}>
              <label className="wsfb-label">Only notify me for hotels rated at least…</label>
              <StarRating value={minStars} onChange={setMinStars} />
            </Section>

            {/* Action buttons */}
            <div className={styles.actions}>
              <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
                {saving ? '⏳ Saving…' : '💾 Save My Preferences'}
              </button>
              <button className={styles.unsubBtn} onClick={() => setShowUnsubModal(true)}>
                🚪 Unsubscribe from WeStayFlyBot
              </button>
            </div>
          </>
        )}
      </main>

      {/* ── FOOTER ───────────────────────────────────────────── */}
      <footer className="wsfb-footer">
        © 2025 WeStayFlyBot &nbsp;|&nbsp; <a href="/">Back to homepage</a>
      </footer>

      {/* ── UNSUBSCRIBE MODAL ────────────────────────────────── */}
      {showUnsubModal && (
        <div className={styles.modalOverlay} onClick={() => setShowUnsubModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalIcon}>😔</div>
            <h2>Are you sure?</h2>
            <p>
              You&apos;ll stop receiving all WeStayFlyBot deal alerts.
              You can always re-subscribe from the homepage.
            </p>
            <div className={styles.modalActions}>
              <button className={styles.modalCancel} onClick={() => setShowUnsubModal(false)}>
                Keep my alerts
              </button>
              <button className={styles.modalConfirm} onClick={handleUnsubscribe}>
                Yes, unsubscribe
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TOAST ────────────────────────────────────────────── */}
      <Toast message={toast.message} type={toast.type} />
    </>
  );
}
