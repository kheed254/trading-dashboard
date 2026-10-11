/* ================================================================
   Market Scanner
   - Fetches last N ticks for each market via Deriv public WebSocket
   - Computes digit distribution, hottest/coldest/missing digits, streaks
   - Computes AI Score, Win Rate, Recent %, Samples
   - Returns the market with the highest AI Score
   ================================================================ */

const DERIV_WS_URL = 'wss://api.derivws.com/trading/v1/options/ws/public';

export type ScanMode = {
  over: number;
  under: number;
};

export type MarketResult = {
  market: string;
  symbol: string;
  aiScore: number;
  winRate: number;
  recent: number;
  samples: number;
  hottestDigit: number;
  coldestDigit: number;
  missingDigit: number;
  lowStreak: number;
  highStreak: number;
  tradeTypeLabel: string;
};

export type ScanProgress = {
  index: number;
  total: number;
  currentMarket: string;
};

/* ---------- Fetch last N ticks for one symbol ---------- */
function fetchTicks(symbol: string, count: number): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(DERIV_WS_URL);
    let closed = false;

    const cleanup = () => {
      if (closed) return;
      closed = true;
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ forget_all: 'ticks' }));
        }
      } catch {}
      // Small delay before closing to let Deriv release the connection cleanly
      setTimeout(() => {
        try { ws.close(); } catch {}
      }, 200);
    };

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout fetching ${symbol}`));
    }, 15000);

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          ticks_history: symbol,
          adjust_start_time: 1,
          count,
          end: 'latest',
          style: 'ticks',
        })
      );
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.msg_type === 'history' && data.history) {
          clearTimeout(timer);
          const prices: (string | number)[] = data.history.prices || [];
          const digits = prices.map((p) => {
            const s = typeof p === 'number' ? p.toFixed(2) : String(p);
            const lastChar = s[s.length - 1];
            return Number(lastChar);
          }).filter((d) => !isNaN(d) && d >= 0 && d <= 9);
          cleanup();
          resolve(digits);
          return;
        }
        if (data.error) {
          clearTimeout(timer);
          cleanup();
          reject(new Error(data.error.message || `Error for ${symbol}`));
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onerror = () => {
      clearTimeout(timer);
      cleanup();
      reject(new Error(`WebSocket error for ${symbol}`));
    };

    ws.onclose = () => {
      if (!closed) {
        closed = true;
        clearTimeout(timer);
      }
    };
  });
}

/* ---------- Compute stats for a single market's digits ---------- */
function computeStats(digits: number[], mode: ScanMode): Omit<MarketResult, 'market' | 'symbol'> {
  const total = digits.length || 1;

  // Digit frequency
  const counts = Array(10).fill(0);
  digits.forEach((d) => { if (d >= 0 && d <= 9) counts[d]++; });
  const pcts = counts.map((c) => (c / total) * 100);

  // Hottest, coldest, missing
  let hottestDigit = 0, coldestDigit = 0, missingDigit = -1;
  let maxPct = -1, minPct = 101;
  for (let i = 0; i < 10; i++) {
    if (pcts[i] > maxPct) { maxPct = pcts[i]; hottestDigit = i; }
    if (pcts[i] < minPct) { minPct = pcts[i]; coldestDigit = i; }
    if (counts[i] === 0) missingDigit = i;
  }

  // Over/Under stats (based on mode)
  const isOver = (d: number) => d > mode.over;
  const isUnder = (d: number) => d < mode.under;

  const overCount = digits.filter(isOver).length;
  const underCount = digits.filter(isUnder).length;
  const aiScore = Math.max(overCount, underCount) / total * 100;

  // Win rate: last 500 ticks
  const last500 = digits.slice(-500);
  const winRate = last500.length
    ? Math.max(last500.filter(isOver).length, last500.filter(isUnder).length) / last500.length * 100
    : 0;

  // Recent: last 100 ticks
  const last100 = digits.slice(-100);
  const recent = last100.length
    ? Math.max(last100.filter(isOver).length, last100.filter(isUnder).length) / last100.length * 100
    : 0;

  // Streaks: highest and lowest consecutive digits
  let lowStreak = 0, highStreak = 0;
  let curLow = 0, curHigh = 0;
  digits.forEach((d) => {
    if (d <= 3) { curLow++; highStreak = Math.max(highStreak, curHigh); curHigh = 0; }
    else if (d >= 7) { curHigh++; lowStreak = Math.max(lowStreak, curLow); curLow = 0; }
    else { lowStreak = Math.max(lowStreak, curLow); highStreak = Math.max(highStreak, curHigh); curLow = 0; curHigh = 0; }
  });
  lowStreak = Math.max(lowStreak, curLow);
  highStreak = Math.max(highStreak, curHigh);

  // Trade type label
  const tradeTypeLabel = `Over ${mode.over} Recovery Over ${mode.under - 3 > mode.over ? mode.under - 3 : mode.over + 1}`;

  return {
    aiScore,
    winRate,
    recent,
    samples: digits.length,
    hottestDigit,
    coldestDigit,
    missingDigit: missingDigit >= 0 ? missingDigit : coldestDigit,
    lowStreak,
    highStreak,
    tradeTypeLabel,
  };
}

/* ---------- Main scan function ---------- */
export async function scanMarkets(
  markets: { name: string; symbol: string }[],
  mode: ScanMode,
  ticksPerMarket: number,
  onProgress: (progress: ScanProgress) => void
): Promise<{ best: MarketResult | null; all: MarketResult[] }> {
  const all: MarketResult[] = [];

  for (let i = 0; i < markets.length; i++) {
    const m = markets[i];
    onProgress({ index: i + 1, total: markets.length, currentMarket: m.name });

    // Delay before each scan (except the first one) to avoid rate limiting
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    try {
      const digits = await fetchTicks(m.symbol, ticksPerMarket);
      if (digits.length >= 50) {
        const stats = computeStats(digits, mode);
        all.push({ market: m.name, symbol: m.symbol, ...stats });
      } else {
        console.warn(`[Scanner] ${m.name}: only ${digits.length} ticks returned, skipping`);
      }
    } catch (err) {
      console.warn(`[Scanner] Skipped ${m.name}:`, err);
    }
  }

  // Sort by AI score descending
  all.sort((a, b) => b.aiScore - a.aiScore);

  return { best: all[0] ?? null, all };
}