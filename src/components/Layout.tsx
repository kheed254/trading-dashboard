import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { label: 'Dashboard', to: '/' },
  { label: 'Bot Builder', to: '/bot_builder' },
  { label: 'Trading Bots', to: '/trading_bots' },
  { label: 'Bulk Trader', to: '/bulk_trader' },
  { label: 'Analysis Tool', to: '/analysis_tool' },
  { label: 'Charts', to: '/charts' },
  { label: 'Reports', to: '/reports' },
  { label: 'Manual Trader', to: '/manual_trader' },
  { label: 'Copy Trading', to: '/copy_trading' },
];

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-navy text-white">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 h-14">
          <div className="flex items-center gap-8">
            <NavLink to="/" className="text-xl font-bold whitespace-nowrap">
              Deriv<span className="text-brand-teal">Analyser</span>
            </NavLink>
            <nav className="hidden md:flex items-center gap-1 text-sm">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `px-3 py-4 transition whitespace-nowrap ${
                      isActive
                        ? 'border-b-2 border-red-500 font-medium'
                        : 'hover:text-brand-teal'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <button className="text-sm px-4 py-1.5 border border-white/40 rounded-full hover:bg-white/10 whitespace-nowrap">
              Log in
            </button>
            <button className="text-sm px-4 py-1.5 bg-brand-pink text-navy rounded-full font-semibold hover:opacity-90 whitespace-nowrap">
              Sign up
            </button>
          </div>
        </div>
      </header>

      <Outlet />
    </div>
  );
}