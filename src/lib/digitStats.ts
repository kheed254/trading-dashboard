/* ---------- Digit statistics helpers ---------- */

export type DigitStat = {
  digit: number;      // 0..9
  count: number;
  pct: number;
};

export type EvenOddStats = {
  even: number;
  odd: number;
  evenPct: number;
  oddPct: number;
};

export type OverUnderStats = {
  under: number;
  equal: number;
  over: number;
  underPct: number;
  equalPct: number;
  overPct: number;
};

export type MatchDiffStats = {
  matches: number;
  differs: number;
  matchPct: number;
  differPct: number;
};

/** Extract last digit from a price. */
export function lastDigit(price: number): number {
  const s = price.toFixed(2); // e.g. "1234.56"
  return Number(s[s.length - 1]);
}

/** Distribution of digits 0-9 across a list. */
export function computeDigitStats(digits: number[]): DigitStat[] {
  const counts = new Array(10).fill(0);
  digits.forEach((d) => {
    if (d >= 0 && d <= 9) counts[d]++;
  });
  const total = digits.length || 1;
  return counts.map((c, i) => ({
    digit: i,
    count: c,
    pct: (c / total) * 100,
  }));
}

/** Even vs Odd split. */
export function computeEvenOdd(digits: number[]): EvenOddStats {
  let even = 0;
  let odd = 0;
  digits.forEach((d) => {
    if (d % 2 === 0) even++;
    else odd++;
  });
  const total = digits.length || 1;
  return {
    even,
    odd,
    evenPct: (even / total) * 100,
    oddPct: (odd / total) * 100,
  };
}

/** Under / Equal / Over for a threshold digit. */
export function computeOverUnder(
  digits: number[],
  threshold: number
): OverUnderStats {
  let under = 0;
  let equal = 0;
  let over = 0;
  digits.forEach((d) => {
    if (d < threshold) under++;
    else if (d === threshold) equal++;
    else over++;
  });
  const total = digits.length || 1;
  return {
    under,
    equal,
    over,
    underPct: (under / total) * 100,
    equalPct: (equal / total) * 100,
    overPct: (over / total) * 100,
  };
}

/** Matches vs Differs for a target digit. */
export function computeMatchDiff(
  digits: number[],
  target: number
): MatchDiffStats {
  let matches = 0;
  let differs = 0;
  digits.forEach((d) => {
    if (d === target) matches++;
    else differs++;
  });
  const total = digits.length || 1;
  return {
    matches,
    differs,
    matchPct: (matches / total) * 100,
    differPct: (differs / total) * 100,
  };
}

/** Find the digit with the highest percentage (most frequent). */
export function mostFrequent(stats: DigitStat[]): number {
  return stats.reduce((a, b) => (b.count > a.count ? b : a)).digit;
}

/** Find the digit with the lowest percentage (least frequent). */
export function leastFrequent(stats: DigitStat[]): number {
  return stats.reduce((a, b) => (b.count < a.count ? b : a)).digit;
}