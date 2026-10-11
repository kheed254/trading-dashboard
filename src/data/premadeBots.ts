import type { SavedBlock } from '../lib/storage';

export type PremadeBot = {
  id: string;
  name: string;
  description: string;
  rating: number; // 1-5
  isPremium: boolean;
  icon: string; // emoji
  category: 'free' | 'premium';
  // Template for generating blocks
  config: {
    market: string;
    tradeType: string;
    contractType: string;
    digitBarrier?: number;
    initialAmount: number;
    expectedProfit: number;
    stopLoss: number;
    martingaleLevel: number;
    durationType: string;
    durationValue: number;
    direction?: SavedBlock['direction'];
  };
};

export const PREMADE_BOTS: PremadeBot[] = [
  {
    id: 'dollarminer',
    name: 'Dollarminer',
    description: 'Dollarminer: automated trading with risk management and profit optimization.',
    rating: 5,
    isPremium: true,
    icon: '🐱',
    category: 'premium',
    config: {
      market: 'Volatility 100 (1s) Index',
      tradeType: 'Up/Down › Rise/Fall',
      contractType: 'Both',
      initialAmount: 1,
      expectedProfit: 20,
      stopLoss: 20,
      martingaleLevel: 2,
      durationType: 'Ticks',
      durationValue: 5,
      direction: 'Rise',
    },
  },
  {
    id: 'arctic-v2-pro',
    name: 'Arctic v2 Pro',
    description: 'Arctic v2 Pro: automated trading with risk management and profit optimization.',
    rating: 5,
    isPremium: true,
    icon: '🐱',
    category: 'premium',
    config: {
      market: 'Volatility 75 (1s) Index',
      tradeType: 'Digits › Even/Odd',
      contractType: 'Both',
      initialAmount: 0.5,
      expectedProfit: 15,
      stopLoss: 15,
      martingaleLevel: 1.5,
      durationType: 'Ticks',
      durationValue: 1,
      direction: 'Even',
    },
  },
  {
    id: 'pro-atlas',
    name: 'Pro Atlas',
    description: 'Pro Atlas: automated trading with risk management and profit optimization.',
    rating: 5,
    isPremium: true,
    icon: '🐱',
    category: 'premium',
    config: {
      market: 'Volatility 50 Index',
      tradeType: 'Digits › Over/Under',
      contractType: 'Over',
      digitBarrier: 5,
      initialAmount: 1,
      expectedProfit: 25,
      stopLoss: 25,
      martingaleLevel: 1.8,
      durationType: 'Ticks',
      durationValue: 1,
      direction: 'Over',
    },
  },
  {
    id: 'pro-nova',
    name: 'Pro Nova',
    description: 'Pro Nova: automated trading with risk management and profit optimization.',
    rating: 5,
    isPremium: true,
    icon: '🐱',
    category: 'premium',
    config: {
      market: 'Volatility 100 Index',
      tradeType: 'Digits › Matches/Differs',
      contractType: 'Differs',
      digitBarrier: 7,
      initialAmount: 0.35,
      expectedProfit: 30,
      stopLoss: 30,
      martingaleLevel: 1.05,
      durationType: 'Ticks',
      durationValue: 1,
      direction: 'Differs',
    },
  },
  {
    id: 'pro-orion',
    name: 'Pro Orion',
    description: 'Pro Orion: automated trading with risk management and profit optimization.',
    rating: 5,
    isPremium: true,
    icon: '🐱',
    category: 'premium',
    config: {
      market: 'Volatility 25 (1s) Index',
      tradeType: 'Up/Down › Rise/Fall',
      contractType: 'Rise only',
      initialAmount: 1,
      expectedProfit: 20,
      stopLoss: 20,
      martingaleLevel: 2,
      durationType: 'Ticks',
      durationValue: 3,
      direction: 'Rise',
    },
  },
  {
    id: 'pro-vega',
    name: 'Pro Vega',
    description: 'Pro Vega: automated trading with risk management and profit optimization.',
    rating: 5,
    isPremium: true,
    icon: '🐱',
    category: 'premium',
    config: {
      market: 'Volatility 10 (1s) Index',
      tradeType: 'Digits › Over/Under',
      contractType: 'Under',
      digitBarrier: 4,
      initialAmount: 0.5,
      expectedProfit: 15,
      stopLoss: 15,
      martingaleLevel: 1.5,
      durationType: 'Ticks',
      durationValue: 1,
      direction: 'Under',
    },
  },
  {
    id: 'pro-titan',
    name: 'Pro Titan',
    description: 'Pro Titan: automated trading with risk management and profit optimization.',
    rating: 5,
    isPremium: true,
    icon: '🐱',
    category: 'premium',
    config: {
      market: 'Volatility 30 (1s) Index',
      tradeType: 'Digits › Even/Odd',
      contractType: 'Odd',
      initialAmount: 1,
      expectedProfit: 25,
      stopLoss: 25,
      martingaleLevel: 1.8,
      durationType: 'Ticks',
      durationValue: 1,
      direction: 'Odd',
    },
  },
  {
    id: 'pro-zenith',
    name: 'Pro Zenith',
    description: 'Pro Zenith: automated trading with risk management and profit optimization.',
    rating: 5,
    isPremium: true,
    icon: '🐱',
    category: 'premium',
    config: {
      market: 'Volatility 100 (1s) Index',
      tradeType: 'Up/Down › Higher/Lower',
      contractType: 'Both',
      initialAmount: 0.35,
      expectedProfit: 10,
      stopLoss: 10,
      martingaleLevel: 1.05,
      durationType: 'Ticks',
      durationValue: 5,
      direction: 'Higher',
    },
  },
];

/* ---- Convert a premade bot config into actual SavedBlock[] ---- */
export function premadeBotToBlocks(bot: PremadeBot): SavedBlock[] {
  const now = Date.now();
  const { config } = bot;

  const tp: SavedBlock = {
    id: `premade-tp-${now}`,
    type: 'trade_params',
    open: true,
    market: config.market,
    tradeType: config.tradeType,
    contractType: config.contractType,
    digitBarrier: config.digitBarrier,
    candleInterval: '1 minute',
    restartBuySell: false,
    restartLastTrade: true,
    runOnceValues: {
      'Initial Amount': config.initialAmount,
      'Win Amount': config.initialAmount,
      'Expected Profit': config.expectedProfit,
      'Stop Loss': config.stopLoss,
      'Martingale Level': config.martingaleLevel,
    },
    durationType: config.durationType,
    durationValue: config.durationValue,
    stakeType: 'Initial Amount',
  };

  const purchase: SavedBlock = {
    id: `premade-purchase-${now}`,
    type: 'purchase',
    open: true,
    direction: config.direction ?? 'Rise',
  };

  const sell: SavedBlock = {
    id: `premade-sell-${now}`,
    type: 'sell',
    open: true,
  };

  const restart: SavedBlock = {
    id: `premade-restart-${now}`,
    type: 'restart',
    open: true,
  };

  return [tp, purchase, sell, restart];
}