type BotCardProps = {
  name: string;
  premium: boolean;
  stars: number;
  description: string;
  onLoad: () => void;
};

export default function BotCard({
  name,
  premium,
  stars,
  description,
  onLoad,
}: BotCardProps) {
  return (
    <div className="relative bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition p-5 flex flex-col">
      {/* PREMIUM / FREE badge */}
      <span
        className={`absolute top-4 right-4 text-[10px] font-bold tracking-wider px-2 py-1 rounded ${
          premium
            ? 'bg-amber-400 text-amber-900'
            : 'bg-teal-100 text-teal-700'
        }`}
      >
        {premium ? 'PREMIUM' : 'FREE'}
      </span>

      {/* Robot icon */}
      <div className="w-8 h-8 flex items-center justify-center text-2xl">
        🤖
      </div>

      {/* Name */}
      <h3 className="font-semibold text-navy mt-1">{name}</h3>

      {/* Stars */}
      <div className="text-amber-400 text-sm mt-1 mb-2">
        {'★'.repeat(stars)}
        <span className="text-gray-300">
          {'★'.repeat(5 - stars)}
        </span>
      </div>

      {/* Description */}
      <p className="text-xs text-gray-500 leading-relaxed flex-1">
        {description}
      </p>

      {/* Button */}
      <button
        onClick={onLoad}
        className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-lg transition"
      >
        LOAD {premium ? 'PREMIUM' : 'FREE'} BOT
      </button>
    </div>
  );
}