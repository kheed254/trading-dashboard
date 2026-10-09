import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from 'react';

/* ---------- Types ---------- */
type BotStatus = {
  running: boolean;
  progress: number;
  statusText: string;
  /** Who is currently broadcasting — used so only one page owns the state */
  owner: string | null;
};

type BotStatusContextValue = {
  status: BotStatus;
  /** Set the full status (called by a page) */
  setBotStatus: (partial: Partial<BotStatus> & { owner: string }) => void;
  /** Clear the status when the page unmounts */
  clearBotStatus: (owner: string) => void;
};

/* ---------- Defaults ---------- */
const DEFAULT_STATUS: BotStatus = {
  running: false,
  progress: 0,
  statusText: 'Bot is not running',
  owner: null,
};

/* ---------- Context ---------- */
const BotStatusContext = createContext<BotStatusContextValue | null>(null);

/* ---------- Provider ---------- */
export function BotStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<BotStatus>(DEFAULT_STATUS);

  const setBotStatus = (partial: Partial<BotStatus> & { owner: string }) => {
    setStatus((prev) => {
      /* Only accept updates from the current owner (or if no owner yet) */
      if (prev.owner && prev.owner !== partial.owner) return prev;
      return {
        ...prev,
        ...partial,
        owner: partial.owner,
      };
    });
  };

  const clearBotStatus = (owner: string) => {
    setStatus((prev) => {
      if (prev.owner !== owner) return prev;
      return DEFAULT_STATUS;
    });
  };

  return (
    <BotStatusContext.Provider
      value={{ status, setBotStatus, clearBotStatus }}
    >
      {children}
    </BotStatusContext.Provider>
  );
}

/* ---------- Hook ---------- */
export function useBotStatus(): BotStatusContextValue {
  const ctx = useContext(BotStatusContext);
  if (!ctx) {
    throw new Error('useBotStatus must be used inside <BotStatusProvider>');
  }
  return ctx;
}