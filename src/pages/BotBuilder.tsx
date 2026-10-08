import { useEffect, useRef, useState } from 'react';
import { saveBot, loadBot, formatAgo } from '../lib/storage';
import QuickStrategyModal from '../components/QuickStrategyModal';
import { useAuthWs } from '../lib/auth-ws';

/* ---------- Option lists ---------- */
const MARKETS = [
  {
    group: 'Derived › Continuous Indices',
    options: [
      'Volatility 10 (1s) Index',
      'Volatility 25 (1s) Index',
      'Volatility 30 (1s) Index',
      'Volatility 50 (1s) Index',
      'Volatility 75 (1s) Index',
      'Volatility 100 (1s) Index',
    ],
  },
  {
    group: 'Derived › Daily Reset Indices',
    options: ['Bull Market Index', 'Bear Market Index'],
  },
  { group: 'Forex', options: ['EUR/USD', 'GBP/USD', 'USD/JPY'] },
  { group: 'Cryptocurrencies', options: ['BTC/USD', 'ETH/USD'] },
];

const TRADE_TYPES = [
  'Up/Down › Rise/Fall',
  'Up/Down › Higher/Lower',
  'Touch/No Touch',
  'In/Out › Ends Between/Outside',
  'Digits › Matches/Differs',
  'Digits › Even/Odd',
  'Digits › Over/Under',
];

const CONTRACT_TYPES = ['Both', 'Rise only', 'Fall only'];

const CANDLE_INTERVALS = [
  '1 minute',
  '2 minutes',
  '5 minutes',
  '15 minutes',
  '1 hour',
];

const RUN_ONCE_SET = [
  'Initial Amount',
  'Win Amount',
  'Expected Profit',
  'Stop Loss',
  'Martingale Level',
];

const RUN_ONCE_DEFAULTS: Record<string, string | number> = {
  'Initial Amount': 0.35,
  'Win Amount': 0.35,
  'Expected Profit': 7,
  'Stop Loss': 999,
  'Martingale Level': 1.05,
};

const DURATION_TYPES = ['Ticks', 'Seconds', 'Minutes', 'Hours', 'Days'];
const STAKE_TYPES = ['Initial Amount', 'Custom'];

const SYMBOL_MAP: Record<string, string> = {
  'Volatility 10 (1s) Index': '1HZ10V',
  'Volatility 25 (1s) Index': '1HZ25V',
  'Volatility 30 (1s) Index': '1HZ30V',
  'Volatility 50 (1s) Index': '1HZ50V',
  'Volatility 75 (1s) Index': '1HZ75V',
  'Volatility 100 (1s) Index': '1HZ100V',
  'Bull Market Index': 'BOOM1000',
  'Bear Market Index': 'CRASH1000',
  'EUR/USD': 'frxEURUSD',
  'GBP/USD': 'frxGBPUSD',
  'USD/JPY': 'frxUSDJPY',
  'BTC/USD': 'cryBTCUSD',
  'ETH/USD': 'cryETHUSD',
};

/* ---------- Types ---------- */
type BlockType = 'trade_params' | 'purchase' | 'sell' | 'restart';

type Block = {
  id: string;
  type: BlockType;
  open: boolean;
  market?: string;
  tradeType?: string;
  contractType?: string;
  candleInterval?: string;
  restartBuySell?: boolean;
  restartLastTrade?: boolean;
  runOnceValues?: Record<string, string | number>;
  durationType?: string;
  durationValue?: number;
  stakeType?: string;
  direction?: 'Rise' | 'Fall';
};

const BLOCK_LABELS: Record<BlockType, string> = {
  trade_params: 'Trade parameters',
  purchase: 'Purchase conditions',
  sell: 'Sell conditions',
  restart: 'Restart trading conditions',
};

let idCounter = 1;
const nextId = () => `block-${Date.now()}-${idCounter++}`;

const createBlock = (type: BlockType): Block => {
  const base: Block = { id: nextId(), type, open: true };
  if (type === 'trade_params') {
    base.market = 'Volatility 100 (1s) Index';
    base.tradeType = 'Up/Down › Rise/Fall';
    base.contractType = 'Both';
    base.candleInterval = '1 minute';
    base.restartBuySell = true;
    base.restartLastTrade = true;
    base.runOnceValues = { ...RUN_ONCE_DEFAULTS };
    base.durationType = 'Ticks';
    base.durationValue = 1;
    base.stakeType = 'Initial Amount';
  }
  if (type === 'purchase') base.direction = 'Rise';
  return base;
};

function resolveContractType(
  tradeType: string,
  direction: 'Rise' | 'Fall'
): { contractType: string; barrier?: string } {
  const t = tradeType.toLowerCase();
  if (t.includes('rise') || t.includes('fall'))
    return { contractType: direction === 'Rise' ? 'CALL' : 'PUT' };
  if (t.includes('higher')) return { contractType: 'CALLE' };
  if (t.includes('lower')) return { contractType: 'PUTE' };
  if (t.includes('touch')) return { contractType: 'ONETOUCH' };
  if (t.includes('no touch')) return { contractType: 'NOTOUCH' };
  if (t.includes('matches') || t.includes('differs'))
    return { contractType: 'DIGITDIFF', barrier: '5' };
  if (t.includes('even')) return { contractType: 'DIGITEVEN' };
  if (t.includes('odd')) return { contractType: 'DIGITODD' };
  if (t.includes('over')) return { contractType: 'DIGITOVER', barrier: '4' };
  if (t.includes('under')) return { contractType: 'DIGITUNDER', barrier: '5' };
  return { contractType: direction === 'Rise' ? 'CALL' : 'PUT' };
}

function resolveDuration(
  durationType: string,
  durationValue: number
): { duration: number; durationUnit: string } {
  switch (durationType) {
    case 'Ticks':
      return { duration: Math.max(1, durationValue), durationUnit: 't' };
    case 'Seconds':
      return { duration: Math.max(15, durationValue), durationUnit: 's' };
    case 'Minutes':
      return { duration: Math.max(1, durationValue), durationUnit: 'm' };
    case 'Hours':
      return { duration: Math.max(1, durationValue), durationUnit: 'h' };
    case 'Days':
      return { duration: Math.max(1, durationValue), durationUnit: 'd' };
    default:
      return { duration: Math.max(1, durationValue), durationUnit: 't' };
  }
}

/* ---------- Main component ---------- */
export default function BotBuilder() {
  const [blocks, setBlocks] = useState<Block[]>(() => {
    const saved = loadBot();
    if (saved && saved.blocks.length > 0) return saved.blocks as Block[];
    return [
      createBlock('trade_params'),
      createBlock('purchase'),
      createBlock('sell'),
      createBlock('restart'),
    ];
  });

  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const firstRun = useRef(true);
  const [showQuickStrategy, setShowQuickStrategy] = useState(false);

  const { authorized, placeTrade, openTrades } = useAuthWs();

  const [botRunning, setBotRunning] = useState(false);
  const botRunningRef = useRef(false);
  const [activeContractId, setActiveContractId] = useState<number | null>(null);

  const [botStats, setBotStats] = useState({
    runs: 0,
    wins: 0,
    losses: 0,
    totalStake: 0,
    totalPayout: 0,
    pl: 0,
  });

  const [currentStake, setCurrentStake] = useState<number | null>(null);
  const consecutiveLossesRef = useRef(0);

  const [botJournal, setBotJournal] = useState<
    { time: string; text: string; kind: string }[]
  >([]);

  const [detailTab, setDetailTab] = useState<
    'summary' | 'transactions' | 'journal'
  >('summary');

  const addJournal = (text: string, kind = 'info') => {
    setBotJournal((prev) =>
      [{ time: new Date().toLocaleTimeString(), text, kind }, ...prev].slice(
        0,
        100
      )
    );
  };

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    saveBot(blocks);
    setLastSavedAt(Date.now());
    setSavedFlash(true);
    const t = setTimeout(() => setSavedFlash(false), 800);
    return () => clearTimeout(t);
  }, [blocks]);

  useEffect(() => {
    botRunningRef.current = botRunning;
  }, [botRunning]);

  /* Watch closed contracts */
  useEffect(() => {
    if (!openTrades.length) return;
    openTrades.forEach((t) => {
      if (t.is_sold && t.contract_id === activeContractId) {
        const won = t.profit > 0;
        const baseStake = getBaseStake();
        const martLevel = getMartingaleLevel();

        setBotStats((prev) => ({
          runs: prev.runs,
          wins: won ? prev.wins + 1 : prev.wins,
          losses: !won ? prev.losses + 1 : prev.losses,
          totalStake: +(prev.totalStake + t.buy_price).toFixed(2),
          totalPayout: won
            ? +(prev.totalPayout + t.buy_price + t.profit).toFixed(2)
            : prev.totalPayout,
          pl: +(prev.pl + t.profit).toFixed(2),
        }));

        /* Martingale */
        if (won) {
          consecutiveLossesRef.current = 0;
          setCurrentStake(baseStake);
          addJournal(
            `✓ Won +$${t.profit.toFixed(2)} — stake reset to $${baseStake.toFixed(
              2
            )}`,
            'profit'
          );
        } else {
          consecutiveLossesRef.current += 1;
          const nextStake = +(t.buy_price * martLevel).toFixed(2);
          setCurrentStake(nextStake);
          addJournal(
            `✗ Lost -$${Math.abs(t.profit).toFixed(
              2
            )} — Martingale lvl ${
              consecutiveLossesRef.current
            }, next $${nextStake.toFixed(2)}`,
            'loss'
          );
        }

        setActiveContractId(null);

        /* ---- Take-profit check ---- */
        const tp = getTakeProfit();
        setBotStats((prev) => {
          if (tp > 0 && prev.pl >= tp) {
            if (botRunningRef.current) {
              setBotRunning(false);
              addJournal(
                `🎯 Take-profit hit (+$${prev.pl.toFixed(2)}) — bot stopped`,
                'profit'
              );
            }
          }
          return prev;
        });

        /* ---- Stop-loss check ---- */
        const sl = getStopLoss();
        setBotStats((prev) => {
          if (sl > 0 && sl < 900 && prev.pl <= -sl) {
            if (botRunningRef.current) {
              setBotRunning(false);
              addJournal(`Stop-loss hit ($${sl}) — bot stopped`, 'loss');
            }
          }
          return prev;
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openTrades, activeContractId]);

  const getTradeParams = () => blocks.find((b) => b.type === 'trade_params');
  const getPurchaseBlock = () => blocks.find((b) => b.type === 'purchase');

  const getStopLoss = (): number => {
    const tp = getTradeParams();
    const raw = tp?.runOnceValues?.['Stop Loss'];
    const val = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
    return isNaN(val) ? 0 : val;
  };

  const getTakeProfit = (): number => {
    const tp = getTradeParams();
    const raw = tp?.runOnceValues?.['Expected Profit'];
    const val = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
    return isNaN(val) ? 0 : val;
  };

  const getMartingaleLevel = (): number => {
    const tp = getTradeParams();
    const raw = tp?.runOnceValues?.['Martingale Level'];
    const val = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
    return isNaN(val) || val <= 1 ? 1 : val;
  };

  const getBaseStake = (): number => {
    const tp = getTradeParams();
    const raw = tp?.runOnceValues?.['Initial Amount'];
    const val = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
    return isNaN(val) || val <= 0 ? 0.35 : val;
  };

  const addBlock = (type: BlockType) =>
    setBlocks((bs) => [...bs, createBlock(type)]);
  const removeBlock = (id: string) =>
    setBlocks((bs) => bs.filter((b) => b.id !== id));
  const toggleBlock = (id: string) =>
    setBlocks((bs) =>
      bs.map((b) => (b.id === id ? { ...b, open: !b.open } : b))
    );
  const updateBlock = (id: string, patch: Partial<Block>) =>
    setBlocks((bs) =>
      bs.map((b) => (b.id === id ? { ...b, ...patch } : b))
    );

  const handleSave = () => {
    saveBot(blocks);
    setLastSavedAt(Date.now());
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 800);
  };

  const handleLoad = () => {
    const saved = loadBot();
    if (!saved || saved.blocks.length === 0) {
      alert('No saved bot found.');
      return;
    }
    setBlocks(saved.blocks as Block[]);
    setLastSavedAt(saved.savedAt);
  };

  const applyPreset = (presetId: string) => {
    const trade = createBlock('trade_params');
    const purchase = createBlock('purchase');
    const sell = createBlock('sell');
    const restart = createBlock('restart');
    switch (presetId) {
      case 'rise_fall':
        break;
      case 'even_odd':
        trade.tradeType = 'Digits › Even/Odd';
        break;
      case 'over_under':
        trade.tradeType = 'Digits › Over/Under';
        break;
      case 'matches_differs':
        trade.tradeType = 'Digits › Matches/Differs';
        break;
    }
    setBlocks([trade, purchase, sell, restart]);
  };

  const handleReset = () => {
    setBotStats({
      runs: 0,
      wins: 0,
      losses: 0,
      totalStake: 0,
      totalPayout: 0,
      pl: 0,
    });
    setBotJournal([]);
    setActiveContractId(null);
    consecutiveLossesRef.current = 0;
    setCurrentStake(null);
  };

  const placeOneTrade = () => {
    const tp = getTradeParams();
    const purchase = getPurchaseBlock();
    const market = tp?.market || 'Volatility 100 (1s) Index';
    const symbol = SYMBOL_MAP[market];
    if (!symbol) {
      addJournal(`Unknown market: ${market}`, 'loss');
      return;
    }
    const tradeType = tp?.tradeType || 'Up/Down › Rise/Fall';
    const direction = purchase?.direction || 'Rise';
    const { contractType, barrier } = resolveContractType(
      tradeType,
      direction
    );
    const durType = tp?.durationType || 'Ticks';
    const durVal = tp?.durationValue ?? 1;
    const { duration, durationUnit } = resolveDuration(durType, durVal);

    const baseStake = getBaseStake();
    const stake = currentStake ?? baseStake;

    addJournal(
      `Placing ${contractType} on ${symbol} — $${stake.toFixed(2)}${
        consecutiveLossesRef.current > 0
          ? ` (Martingale lvl ${consecutiveLossesRef.current})`
          : ''
      }`,
      'buy'
    );

    placeTrade({
      symbol,
      contractType,
      stake,
      duration,
      durationUnit,
      barrier,
    });

    setTimeout(() => {
      setBotStats((prev) => ({ ...prev, runs: prev.runs + 1 }));
    }, 500);
  };

  useEffect(() => {
    if (!botRunning) return;
    if (activeContractId) return;
    if (!authorized) return;

    const delay = setTimeout(() => {
      const newestOpen = openTrades.find((t) => !t.is_sold);
      if (newestOpen) {
        setActiveContractId(newestOpen.contract_id);
        return;
      }
      placeOneTrade();
      setTimeout(() => {
        const newest = openTrades.find((t) => !t.is_sold);
        if (newest) setActiveContractId(newest.contract_id);
      }, 1200);
    }, 900);

    return () => clearTimeout(delay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botRunning, activeContractId, authorized, openTrades]);

  const toggleRun = () => {
    if (!authorized) {
      alert('Please log in to run the bot.');
      return;
    }
    const next = !botRunning;
    if (next) {
      consecutiveLossesRef.current = 0;
      setCurrentStake(getBaseStake());
    }
    setBotRunning(next);
    addJournal(next ? 'Bot started' : 'Bot stopped by user', 'info');
  };

  /* ---------- render ---------- */
  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden">
      {/* LEFT SIDEBAR */}
      <aside className="w-64 shrink-0 border-r border-gray-200 bg-white flex flex-col">
        <button
          onClick={() => setShowQuickStrategy(true)}
          className="m-3 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm"
        >
          Quick strategy
        </button>

        <div className="px-4 py-2 text-sm font-semibold text-navy flex items-center justify-between border-b border-gray-100">
          Blocks menu
          <span className="text-gray-400">▲</span>
        </div>

        <div className="p-3 border-b border-gray-100">
          <input
            type="text"
            placeholder="🔍  Search"
            className="w-full text-sm px-3 py-2 border border-gray-200 rounded-md outline-none focus:border-blue-500"
          />
        </div>

        <nav className="flex-1 overflow-y-auto text-sm">
          {(
            [
              ['trade_params', 'Trade parameters'],
              ['purchase', 'Purchase conditions'],
              ['sell', 'Sell conditions (optional)'],
              ['restart', 'Restart trading conditions'],
            ] as [BlockType, string][]
          ).map(([type, label]) => (
            <button
              key={type}
              onClick={() => addBlock(type)}
              className="w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-blue-50 text-gray-700 flex items-center justify-between group"
            >
              <span>{label}</span>
              <span className="text-blue-500 opacity-0 group-hover:opacity-100 transition text-lg leading-none">
                +
              </span>
            </button>
          ))}
          <button className="w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 text-gray-700 flex justify-between items-center">
            Analysis <span className="text-gray-400">∨</span>
          </button>
          <button className="w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 text-gray-700 flex justify-between items-center">
            Utility <span className="text-gray-400">∨</span>
          </button>
        </nav>

        <div className="p-3 text-xs text-gray-400 border-t border-gray-100">
          Click a block to add it to the canvas
        </div>
      </aside>

      {/* CENTER CANVAS */}
      <main className="flex-1 flex flex-col bg-gray-100 overflow-hidden">
        <div className="h-12 bg-white border-b border-gray-200 flex items-center gap-1 px-3 text-gray-500">
          <button
            className="w-8 h-8 rounded hover:bg-gray-100 flex items-center justify-center text-sm"
            title="Reset blocks"
            onClick={() =>
              setBlocks([
                createBlock('trade_params'),
                createBlock('purchase'),
                createBlock('sell'),
                createBlock('restart'),
              ])
            }
          >
            ↻
          </button>
          <button
            className="w-8 h-8 rounded hover:bg-gray-100 flex items-center justify-center text-sm"
            title="Load"
            onClick={handleLoad}
          >
            📁
          </button>
          <button
            className="w-8 h-8 rounded hover:bg-gray-100 flex items-center justify-center text-sm"
            title="Save"
            onClick={handleSave}
          >
            💾
          </button>
          {['📋', '↶', '↷', '⊞', '⊟', '🔍', '🔎'].map((icon, i) => (
            <button
              key={i}
              className="w-8 h-8 rounded hover:bg-gray-100 flex items-center justify-center text-sm"
            >
              {icon}
            </button>
          ))}
          <div className="ml-auto text-xs">
            {savedFlash ? (
              <span className="text-green-600 font-medium">✓ saved</span>
            ) : lastSavedAt ? (
              <span className="text-gray-400">{formatAgo(lastSavedAt)}</span>
            ) : (
              <span className="text-gray-300">auto-save on</span>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6 relative pb-40">
          {blocks.map((b, i) => (
            <BlockRenderer
              key={b.id}
              block={b}
              index={i + 1}
              onToggle={() => toggleBlock(b.id)}
              onDelete={() => removeBlock(b.id)}
              onUpdate={(patch) => updateBlock(b.id, patch)}
            />
          ))}

          <button className="absolute bottom-6 right-6 w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 via-blue-500 to-teal-400 text-white font-bold text-lg shadow-lg flex items-center justify-center">
            AI
          </button>
        </div>
      </main>

      {/* RIGHT PANEL */}
      <aside className="w-80 shrink-0 border-l border-gray-200 bg-white flex flex-col">
        <div className="flex items-center gap-2 px-3 py-3 border-b border-gray-200">
          <button
            onClick={toggleRun}
            className={`${
              botRunning
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-teal-500 hover:bg-teal-600'
            } text-white text-sm font-semibold px-4 py-1.5 rounded transition shrink-0 flex items-center gap-1.5`}
          >
            {botRunning ? (
              <>
                <span className="w-3 h-3 bg-white/40 rounded-sm" />
                Stop
              </>
            ) : (
              <>▶ Run</>
            )}
          </button>
          <div className="flex-1 text-xs text-gray-500">
            {botRunning ? (
              <>
                <div className="flex justify-between mb-1">
                  <span>Bot is running…</span>
                  <span>72%</span>
                </div>
                <div className="h-1 bg-gray-100 rounded overflow-hidden">
                  <div
                    className="h-full bg-teal-500 transition-all"
                    style={{ width: '72%' }}
                  />
                </div>
              </>
            ) : (
              <div className="flex justify-between">
                <span>Bot is not running</span>
                <span>0% complete</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex border-b border-gray-200 text-sm">
          {(['summary', 'transactions', 'journal'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setDetailTab(k)}
              className={`flex-1 py-2.5 capitalize text-center text-sm ${
                detailTab === k
                  ? 'border-b-2 border-blue-600 text-blue-600 font-semibold'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {k === 'summary'
                ? 'Summary'
                : k === 'transactions'
                ? 'Transactions'
                : 'Journal'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {detailTab === 'summary' &&
            (() => {
              const active = openTrades.find(
                (t) => t.contract_id === activeContractId && !t.is_sold
              );
              const last = openTrades[0];
              const show = active || last;

              return (
                <div className="p-4">
                  {!show ? (
                    <div className="flex flex-col items-center justify-center text-center text-gray-400 text-xs h-full py-12">
                      {botRunning ? (
                        <>
                          <div className="text-navy text-sm font-semibold mb-2">
                            Placing first trade…
                          </div>
                          <div>Waiting for market data</div>
                        </>
                      ) : (
                        <>
                          When you're ready to trade, hit{' '}
                          <span className="font-semibold">Run</span>.
                          <br />
                          You'll be able to track your bot's performance
                          here.
                        </>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs text-gray-500">
                          {show.symbol}
                        </div>
                        <div
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            show.is_sold
                              ? show.profit > 0
                                ? 'bg-green-50 text-green-700'
                                : 'bg-red-50 text-red-700'
                              : 'bg-teal-50 text-teal-700'
                          }`}
                        >
                          {show.is_sold
                            ? show.profit > 0
                              ? 'WON'
                              : 'LOST'
                            : 'LIVE'}
                        </div>
                      </div>

                      <div className="text-sm font-semibold text-navy mb-3">
                        {show.contract_type}
                      </div>

                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-4">
                        <div
                          className={`h-full transition-all ${
                            show.is_sold
                              ? show.profit > 0
                                ? 'bg-green-500'
                                : 'bg-red-500'
                              : 'bg-teal-500 animate-pulse'
                          }`}
                          style={{
                            width: show.is_sold ? '100%' : '45%',
                          }}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs mb-4">
                        <div>
                          <div className="text-gray-500">Stake</div>
                          <div className="font-mono font-semibold text-navy mt-0.5">
                            {show.buy_price.toFixed(2)} USD
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-gray-500">
                            {show.is_sold ? 'Profit' : 'Payout'}
                          </div>
                          <div
                            className={`font-mono font-semibold mt-0.5 ${
                              show.is_sold
                                ? show.profit >= 0
                                  ? 'text-green-600'
                                  : 'text-red-600'
                                : 'text-navy'
                            }`}
                          >
                            {show.is_sold
                              ? `${show.profit >= 0 ? '+' : ''}${show.profit.toFixed(
                                  2
                                )}`
                              : show.payout.toFixed(2)}{' '}
                            USD
                          </div>
                        </div>
                      </div>

                      {consecutiveLossesRef.current > 0 && (
                        <div className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 mb-2">
                          Martingale level {consecutiveLossesRef.current} —
                          next stake $
                          {currentStake?.toFixed(2) ?? '—'}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })()}

          {detailTab === 'transactions' && (
            <div>
              <div className="flex gap-2 px-3 py-2 border-b border-gray-100">
                <button
                  disabled
                  className="text-[11px] px-3 py-1.5 rounded border border-gray-200 text-gray-400"
                >
                  Download
                </button>
                <button
                  disabled
                  className="text-[11px] px-3 py-1.5 rounded border border-gray-200 text-gray-700 font-medium"
                >
                  View Detail
                </button>
              </div>

              <div className="grid grid-cols-[80px_1fr_1fr] gap-2 px-3 py-2 text-[10px] text-gray-500 font-medium border-b border-gray-100">
                <div>Type</div>
                <div>Entry/Exit spot</div>
                <div className="text-right">Buy price and P/L</div>
              </div>

              {openTrades.length === 0 ? (
                <div className="text-center text-gray-400 text-xs py-10">
                  No transactions yet
                </div>
              ) : (
                <div>
                  {openTrades.map((t) => {
                    const won = t.is_sold && t.profit > 0;
                    const lost = t.is_sold && t.profit <= 0;
                    return (
                      <div
                        key={t.contract_id}
                        className="border-b border-gray-100 py-2"
                      >
                        <div className="grid grid-cols-[80px_1fr_1fr] gap-2 px-3 items-center">
                          <div className="flex items-center gap-1.5">
                            <span className="text-base leading-none">
                              {t.contract_type.includes('DIGIT')
                                ? '🔢'
                                : t.contract_type.includes('CALL') ||
                                  t.contract_type.includes('PUT')
                                ? '↕️'
                                : '📊'}
                            </span>
                            <span className="text-[11px] font-medium text-gray-700">
                              {t.contract_type}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 text-[11px]">
                            <span className="text-red-500 text-base leading-none">
                              ○
                            </span>
                            <span className="font-mono text-gray-700">
                              {t.entry_spot || '—'}
                            </span>
                          </div>

                          <div className="text-right text-[11px] font-mono text-gray-700">
                            {t.buy_price.toFixed(2)} USD
                          </div>
                        </div>

                        <div className="grid grid-cols-[80px_1fr_1fr] gap-2 px-3 items-center mt-1">
                          <div />
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <span className="text-gray-400 text-base leading-none">
                              ○
                            </span>
                            <span className="font-mono text-gray-700">
                              {t.is_sold ? t.current_spot || '—' : '…'}
                            </span>
                          </div>
                          <div
                            className={`text-right text-[11px] font-mono font-semibold ${
                              won
                                ? 'text-green-600'
                                : lost
                                ? 'text-red-600'
                                : 'text-gray-400'
                            }`}
                          >
                            {t.is_sold
                              ? `${t.profit >= 0 ? '+' : ''}${t.profit.toFixed(
                                  2
                                )} USD`
                              : 'open'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {detailTab === 'journal' && (
            <div className="p-3 text-xs">
              {botJournal.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  Journal empty
                </div>
              ) : (
                botJournal.map((j, i) => (
                  <div
                    key={i}
                    className="border-b border-gray-50 py-2 last:border-0"
                  >
                    <div className="text-[9px] text-gray-400 font-mono">
                      {j.time}
                    </div>
                    <div
                      className={`mt-0.5 ${
                        j.kind === 'profit'
                          ? 'text-green-600'
                          : j.kind === 'loss'
                          ? 'text-red-600'
                          : j.kind === 'buy'
                          ? 'text-navy'
                          : 'text-gray-500'
                      }`}
                    >
                      {j.text}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 p-4 text-xs grid grid-cols-3 gap-3 text-center">
          <Stat
            label="Total stake"
            value={`${botStats.totalStake.toFixed(2)} USD`}
          />
          <Stat
            label="Total payout"
            value={`${botStats.totalPayout.toFixed(2)} USD`}
          />
          <Stat label="No. of runs" value={String(botStats.runs)} />
          <Stat label="Contracts lost" value={String(botStats.losses)} />
          <Stat label="Contracts won" value={String(botStats.wins)} />
          <Stat
            label="Total profit/loss"
            value={`${botStats.pl.toFixed(2)} USD`}
            highlight={
              botStats.pl > 0 ? 'green' : botStats.pl < 0 ? 'red' : 'none'
            }
          />
        </div>

        <div className="p-3 border-t border-gray-200">
          <button
            onClick={handleReset}
            className="w-full border border-gray-300 rounded py-2 text-sm hover:bg-gray-50"
          >
            Reset
          </button>
        </div>
      </aside>

      <QuickStrategyModal
        open={showQuickStrategy}
        onClose={() => setShowQuickStrategy(false)}
        onSelect={applyPreset}
      />
    </div>
  );
}

/* ---------- Block renderer ---------- */
function BlockRenderer({
  block,
  index,
  onToggle,
  onDelete,
  onUpdate,
}: {
  block: Block;
  index: number;
  onToggle: () => void;
  onDelete: () => void;
  onUpdate: (patch: Partial<Block>) => void;
}) {
  const label = BLOCK_LABELS[block.type];

  return (
    <div className="group relative w-fit">
      <button
        onClick={onToggle}
        className="bg-[#0b3d91] hover:bg-[#0a357f] text-white rounded-t-md px-3 py-2 text-sm font-semibold w-fit flex items-center gap-2 transition"
      >
        <span>
          📋 {index}. {label}
        </span>
        <span className="text-xs opacity-80">{block.open ? '▾' : '▸'}</span>
      </button>

      {block.open && (
        <div className="bg-white border-l-4 border-[#0b3d91] rounded-b-md rounded-tr-md p-4 mb-4 w-fit shadow-sm text-sm">
          {block.type === 'trade_params' && (
            <div className="space-y-2">
              <SelectField
                label="Market"
                value={block.market ?? ''}
                onChange={(v) => onUpdate({ market: v })}
                groups={MARKETS}
              />
              <SelectField
                label="Trade Type"
                value={block.tradeType ?? ''}
                onChange={(v) => onUpdate({ tradeType: v })}
                options={TRADE_TYPES}
              />
              <SelectField
                label="Contract Type"
                value={block.contractType ?? ''}
                onChange={(v) => onUpdate({ contractType: v })}
                options={CONTRACT_TYPES}
              />
              <SelectField
                label="Default Candle Interval"
                value={block.candleInterval ?? ''}
                onChange={(v) => onUpdate({ candleInterval: v })}
                options={CANDLE_INTERVALS}
              />

              <CheckboxRow
                label="Restart buy/sell on error (disable for better performance):"
                checked={block.restartBuySell ?? true}
                onChange={(c) => onUpdate({ restartBuySell: c })}
              />
              <CheckboxRow
                label="Restart last trade on error (bot ignores the unsuccessful trade):"
                checked={block.restartLastTrade ?? true}
                onChange={(c) => onUpdate({ restartLastTrade: c })}
              />

              <SectionHeader label="Run once at start:" />
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="bg-gray-100 px-2 py-1 rounded">
                    Notify blue with sound: Sil…
                  </span>
                </div>
                {RUN_ONCE_SET.map((name) => {
                  const raw = block.runOnceValues?.[name];
                  const value =
                    raw !== undefined && raw !== ''
                      ? raw
                      : RUN_ONCE_DEFAULTS[name] ?? '';
                  return (
                    <div key={name} className="flex items-center gap-2">
                      <span className="text-gray-500 w-6">set</span>
                      <span className="bg-gray-100 px-2 py-1 rounded text-gray-700 w-40">
                        {name}
                      </span>
                      <span className="text-gray-500">to</span>
                      <input
                        type="text"
                        value={String(value)}
                        onChange={(e) =>
                          onUpdate({
                            runOnceValues: {
                              ...(block.runOnceValues ?? RUN_ONCE_DEFAULTS),
                              [name]: e.target.value,
                            },
                          })
                        }
                        className="bg-gray-100 px-2 py-1 rounded text-gray-700 outline-none w-24"
                      />
                    </div>
                  );
                })}
              </div>

              <SectionHeader label="Trade options:" />
              <div className="flex items-center gap-2">
                <span className="text-gray-500 w-20">Duration:</span>
                <select
                  value={block.durationType ?? 'Ticks'}
                  onChange={(e) =>
                    onUpdate({ durationType: e.target.value })
                  }
                  className="bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded text-gray-700 outline-none cursor-pointer"
                >
                  {DURATION_TYPES.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={block.durationValue ?? 1}
                  onChange={(e) =>
                    onUpdate({ durationValue: Number(e.target.value) })
                  }
                  className="bg-gray-100 px-2 py-1 rounded text-gray-700 outline-none w-20"
                />
                <span className="text-gray-500 ml-3 w-14">Stake:</span>
                <span className="bg-gray-100 px-2 py-1 rounded text-gray-700">
                  USD
                </span>
                <select
                  value={block.stakeType ?? 'Initial Amount'}
                  onChange={(e) => onUpdate({ stakeType: e.target.value })}
                  className="bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded text-gray-700 outline-none cursor-pointer"
                >
                  {STAKE_TYPES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {block.type === 'purchase' && (
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Purchase</span>
              <select
                value={block.direction ?? 'Rise'}
                onChange={(e) =>
                  onUpdate({
                    direction: e.target.value as 'Rise' | 'Fall',
                  })
                }
                className="bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded text-gray-700 outline-none cursor-pointer"
              >
                <option value="Rise">Rise</option>
                <option value="Fall">Fall</option>
              </select>
            </div>
          )}

          {block.type === 'sell' && (
            <div className="flex items-center gap-2">
              <span className="text-gray-500">if</span>
              <span className="bg-gray-100 px-2 py-1 rounded text-gray-700">
                Sell is available
              </span>
              <span className="text-gray-500">then</span>
              <button className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center">
                +
              </button>
            </div>
          )}

          {block.type === 'restart' && (
            <span className="bg-gray-100 px-2 py-1 rounded text-gray-700">
              Trade again
            </span>
          )}
        </div>
      )}

      <button
        onClick={onDelete}
        title="Delete block"
        className="absolute top-1 -right-10 opacity-0 group-hover:opacity-100 transition text-gray-400 hover:text-red-500 text-lg"
      >
        🗑
      </button>
    </div>
  );
}

/* ---------- Small components ---------- */
function Stat({
  label,
  value,
  highlight = 'none',
}: {
  label: string;
  value: string;
  highlight?: 'none' | 'green' | 'red';
}) {
  const color =
    highlight === 'green'
      ? 'text-green-600'
      : highlight === 'red'
      ? 'text-red-600'
      : 'text-navy';
  return (
    <div>
      <div className="text-gray-500 font-medium text-[10px]">{label}</div>
      <div className={`font-semibold mt-1 ${color}`}>{value}</div>
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="bg-[#0b3d91] text-white text-xs font-semibold px-3 py-1.5 rounded-sm -mx-4 mt-3 mb-2 w-[calc(100%+2rem)]">
      {label}
    </div>
  );
}

function CheckboxRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (c: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="text-gray-500 text-xs">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-blue-600 cursor-pointer"
      />
    </div>
  );
}

type OptionGroup = { group: string; options: string[] };
type SelectFieldProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options?: string[];
  groups?: OptionGroup[];
};

function SelectField({
  label,
  value,
  onChange,
  options,
  groups,
}: SelectFieldProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-gray-500 w-44 shrink-0">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-gray-100 hover:bg-gray-200 transition px-2 py-1 rounded text-gray-700 outline-none cursor-pointer max-w-md"
      >
        {groups
          ? groups.map((g) => (
              <optgroup key={g.group} label={g.group}>
                {g.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </optgroup>
            ))
          : options?.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
      </select>
    </div>
  );
}