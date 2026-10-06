import { useState } from 'react';

export default function MartingaleCalculator() {
  const [capital, setCapital] = useState<number | ''>('');

  const capitalNum = typeof capital === 'number' ? capital : 0;

  // 2% of capital = initial stake
  const stake = capitalNum * 0.02;

  // Take profit = 5x stake
  const takeProfit = stake * 5;

  // Stop loss = sum of 4 consecutive martingale losses
  // Using a 2x martingale multiplier: stake * (1 + 2 + 4 + 8) = stake * 15
  const stopLoss = stake * (1 + 2 + 4 + 8);

  return (
    <div className="min-h-[60vh] flex items-center justify-center py-10">
      <div className="bg-[#0f1e3d] rounded-2xl p-10 max-w-xl w-full shadow-2xl">
        {/* Glowing title */}
        <h1
          className="text-2xl font-bold text-center tracking-wide mb-10"
          style={{
            color: '#7dd3fc',
            textShadow:
              '0 0 10px #38bdf8, 0 0 20px rgba(56,189,248,0.5), 0 0 40px rgba(56,189,248,0.25)',
          }}
        >
          MARTINGALE CALCULATOR
        </h1>

        {/* Initial Capital input */}
        <div className="mb-6">
          <label className="block text-sm text-gray-300 mb-2">
            Initial Capital (₹):
          </label>
          <input
            type="number"
            value={capital}
            onChange={(e) => {
              const v = e.target.value;
              setCapital(v === '' ? '' : Number(v));
            }}
            placeholder="Enter capital"
            className="w-full rounded-lg bg-[#1a2f52] border border-[#2b4574] text-white px-4 py-3 placeholder:text-gray-500 outline-none focus:border-sky-400 transition"
          />
        </div>

        {/* Stake */}
        <OutputRow
          label="Stake (2% of Capital):"
          value={stake}
        />

        {/* Take Profit */}
        <OutputRow
          label="Take Profit (5x Stake):"
          value={takeProfit}
        />

        {/* Stop Loss */}
        <OutputRow
          label="Stop Loss (4 Losses Sum):"
          value={stopLoss}
        />
      </div>
    </div>
  );
}

function OutputRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between bg-[#16283f] border border-[#2b4574] rounded-lg px-4 py-4 mb-4">
      <span className="text-sm text-gray-300">{label}</span>
      <span className="text-lg font-semibold text-sky-300 font-mono">
        {value.toFixed(2)}
      </span>
    </div>
  );
}