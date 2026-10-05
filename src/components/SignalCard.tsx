type Stat = { label: string; value: string };

type SignalCardProps = {
  id: number;
  market: string;
  badge: string;
  badgeColor: 'teal' | 'gray';
  confidence: number;
  stats: Stat[];
  cta: string;
  ctaColor: 'teal' | 'red';
  livePrice?: number | null;
};

export default function SignalCard({
  id,
  market,
  badge,
  badgeColor,
  confidence,
  stats,
  cta,
  ctaColor,
  livePrice,
}: SignalCardProps) {
  const badgeClasses =
    badgeColor === 'teal'
      ? 'bg-teal-50 text-teal-700 border-teal-200'
      : 'bg-gray-50 text-gray-600 border-gray-200';

  const barColor = badgeColor === 'teal' ? 'bg-green-500' : 'bg-teal-500';

  const ctaClasses =
    ctaColor === 'teal'
      ? 'bg-teal-500 hover:bg-teal-600'
      : 'bg-red-500 hover:bg-red-600';

  const hasPrice = livePrice !== null && livePrice !== undefined;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-gray-400 text-sm font-medium">#{id}</span>
        <span
          className={`text-xs px-2 py-1 rounded-full border ${badgeClasses}`}
        >
          {badge}
        </span>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-navy">{market}</h3>
        <span className="font-mono text-sm text-gray-700 font-semibold">
          {hasPrice ? livePrice.toFixed(2) : '—'}
        </span>
      </div>

      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Confidence</span>
          <span className="font-semibold text-gray-700">{confidence}%</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full ${barColor} transition-all duration-300`}
            style={{ width: `${confidence}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-gray-50 rounded px-3 py-2 flex justify-between"
          >
            <span>{s.label}</span>
            <span className="font-semibold">{s.value}</span>
          </div>
        ))}
      </div>

      <button className="text-xs text-blue-600 hover:underline mb-3">
        ▼ Show details
      </button>

      <button
        className={`w-full ${ctaClasses} text-white text-sm font-semibold py-2.5 rounded-lg transition`}
      >
        ⚡ {cta}
      </button>
    </div>
  );
}