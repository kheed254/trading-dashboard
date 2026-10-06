import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import BotBuilder from './pages/BotBuilder';
import TradingBots from './pages/TradingBots';
import BulkTrader from './pages/BulkTrader';
import AnalysisTool from './pages/AnalysisTool';
import Charts from './pages/Charts';
import Reports from './pages/Reports';
import ManualTrader from './pages/ManualTrader';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/bot_builder" element={<BotBuilder />} />
          <Route path="/trading_bots" element={<TradingBots />} />
          <Route path="/bulk_trader" element={<BulkTrader />} />
          <Route path="/analysis_tool" element={<AnalysisTool />} />
          <Route path="/charts" element={<Charts />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/manual_trader" element={<ManualTrader />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}