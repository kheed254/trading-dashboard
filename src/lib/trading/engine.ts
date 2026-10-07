import type {
  Proposal,
  Trade,
  TradeType,
  OpenTradeResult,
  ContractStatus,
} from './types';

/* ---------- Config ---------- */

/** Payout multiplier for even/odd or rise/fall — 95% return on win. */
export const MULTIPLIER = 1.95;

/** Minimum stake allowed. */
export const MIN_STAKE = 0.35;

/** Maximum stake we accept in paper mode. */
export const MAX_STAKE = 1000;

/* ---------- Proposal ---------- */

/**
 * Given a stake, produce a proposal (what you'd get if you win).
 * Real Deriv would round payout based on the specific contract,
 * but for paper trading a flat 1.95x multiplier is realistic.
 */
export function createProposal(stake: number): Proposal {
  const s = Math.max(MIN_STAKE, stake);
  const payout = +(s * MULTIPLIER).toFixed(2);
  return {
    stake: +s.toFixed(2),
    payout,
    profit: +(payout - s).toFixed(2),
    multiplier: MULTIPLIER,
  };
}

/* ---------- Open a trade ---------- */

export type OpenTradeInput = {
  market: string;
  symbol: string;
  type: TradeType;
  direction: string;
  stake: number;
  ticks?: number;      // duration; defaults to 5
  entryPrice?: number;
};

let counter = 1;
const nextId = () => `t-${Date.now()}-${counter++}`;

/**
 * Create a trade in the "open" state with a fresh proposal.
 * Does not schedule settlement — the store handles that with setTimeout.
 */
export function openTrade(input: OpenTradeInput): OpenTradeResult {
  if (!input.stake || input.stake < MIN_STAKE) {
    return { ok: false, reason: `Minimum stake is ${MIN_STAKE}` };
  }
  if (input.stake > MAX_STAKE) {
    return { ok: false, reason: `Maximum stake is ${MAX_STAKE}` };
  }
  const proposal = createProposal(input.stake);

  const trade: Trade = {
    id: nextId(),
    market: input.market,
    symbol: input.symbol,
    type: input.type,
    direction: input.direction,
    stake: proposal.stake,
    payout: proposal.payout,
    status: 'open',
    ticks: input.ticks ?? 5,
    openedAt: Date.now(),
    entryPrice: input.entryPrice,
  };

  return { ok: true, trade };
}

/* ---------- Settle a trade ---------- */

/**
 * Decide win/loss for a trade when it closes.
 *
 * Paper trading uses a coin flip weighted by a small edge (55% win rate)
 * so that results feel realistic without being deterministic.
 *
 * When real trades are wired, this function will be replaced by a
 * subscription to Deriv's `proposal_open_contract` stream and simply
 * read the `status` and `profit` fields from that message.
 */
export function settleTrade(trade: Trade): Trade {
  const didWin = Math.random() < 0.55;

  const status: ContractStatus = didWin ? 'won' : 'lost';
  const profit = didWin
    ? +(trade.payout - trade.stake).toFixed(2)
    : -trade.stake;

  return {
    ...trade,
    status,
    profit,
    closedAt: Date.now(),
  };
}

/* ---------- Derived helpers ---------- */

/** Aggregate stats from a list of trades. */
export function computeStats(trades: Trade[]) {
  const closed = trades.filter((t) => t.status !== 'open');
  const totalPL = closed.reduce((s, t) => s + (t.profit ?? 0), 0);
  const wins = closed.filter((t) => t.status === 'won').length;
  const losses = closed.filter((t) => t.status === 'lost').length;
  const totalStake = closed.reduce((s, t) => s + t.stake, 0);
  const totalPayout = closed.reduce(
    (s, t) => s + (t.status === 'won' ? t.payout : 0),
    0
  );
  const winRate = closed.length > 0 ? (wins / closed.length) * 100 : 0;
  const best =
    closed.length > 0
      ? Math.max(...closed.map((t) => t.profit ?? 0))
      : 0;
  const worst =
    closed.length > 0
      ? Math.min(...closed.map((t) => t.profit ?? 0))
      : 0;

  return {
    totalTrades: closed.length,
    openTrades: trades.filter((t) => t.status === 'open').length,
    totalPL,
    totalStake,
    totalPayout,
    wins,
    losses,
    winRate,
    best,
    worst,
  };
}

/** How long a trade should run (in milliseconds) based on its ticks. */
export function tradeDurationMs(ticks: number): number {
  // Simulate ~1.5 seconds per tick, min 3s, max 15s
  const ms = ticks * 1500;
  return Math.min(15000, Math.max(3000, ms));
}