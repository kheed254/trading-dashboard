import { useEffect, useMemo, useState } from 'react';
import SignalCard from '../components/SignalCard';
import { useMultiTicks } from '../lib/deriv';
import { useAuthWs } from '../lib/auth-ws';

const signals = [
  {
    id: 1,
    symbol: '1HZ30V' as const,
    market: 'Volatility 30 (1s) Index',
    badge: 'Over 4',
    badgeColor: 'teal' as const,
    confidence: 54,
    stats: [
      { label: 'Even', value: '47.3%' },
      { label: 'Odd', value: '52.7%' },
      { label: 'Over 4', value: '53.9%' },
      { label: 'Under 5', value: '46.1%' },
    ],
    cta: 'Load Over 4 Signal',
    ctaColor: 'teal' as const,
  },
  {
    id: 2,
    symbol: '1HZ25V' as const,
    market: 'Volatility 25 (1s) Index',
    badge: 'Odd',
    badgeColor: 'gray' as const,
    confidence: 53,
    stats: [
      { label: 'Even', value: '47.5%' },
      { label: 'Odd', value: '52.5%' },
      { label: 'Over 4', value: '49.3%' },
      { label: 'Under 5', value: '50.7%' },
    ],
    cta: 'Load Odd Signal',
    ctaColor: 'red' as const,
  },
  {
    id: 3,
    symbol: '1HZ75V' as const,
    market: 'Volatility 75 (1s) Index',
    badge: 'Fall',
    badgeColor: 'gray' as const,
    confidence: 53,
    stats: [
      { label: 'Rise', value: '48.2%' },
      { label: 'Fall', value: '51.8%' },
      { label: 'Over 4', value: '50.1%' },
      { label: 'Under 5', value: '49.9%' },
    ],
    cta: 'Load Fall Signal',
    ctaColor: 'red' as const,
  },
  {
    id: 4,
    symbol: '1HZ10V' as const,
    market: 'Volatility 10 (1s) Index',
    badge: 'Even',
    badgeColor: 'gray' as const,
    confidence: 52,
    stats: [
      { label: 'Even', value: '52.1%' },
      { label: 'Odd', value: '47.9%' },
      { label: 'Over 4', value: '50.4%' },
      { label: 'Under 5', value: '49.6%' },
    ],
    cta: 'Load Even Signal',
    ctaColor: 'teal' as const,
  },
];

const filterPills = [
  { label: 'Load Bot', color: '#1a2b6d' },
  { label: 'Premium Bots', color: '#fbbf24' },
  { label: 'Free Bots', color: '#26b0a3' },
  { label: 'Analysis Tool', color: '#a855f7' },
];

export default function Dashboard() {
  const { authorized, user, error: authError } = useAuthWs();

  const { ticks, connected } = useMultiTicks([
    '1HZ30V',
    '1HZ25V',
    '1HZ75V',
    '1HZ10V',
  ]);

  /* Debug log while we verify the auth hook — safe to remove later */
  useEffect(() => {
    if (authorized && user) {
      console.log(
        '[StingerFX] Logged in as',
        user.loginid,
        '— balance:',
        user.balance,
        user.currency,
        user.isVirtual ? '(demo)' : '(real)'
      );
    }
    if (authError) {
      console.warn('[StingerFX] Auth error:', authError);
    }
  }, [authorized, user, authError]);

  return (
    <>
      {/* SEARCH BAR */}
      <div className="max-w-3xl mx-auto mt-8 px-4">
        <div className="flex items-center bg-white rounded-full shadow-sm border border-gray-200 overflow-hidden">
          <select className="bg-transparent px-4 py-3 text-sm text-gray-600 outline-none border-r border-gray-200">
            <option>All</option>
            <option>Volatility</option>
            <option>Boom/Crash</option>
          </select>
          <input
            type="text"
            placeholder="Search for a bot..."
            className="flex-1 px-4 py-3 text-sm outline-none"
          />
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* FILTER PILLS */}
      <div className="max-w-5xl mx-auto mt-6 px-4 flex flex-wrap justify-center gap-3">
        {filterPills.map((pill) => (
          <button
            key={pill.label}
            className="flex items-center gap-2 bg-white border-2 rounded-lg px-5 py-2.5 font-medium text-navy"
            style={{ borderColor: pill.color }}
          >
            <span
              className="w-4 h-4 rounded-sm"
              style={{ backgroundColor: pill.color }}
            />
            {pill.label}
          </button>
        ))}
      </div>

      {/* LIVE SIGNALS */}
      <main className="max-w-5xl mx-auto mt-8 mb-16 px-4 py-6 bg-teal-50/40 rounded-2xl">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                connected ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <h2 className="text-xl font-semibold text-navy">
              Live Trading Signals
            </h2>
          </div>
          <div className="text-sm text-gray-600">
            {connected ? '● live' : '○ offline'}
          </div>
        </div>
        <p className="text-sm text-gray-500 mb-5">
          {signals.length} live signals
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {signals.map((s) => {
            const tick = ticks[s.symbol];
            const livePrice = tick?.price ?? null;
            const history = tick?.history ?? [];

            let liveConfidence = s.confidence;
            if (history.length >= 5) {
              let ups = 0;
              for (let i = 1; i < history.length; i++) {
                if (history[i] > history[i - 1]) ups++;
              }
              liveConfidence = Math.round(
                (ups / (history.length - 1)) * 100
              );
            }

            return (
              <SignalCard
                key={s.id}
                {...s}
                confidence={liveConfidence}
                livePrice={livePrice}
              />
            );
          })}
        </div>
      </main>
    </>
  );
}