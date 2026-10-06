import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BotCard from '../components/BotCard';

type Bot = {
  id: string;
  name: string;
  premium: boolean;
  stars: number;
  description: string;
  category: 'premium' | 'free' | 'speed' | 'calculator' | 'strategies';
};

const BOTS: Bot[] = [
  {
    id: 'dollarminer',
    name: 'Dollarminer',
    premium: true,
    stars: 5,
    description:
      'Dollarminer: automated trading with risk management and profit optimization.',
    category: 'premium',
  },
  {
    id: 'arctic_v2_pro',
    name: 'Arctic v2 Pro',
    premium: true,
    stars: 5,
    description:
      'Arctic v2 Pro: automated trading with risk management and profit optimization.',
    category: 'premium',
  },
  {
    id: 'pro_atlas',
    name: 'Pro Atlas',
    premium: true,
    stars: 5,
    description:
      'Pro Atlas: automated trading with risk management and profit optimization.',
    category: 'premium',
  },
  {
    id: 'pro_nova',
    name: 'Pro Nova',
    premium: true,
    stars: 5,
    description:
      'Pro Nova: automated trading with risk management and profit optimization.',
    category: 'premium',
  },
  {
    id: 'pro_orion',
    name: 'Pro Orion',
    premium: true,
    stars: 5,
    description:
      'Pro Orion: automated trading with risk management and profit optimization.',
    category: 'premium',
  },
  {
    id: 'pro_vega',
    name: 'Pro Vega',
    premium: true,
    stars: 5,
    description:
      'Pro Vega: automated trading with risk management and profit optimization.',
    category: 'premium',
  },
  {
    id: 'pro_titan',
    name: 'Pro Titan',
    premium: true,
    stars: 5,
    description:
      'Pro Titan: automated trading with risk management and profit optimization.',
    category: 'premium',
  },
  {
    id: 'pro_zenith',
    name: 'Pro Zenith',
    premium: true,
    stars: 5,
    description:
      'Pro Zenith: automated trading with risk management and profit optimization.',
    category: 'premium',
  },
  {
    id: 'pro_apex',
    name: 'Pro Apex',
    premium: true,
    stars: 5,
    description:
      'Pro Apex: automated trading with risk management and profit optimization.',
    category: 'premium',
  },
];

const TABS: { id: Bot['category'] | 'all'; label: string }[] = [
  { id: 'free', label: 'Free Bots' },
  { id: 'speed', label: 'SpeedBots' },
  { id: 'calculator', label: 'Calculator' },
  { id: 'strategies', label: 'Strategies' },
  { id: 'all', label: 'All' },
];

export default function TradingBots() {
  const [activeTab, setActiveTab] = useState<typeof TABS[number]['id']>('all');
  const navigate = useNavigate();

  const filtered =
    activeTab === 'all'
      ? BOTS
      : BOTS.filter((b) => b.category === activeTab);

  const handleLoad = (_bot: Bot) => {
    // For now, just navigate to Bot Builder.
    // Later we can encode the bot's settings in the URL or localStorage.
    navigate('/bot_builder');
  };

  return (
    <main className="max-w-7xl mx-auto px-6 py-8">
      {/* Category tabs */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-200 pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 text-sm rounded-md transition ${
              activeTab === t.id
                ? 'bg-blue-50 text-blue-600 font-semibold border border-blue-400'
                : 'text-gray-600 hover:bg-gray-100 border border-transparent'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center text-gray-400 text-sm py-20">
          No bots in this category yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map((bot) => (
            <BotCard
              key={bot.id}
              name={bot.name}
              premium={bot.premium}
              stars={bot.stars}
              description={bot.description}
              onLoad={() => handleLoad(bot)}
            />
          ))}
        </div>
      )}
    </main>
  );
}