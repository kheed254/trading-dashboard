import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BotCard from '../components/BotCard';
import SpeedBot from './tools/SpeedBot';
import Diffbot from './tools/Diffbot';

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
  {
    id: 'free_rise_fall',
    name: 'Simple Rise/Fall',
    premium: false,
    stars: 4,
    description:
      'Free bot that trades Rise/Fall on Volatility 100 (1s) with a basic martingale.',
    category: 'free',
  },
  {
    id: 'free_even_odd',
    name: 'Even/Odd Auto',
    premium: false,
    stars: 4,
    description:
      'Free bot that trades the last digit Even/Odd on Volatility 75 (1s).',
    category: 'free',
  },
  {
    id: 'free_over_under',
    name: 'Over/Under 4',
    premium: false,
    stars: 5,
    description:
      'Free bot trading Digits Over 4 / Under 5 on Volatility 25 (1s).',
    category: 'free',
  },
  {
    id: 'free_speedbot_1',
    name: 'SpeedBot Basic',
    premium: false,
    stars: 3,
    description:
      'Minimal speed bot for fast Rise/Fall entries with tight stop-loss.',
    category: 'free',
  },
];

type TopTab = 'free' | 'speed' | 'calculator' | 'strategies' | 'all';

const TOP_TABS: { id: TopTab; label: string }[] = [
  { id: 'free', label: 'Free Bots' },
  { id: 'speed', label: 'SpeedBots 🚀' },
  { id: 'calculator', label: 'Calculator' },
  { id: 'strategies', label: 'Strategies' },
  { id: 'all', label: 'All' },
];

type SpeedSubTab = 'matches' | 'diffbot' | 'hyperbot' | 'speedbot';

const SPEED_SUB_TABS: { id: SpeedSubTab; label: string }[] = [
  { id: 'matches', label: 'Matches' },
  { id: 'diffbot', label: 'Diffbot' },
  { id: 'hyperbot', label: 'Hyperbot' },
  { id: 'speedbot', label: 'SpeedBot 🚀' },
];

export default function TradingBots() {
  const [activeTab, setActiveTab] = useState<TopTab>('all');
  const [activeSubTab, setActiveSubTab] = useState<SpeedSubTab>('speedbot');
  const navigate = useNavigate();

  const filtered =
    activeTab === 'all'
      ? BOTS
      : activeTab === 'speed'
      ? []
      : BOTS.filter((b) => b.category === activeTab);

  const handleLoad = (_bot: Bot) => {
    navigate('/bot_builder');
  };

  return (
    <main className="max-w-7xl mx-auto px-6 py-6">
      {/* Top tabs */}
      <div className="flex flex-wrap gap-2 mb-4 border-b border-gray-200 pb-2">
        {TOP_TABS.map((t) => (
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

      {/* SpeedBots sub-tabs */}
      {activeTab === 'speed' && (
        <div className="flex flex-wrap gap-2 mb-6">
          {SPEED_SUB_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveSubTab(t.id)}
              className={`px-3 py-1.5 text-xs rounded-md transition border ${
                activeSubTab === t.id
                  ? 'bg-blue-50 text-blue-600 font-semibold border-blue-400'
                  : 'text-gray-600 hover:bg-gray-100 border-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* CONTENT */}
      {activeTab === 'speed' ? (
        activeSubTab === 'speedbot' ? (
          <SpeedBot />
        ) : activeSubTab === 'diffbot' ? (
          <Diffbot />
        ) : (
          <div className="text-center text-gray-400 text-sm py-20">
            <span className="font-semibold text-gray-500">
              {SPEED_SUB_TABS.find((t) => t.id === activeSubTab)?.label}
            </span>
            <br />
            Coming soon.
          </div>
        )
      ) : filtered.length === 0 ? (
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