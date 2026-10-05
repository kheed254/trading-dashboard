import { useState } from 'react';

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

/* ---------- Types ---------- */
type BlockType =
  | 'trade_params'
  | 'purchase'
  | 'sell'
  | 'restart';

type Block = {
  id: string;        // unique key
  type: BlockType;
  open: boolean;
  // trade_params state
  market?: string;
  tradeType?: string;
  contractType?: string;
  candleInterval?: string;
  // purchase state
  direction?: 'Rise' | 'Fall';
};

const BLOCK_LABELS: Record<BlockType, string> = {
  trade_params: 'Trade parameters',
  purchase: 'Purchase conditions',
  sell: 'Sell conditions',
  restart: 'Restart trading conditions',
};

let idCounter = 1;
const nextId = () => `block-${idCounter++}`;

const createBlock = (type: BlockType): Block => {
  const base: Block = { id: nextId(), type, open: true };

  if (type === 'trade_params') {
    base.market = 'Volatility 100 (1s) Index';
    base.tradeType = 'Up/Down › Rise/Fall';
    base.contractType = 'Both';
    base.candleInterval = '1 minute';
  }
  if (type === 'purchase') {
    base.direction = 'Rise';
  }
  return base;
};

/* ---------- Main page ---------- */
export default function BotBuilder() {
  /* Blocks on the canvas */
  const [blocks, setBlocks] = useState<Block[]>([
    createBlock('trade_params'),
    createBlock('purchase'),
    createBlock('sell'),
    createBlock('restart'),
  ]);

  /* Run state */
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [runs, setRuns] = useState(0);
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [stake, setStake] = useState(0);
  const [payout, setPayout] = useState(0);

  /* ---- block actions ---- */
  const addBlock = (type: BlockType) => {
    setBlocks((bs) => [...bs, createBlock(type)]);
  };

  const removeBlock = (id: string) => {
    setBlocks((bs) => bs.filter((b) => b.id !== id));
  };

  const toggleBlock = (id: string) => {
    setBlocks((bs) =>
      bs.map((b) => (b.id === id ? { ...b, open: !b.open } : b))
    );
  };

  const updateBlock = (id: string, patch: Partial<Block>) => {
    setBlocks((bs) =>
      bs.map((b) => (b.id === id ? { ...b, ...patch } : b))
    );
  };

  /* ---- run handler ---- */
  const handleRun = () => {
    if (isRunning) {
      setIsRunning(false);
      setProgress(0);
      return;
    }

    setIsRunning(true);
    setProgress(0);

    const startTime = Date.now();
    const duration = 5000;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, (elapsed / duration) * 100);
      setProgress(pct);

      if (pct >= 100) {
        clearInterval(interval);

        const stakeAmt = 1.0;
        const didWin = Math.random() > 0.45;
        const payoutAmt = didWin ? stakeAmt * 1.95 : 0;

        setStake((s) => s + stakeAmt);
        setPayout((p) => p + payoutAmt);
        setRuns((r) => r + 1);
        if (didWin) setWins((w) => w + 1);
        else setLosses((l) => l + 1);

        setIsRunning(false);
        setProgress(0);
      }
    }, 50);
  };

  const handleReset = () => {
    setRuns(0);
    setWins(0);
    setLosses(0);
    setStake(0);
    setPayout(0);
    setProgress(0);
    setIsRunning(false);
  };

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden">
      {/* ===== LEFT SIDEBAR ===== */}
      <aside className="w-64 shrink-0 border-r border-gray-200 bg-white flex flex-col">
        <button className="m-3 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm">
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

      {/* ===== CENTER CANVAS ===== */}
      <main className="flex-1 flex flex-col bg-gray-100 overflow-hidden">
        {/* Toolbar */}
        <div className="h-12 bg-white border-b border-gray-200 flex items-center gap-1 px-3 text-gray-500">
          {['↻', '📁', '💾', '📋', '↶', '↷', '⊞', '⊟', '🔍', '🔎'].map(
            (icon, i) => (
              <button
                key={i}
                className="w-8 h-8 rounded hover:bg-gray-100 flex items-center justify-center text-sm"
              >
                {icon}
              </button>
            )
          )}
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-auto p-6 relative">
          {blocks.length === 0 && (
            <div className="text-center text-gray-400 text-sm mt-24">
              No blocks on the canvas. <br />
              Click a block on the left to add it.
            </div>
          )}

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

          {/* Floating AI button */}
          <button className="fixed bottom-24 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 via-blue-500 to-teal-400 text-white font-bold text-lg shadow-lg flex items-center justify-center">
            AI
          </button>
        </div>
      </main>

      {/* ===== RIGHT PANEL ===== */}
      <aside className="w-80 shrink-0 border-l border-gray-200 bg-white flex flex-col">
        <div className="flex flex-col gap-2 px-3 pt-3">
          <div className="flex justify-end">
            <button
              onClick={handleRun}
              className={`${
                isRunning
                  ? 'bg-red-500 hover:bg-red-600'
                  : 'bg-teal-500 hover:bg-teal-600'
              } text-white text-sm font-semibold px-4 py-1.5 rounded transition`}
            >
              {isRunning ? '■ Stop' : '▶ Run'}
            </button>
          </div>
          {isRunning && (
            <div className="h-1 bg-gray-100 rounded overflow-hidden">
              <div
                className="h-full bg-teal-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>

        <div className="flex border-b border-gray-200 mt-3 text-sm">
          <button className="px-4 py-2 border-b-2 border-blue-600 text-blue-600 font-medium">
            Summary
          </button>
          <button className="px-4 py-2 text-gray-500 hover:text-gray-800">
            Transactions
          </button>
          <button className="px-4 py-2 text-gray-500 hover:text-gray-800">
            Journal
          </button>
        </div>

        <div className="flex-1 flex flex-col justify-center items-center text-center px-6 text-sm text-gray-500">
          {isRunning ? (
            <>
              <div className="text-navy font-semibold mb-2">Running…</div>
              <div className="text-xs">{Math.round(progress)}% complete</div>
            </>
          ) : runs === 0 ? (
            <>
              When you're ready to trade, hit{' '}
              <span className="font-semibold">Run</span>.
              <br />
              You'll be able to track your bot's performance here.
            </>
          ) : (
            <>
              <div className="text-navy font-semibold mb-2">Run complete</div>
              <div className="text-xs">
                {runs} run{runs !== 1 ? 's' : ''} · {wins} win
                {wins !== 1 ? 's' : ''} · {losses} loss
                {losses !== 1 ? 'es' : ''}
              </div>
            </>
          )}
        </div>

        <div className="border-t border-gray-200 p-4 text-xs grid grid-cols-3 gap-3 text-center">
          <Stat label="Total stake" value={`${stake.toFixed(2)} USD`} />
          <Stat label="Total payout" value={`${payout.toFixed(2)} USD`} />
          <Stat label="No. of runs" value={String(runs)} />
          <Stat label="Contracts lost" value={String(losses)} />
          <Stat label="Contracts won" value={String(wins)} />
          <Stat
            label="Total profit/loss"
            value={`${(payout - stake).toFixed(2)} USD`}
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
      {/* Header */}
      <button
        onClick={onToggle}
        className="bg-[#0b3d91] hover:bg-[#0a357f] text-white rounded-md px-3 py-2 text-sm font-semibold w-fit mb-2 flex items-center gap-2 transition"
      >
        <span>
          📋 {index}. {label}
        </span>
        <span className="text-xs opacity-80">{block.open ? '▾' : '▸'}</span>
      </button>

      {/* Body */}
      {block.open && (
        <div className="bg-white border-l-4 border-[#0b3d91] rounded-md p-4 mb-4 w-fit shadow-sm text-sm">
          {block.type === 'trade_params' && (
            <div className="space-y-3">
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
            </div>
          )}

          {block.type === 'restart' && (
            <span className="bg-gray-100 px-2 py-1 rounded text-gray-700">
              Trade again
            </span>
          )}
        </div>
      )}

      {/* Trash on hover */}
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
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-gray-500 font-medium">{label}</div>
      <div className="text-navy font-semibold mt-1">{value}</div>
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