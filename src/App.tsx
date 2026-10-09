import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import BotBuilder from './pages/BotBuilder';
import TradingBots from './pages/TradingBots';
import BulkTrader from './pages/BulkTrader';
import AnalysisTool from './pages/AnalysisTool';
import Charts from './pages/Charts';
import Reports from './pages/Reports';
import ManualTrader from './pages/ManualTrader';
import CopyTrading from './pages/CopyTrading';
import Cashier from './pages/Cashier';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/bot_builder" element={<BotBuilder />} />
          <Route path="/trading_bots" element={<TradingBots />} />
          <Route path="/bulk_trader" element={<BulkTrader />} />
          <Route path="/analysis_tool" element={<AnalysisTool />} />
          <Route path="/charts" element={<Charts />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/manual_trader" element={<ManualTrader />} />
          <Route path="/copy_trading" element={<CopyTrading />} />
          <Route path="/cashier" element={<Cashier />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}