/* ---------- Trade types ---------- */

export type TradeType =
  | 'rise_fall'
  | 'even_odd'
  | 'over_under'
  | 'matches_differs'
  | 'digits';

export type ContractStatus = 'open' | 'won' | 'lost';

export type Trade = {
  id: string;
  market: string;          // e.g. "Volatility 100 (1s) Index"
  symbol: string;          // e.g. "1HZ100V"
  type: TradeType;
  direction: string;       // e.g. "Rise", "Over 4", "Even", "Matches 5"
  stake: number;           // e.g. 10
  payout: number;          // potential payout (stake × multiplier)
  status: ContractStatus;
  ticks: number;           // duration in ticks
  openedAt: number;        // epoch ms
  closedAt?: number;       // epoch ms
  profit?: number;         // only set on close (payout - stake for wins, -stake for losses)
  entryPrice?: number;     // last price at open (for real trades later)
  exitPrice?: number;      // last price at close
};

export type Proposal = {
  stake: number;
  payout: number;
  profit: number;          // payout - stake
  multiplier: number;
};

/** Result from the engine when a trade is opened. */
export type OpenTradeResult =
  | { ok: true; trade: Trade }
  | { ok: false; reason: string };