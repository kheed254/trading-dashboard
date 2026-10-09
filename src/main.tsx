import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { TradeProvider } from './lib/trading/store';
import { BotStatusProvider } from './lib/bot-status';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TradeProvider>
      <BotStatusProvider>
        <App />
      </BotStatusProvider>
    </TradeProvider>
  </StrictMode>
);