type Preset = {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
};

const PRESETS: Preset[] = [
  {
    id: 'rise_fall',
    name: 'Rise / Fall',
    description: 'Classic Up/Down strategy on any Volatility index.',
    icon: '📈',
    color: '#26b0a3',
  },
  {
    id: 'even_odd',
    name: 'Even / Odd',
    description: 'Bet on the last digit being even or odd.',
    icon: '⚖️',
    color: '#3b82f6',
  },
  {
    id: 'over_under',
    name: 'Over / Under',
    description: 'Bet on the last digit being over or under a threshold.',
    icon: '🎯',
    color: '#a855f7',
  },
  {
    id: 'matches_differs',
    name: 'Matches / Differs',
    description: 'Bet on a specific last digit or avoid it.',
    icon: '🎲',
    color: '#f59e0b',
  },
];

type QuickStrategyModalProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (presetId: string) => void;
};

export default function QuickStrategyModal({
  open,
  onClose,
  onSelect,
}: QuickStrategyModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-navy">
              Quick strategy
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Pick a preset to fill the canvas
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Grid of presets */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                onSelect(p.id);
                onClose();
              }}
              className="text-left border border-gray-200 rounded-xl p-4 hover:border-blue-400 hover:shadow-md transition group"
            >
              <div className="flex items-center gap-3 mb-2">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                  style={{ backgroundColor: `${p.color}20`, color: p.color }}
                >
                  {p.icon}
                </div>
                <div className="font-semibold text-navy">{p.name}</div>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                {p.description}
              </p>
              <div className="mt-3 text-xs text-blue-600 font-medium opacity-0 group-hover:opacity-100 transition">
                Apply preset →
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 text-xs text-gray-400">
          Choosing a preset will replace your current blocks. You can still
          edit each block afterwards.
        </div>
      </div>
    </div>
  );
}