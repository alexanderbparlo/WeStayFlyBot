'use client';
// app/components/AirportSearch.tsx
// Reusable airport/city search field with multi-select tags.
// Used by both the subscribe page and manage preferences page.

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Airport, AIRPORTS, haversine, searchAirportsByCity, searchRoadtripCities } from '@/lib/airport-data';

// ─── AIRPORT SEARCH ──────────────────────────────────────────────────────────

interface AirportSearchProps {
  selected: Airport[];
  onChange: (airports: Airport[]) => void;
  placeholder?: string;
  label: string;
  hint?: string;
}

export function AirportSearch({ selected, onChange, placeholder, label, hint }: AirportSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Airport[]>([]);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleInput = useCallback((val: string) => {
    setQuery(val);
    const found = searchAirportsByCity(val);
    setResults(found);
    setOpen(found.length > 0 && val.length >= 2);
  }, []);

  const toggle = useCallback((airport: Airport) => {
    const already = selected.some(a => a.code === airport.code);
    onChange(already ? selected.filter(a => a.code !== airport.code) : [...selected, airport]);
  }, [selected, onChange]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Compute nearby airports (within 100 mi) for each selected airport, excluding already-selected ones
  const nearbySuggestions = useMemo(() => {
    if (!selected.length) return [];
    const shownCodes = new Set(selected.map(s => s.code));
    const suggestions: (Airport & { dist: number; nearTo: string })[] = [];

    for (const sel of selected) {
      for (const airport of AIRPORTS) {
        if (shownCodes.has(airport.code)) continue;
        const dist = haversine(sel.lat, sel.lon, airport.lat, airport.lon);
        if (dist > 0 && dist <= 100) {
          shownCodes.add(airport.code); // avoid duplicates across multiple selections
          suggestions.push({ ...airport, dist, nearTo: sel.code });
        }
      }
    }

    return suggestions.sort((a, b) => a.dist - b.dist).slice(0, 6);
  }, [selected]);

  return (
    <div className="wsfb-field-group">
      <label className="wsfb-label">{label}</label>
      <div className="wsfb-search-wrap">
        <span className="wsfb-search-icon">🔍</span>
        <input
          ref={inputRef}
          type="text"
          className="wsfb-search-input"
          placeholder={placeholder ?? 'Search cities…'}
          value={query}
          onChange={e => handleInput(e.target.value)}
          onFocus={() => { if (results.length && query.length >= 2) setOpen(true); }}
          autoComplete="off"
        />
        {open && (
          <div className="wsfb-dropdown" ref={dropdownRef}>
            {results.map(airport => {
              const isSel = selected.some(a => a.code === airport.code);
              return (
                <div
                  key={airport.code}
                  className={`wsfb-dropdown-item${isSel ? ' selected' : ''}`}
                  onMouseDown={e => { e.preventDefault(); toggle(airport); }}
                >
                  <span className="wsfb-airport-code">{airport.code}</span>
                  <span className="wsfb-airport-detail">
                    <div className="wsfb-airport-name">{airport.name}</div>
                    <div className="wsfb-airport-city">
                      {airport.city}{airport.state ? `, ${airport.state}` : ''}
                      {airport.dist ? ` · ${Math.round(airport.dist)} mi` : ''}
                    </div>
                  </span>
                  {isSel && <span className="wsfb-check">✓</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selected.length > 0 && (
        <div className="wsfb-tag-list">
          {selected.map(a => (
            <span key={a.code} className="wsfb-tag">
              {a.code} · {a.city}
              <button
                className="wsfb-tag-remove"
                onClick={() => onChange(selected.filter(x => x.code !== a.code))}
                aria-label={`Remove ${a.code}`}
              >×</button>
            </span>
          ))}
        </div>
      )}

      {nearbySuggestions.length > 0 && (
        <div className="wsfb-nearby-wrap">
          <span className="wsfb-nearby-label">📍 Nearby airports within 100 mi:</span>
          <div className="wsfb-nearby-list">
            {nearbySuggestions.map(a => (
              <button
                key={a.code}
                type="button"
                className="wsfb-nearby-pill"
                onClick={() => onChange([...selected, a])}
                title={`${a.name} · ${Math.round(a.dist)} mi from ${a.nearTo}`}
              >
                + {a.code}
                <span className="wsfb-nearby-dist">{Math.round(a.dist)} mi</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {hint && <p className="wsfb-hint">{hint}</p>}
    </div>
  );
}

// ─── ROAD TRIP CITY SEARCH ───────────────────────────────────────────────────

interface RoadtripSearchProps {
  selected: string[];
  onChange: (cities: string[]) => void;
  label: string;
  hint?: string;
}

export function RoadtripSearch({ selected, onChange, label, hint }: RoadtripSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleInput = useCallback((val: string) => {
    setQuery(val);
    const found = searchRoadtripCities(val);
    setResults(found);
    setOpen(found.length > 0 && val.length >= 2);
  }, []);

  const toggle = useCallback((city: string) => {
    const already = selected.includes(city);
    onChange(already ? selected.filter(c => c !== city) : [...selected, city]);
  }, [selected, onChange]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="wsfb-field-group">
      <label className="wsfb-label">{label}</label>
      <div className="wsfb-search-wrap">
        <span className="wsfb-search-icon">🔍</span>
        <input
          ref={inputRef}
          type="text"
          className="wsfb-search-input"
          placeholder="e.g. Asheville, Sedona, Nashville…"
          value={query}
          onChange={e => handleInput(e.target.value)}
          onFocus={() => { if (results.length && query.length >= 2) setOpen(true); }}
          autoComplete="off"
        />
        {open && (
          <div className="wsfb-dropdown" ref={dropdownRef}>
            {results.map(city => {
              const isSel = selected.includes(city);
              return (
                <div
                  key={city}
                  className={`wsfb-dropdown-item${isSel ? ' selected' : ''}`}
                  onMouseDown={e => { e.preventDefault(); toggle(city); }}
                >
                  <span>🚗</span>
                  <span className="wsfb-airport-name">{city}</span>
                  {isSel && <span className="wsfb-check">✓</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selected.length > 0 && (
        <div className="wsfb-tag-list">
          {selected.map(city => (
            <span key={city} className="wsfb-tag roadtrip">
              🚗 {city}
              <button
                className="wsfb-tag-remove"
                onClick={() => onChange(selected.filter(c => c !== city))}
                aria-label={`Remove ${city}`}
              >×</button>
            </span>
          ))}
        </div>
      )}

      {hint && <p className="wsfb-hint">{hint}</p>}
    </div>
  );
}

// ─── DESTINATION PANEL ───────────────────────────────────────────────────────
// Combines flight + road trip destination inputs behind a tab toggle.

interface DestinationPanelProps {
  flightDests: Airport[];
  roadDests: string[];
  onFlightChange: (airports: Airport[]) => void;
  onRoadChange: (cities: string[]) => void;
}

export function DestinationPanel({
  flightDests, roadDests, onFlightChange, onRoadChange,
}: DestinationPanelProps) {
  const [activeTab, setActiveTab] = useState<'flight' | 'road'>('flight');

  return (
    <>
      <div className="wsfb-dest-tabs">
        <button
          className={`wsfb-dest-tab${activeTab === 'flight' ? ' active-flight' : ''}`}
          onClick={() => setActiveTab('flight')}
          type="button"
        >
          ✈️ Flight Destination
        </button>
        <button
          className={`wsfb-dest-tab${activeTab === 'road' ? ' active-road' : ''}`}
          onClick={() => setActiveTab('road')}
          type="button"
        >
          🚗 Road Trip Destination
        </button>
      </div>

      {activeTab === 'flight' && (
        <AirportSearch
          label="Flight destination airports"
          placeholder="e.g. Miami, Denver, Cancún…"
          selected={flightDests}
          onChange={onFlightChange}
          hint="Flight + hotel deals are evaluated together for these destinations."
        />
      )}

      {activeTab === 'road' && (
        <RoadtripSearch
          label="Road trip destination cities"
          selected={roadDests}
          onChange={onRoadChange}
          hint="Only hotel prices tracked — no flight required."
        />
      )}
    </>
  );
}

// ─── AIRLINE SELECTOR ────────────────────────────────────────────────────────

interface AirlineSelectorProps {
  selected: string[];
  onChange: (airlines: string[]) => void;
}

export function AirlineSelector({ selected, onChange }: AirlineSelectorProps) {
  const AIRLINES = [
    'Any airline', 'American', 'Delta', 'United', 'Southwest', 'JetBlue',
    'Alaska', 'Spirit', 'Frontier', 'Allegiant', 'Hawaiian', 'Sun Country',
  ];

  const toggle = (airline: string) => {
    if (airline === 'Any airline') { onChange(['Any airline']); return; }
    const without = selected.filter(a => a !== 'Any airline');
    const already = without.includes(airline);
    const next = already ? without.filter(a => a !== airline) : [...without, airline];
    onChange(next.length === 0 ? ['Any airline'] : next);
  };

  return (
    <div className="wsfb-airline-grid">
      {AIRLINES.map(airline => {
        const isSel = selected.includes(airline);
        const isAny = airline === 'Any airline';
        return (
          <button
            key={airline}
            type="button"
            className={`wsfb-airline-pill${isSel ? (isAny ? ' any-selected' : ' selected') : ''}`}
            onClick={() => toggle(airline)}
          >
            {airline}
          </button>
        );
      })}
    </div>
  );
}

// ─── STAR RATING ─────────────────────────────────────────────────────────────

interface StarRatingProps {
  value: number;
  onChange: (stars: number) => void;
}

export function StarRating({ value, onChange }: StarRatingProps) {
  return (
    <div className="wsfb-star-row">
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          type="button"
          className={`wsfb-star-btn${i > value ? ' dim' : ''}`}
          title={`${i}+ stars minimum`}
          onClick={() => onChange(i)}
        >
          ⭐
        </button>
      ))}
      <span className="wsfb-star-label">{value}+ stars</span>
    </div>
  );
}
