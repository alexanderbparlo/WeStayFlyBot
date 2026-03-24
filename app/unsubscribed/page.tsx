'use client';
// app/unsubscribed/page.tsx
// Confirmation page shown after a subscriber clicks the one-click unsubscribe link.

import styles from '../page.module.css';

export default function UnsubscribedPage() {
  return (
    <>
      <header className="wsfb-header">
        <div className="wsfb-header-inner" style={{ textAlign: 'center' }}>
          <div className={styles.logoRow}>
            <span className={styles.logoIcon}>✈️</span>
            <span className={styles.logoText}>WeStayFlyBot</span>
          </div>
        </div>
      </header>

      <section className={styles.formSection}>
        <div className={styles.formCard} style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <div className={styles.successIcon}>👋</div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', marginBottom: '0.6rem' }}>
            You&apos;ve been unsubscribed
          </h2>
          <p style={{ color: 'var(--warm-gray)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
            You won&apos;t receive any more deal alerts from WeStayFlyBot.
            Changed your mind? You can always re-subscribe below.
          </p>
          <a href="/" className={styles.manageLink} style={{ fontSize: '1rem' }}>
            Re-subscribe anytime →
          </a>
        </div>
      </section>

      <footer className="wsfb-footer">
        © 2025 WeStayFlyBot &nbsp;|&nbsp; <a href="/">Back to homepage</a>
      </footer>
    </>
  );
}
