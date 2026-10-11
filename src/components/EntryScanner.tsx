import { useEffect, useRef, useState } from 'react';

/* ---------- Types ---------- */
type ModeKey = '01U8' | '02U7' | '03U6';

type ModeConfig = {
  key: ModeKey;
  label: string;
  badge: string;
  title: string;
  description: string;
  over: number;
  under: number;
  theme: {
    bg: string;
    accent: string;
    overlayFrom: string;
  };
};

const MODES: ModeConfig[] = [
  {
    key: '01U8',
    label: '01 / U8',
    badge: 'RECOVERY ENGINE',
    title: 'Digits Scanner',
    description: 'Scans Over 1 and Under 8 with recovery confirmation.',
    over: 1,
    under: 8,
    theme: {
      bg: 'linear-gradient(135deg, #0a1e3d 0%, #0d2847 100%)',
      accent: '#0a1e3d',
      overlayFrom: '#0a1e3d',
    },
  },
  {
    key: '02U7',
    label: '02 / U7',
    badge: 'PATTERN HUNTER',
    title: 'Even/Odd Precision',
    description: 'Scans Over 2 and Under 7 using the same recovery flow.',
    over: 2,
    under: 7,
    theme: {
      bg: 'linear-gradient(135deg, #1a3a6b 0%, #1e4a85 100%)',
      accent: '#1a3a6b',
      overlayFrom: '#1e4a85',
    },
  },
  {
    key: '03U6',
    label: '03 / U6',
    badge: 'TREND PULSE',
    title: 'Rise/Fall Filter',
    description: 'Scans Over 3 and Under 6 using the same recovery flow.',
    over: 3,
    under: 6,
    theme: {
      bg: 'linear-gradient(135deg, #1e5799 0%, #2989d8 100%)',
      accent: '#1e5799',
      overlayFrom: '#2989d8',
    },
  },
];

/* ---------- Mock scan result (Phase 1: static) ---------- */
type ScanResult = {
  market: string;
  tradeType: string;
  aiScore: string;
  winRate: string;
  recent: string;
  samples: string;
  heatmap: string;
  bestMarket: string;
};

const MOCK_RESULT: ScanResult = {
  market: 'Volatility 90 (1s) Index (1HZ9...',
  tradeType: 'Over 3 Recovery Over 4',
  aiScore: '73.61%',
  winRate: '83.2%',
  recent: '77.5%',
  samples: '999',
  heatmap: 'Heatmap: hottest digit 7 | coldest digit 6 | missing 4 | low streak 0 | high streak 4',
  bestMarket: 'Best market: Volatility 90 (1s) Index | Momentum Burst | AI 73.61%',
};

/* ---------- Component ---------- */
export function EntryScanner({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<ModeKey>('01U8');
  const [scanned, setScanned] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  const currentMode = MODES.find((m) => m.key === mode)!;

  /* ---------- Initial position: center of screen ---------- */
  useEffect(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const panelW = Math.min(w - 24, 440);
    const panelH = 620;
    setPosition({
      x: Math.max(12, (w - panelW) / 2),
      y: Math.max(12, (h - panelH) / 2),
    });
  }, []);

  /* ---------- Drag handlers ---------- */
  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y,
    };
    try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const panelW = panelRef.current?.offsetWidth || 400;
    const panelH = panelRef.current?.offsetHeight || 620;
    const maxX = window.innerWidth - panelW - 8;
    const maxY = window.innerHeight - panelH - 8;
    setPosition({
      x: Math.max(8, Math.min(maxX, dragStartRef.current.posX + dx)),
      y: Math.max(8, Math.min(maxY, dragStartRef.current.posY + dy)),
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
  };

  /* ---------- Scan action (Phase 1: mock, 2s delay) ---------- */
  const handleScan = () => {
    setScanning(true);
    setTimeout(() => {
      setScanning(false);
      setScanned(true);
    }, 2000);
  };

  const handleReset = () => {
    setScanned(false);
    setScanning(false);
  };

  const handleLoadBot = () => {
    alert(`Loading bot with:\nMarket: ${MOCK_RESULT.market}\nTrade Type: ${MOCK_RESULT.tradeType}`);
  };

  return (
    <div
      ref={panelRef}
      className="fixed z-[200] shadow-2xl rounded-2xl overflow-hidden"
      style={{
        left: position.x,
        top: position.y,
        width: 'min(calc(100vw - 24px), 440px)',
        maxHeight: 'calc(100vh - 24px)',
        touchAction: 'none',
      }}
    >
      {/* ============ DRAG HANDLE HEADER ============ */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="flex items-center justify-between px-4 py-3.5 cursor-grab active:cursor-grabbing select-none"
        style={{
          background: 'linear-gradient(135deg, #0f2748 0%, #1a3a6b 100%)',
          touchAction: 'none',
        }}
      >
        <div className="flex items-center gap-2 text-white">
          <span className="text-base">⠿</span>
          <span className="text-base font-bold">Entry Scanner</span>
        </div>
        <button
          onClick={onClose}
          onPointerDown={(e) => e.stopPropagation()}
          className="w-7 h-7 flex items-center justify-center text-white/80 hover:text-white text-xl leading-none"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {/* ============ BODY ============ */}
      <div className="bg-gray-50 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 80px)' }}>
        <div className="p-4">
          {/* ----- Mode banner ----- */}
          <div
            className="rounded-xl px-4 py-5 mb-4 relative overflow-hidden"
            style={{ background: currentMode.theme.bg }}
          >
            {/* Faint grid overlay */}
            <div
              className="absolute inset-0 opacity-10 pointer-events-none"
              style={{
                backgroundImage: `
                  linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)
                `,
                backgroundSize: '20px 20px',
              }}
            />
            {/* Blue glow blob */}
            <div
              className="absolute -bottom-8 -right-8 w-40 h-40 rounded-full blur-3xl opacity-40"
              style={{ background: '#3b82f6' }}
            />

            <div className="relative">
              <div className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1 mb-3">
                <span className="text-white text-[10px]">✦</span>
                <span className="text-white text-[10px] font-bold tracking-wider">
                  {currentMode.badge}
                </span>
              </div>
              <div className="text-white text-2xl font-extrabold mb-1">
                {currentMode.title}
              </div>
              <div className="text-white/80 text-xs leading-relaxed">
                {currentMode.description}
              </div>
            </div>
          </div>

          {/* ----- Mode tabs ----- */}
          <div className="flex gap-2 mb-4 bg-white rounded-full p-1">
            {MODES.map((m) => (
              <button
                key={m.key}
                onClick={() => { setMode(m.key); handleReset(); }}
                className={`flex-1 py-2.5 rounded-full text-xs font-bold transition ${
                  mode === m.key
                    ? 'text-white shadow-md'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                style={
                  mode === m.key
                    ? { background: `linear-gradient(135deg, ${m.theme.accent} 0%, ${m.theme.overlayFrom} 100%)` }
                    : undefined
                }
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* ----- Info cards row ----- */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-white border border-gray-200 rounded-xl p-3">
              <div className="text-[9px] text-gray-500 font-bold tracking-wider mb-1">SCAN DEPTH</div>
              <div className="text-sm font-bold text-navy">3000</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-3">
              <div className="text-[9px] text-gray-500 font-bold tracking-wider mb-1">MODE</div>
              <div className="text-sm font-bold text-navy">{currentMode.label}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-3">
              <div className="text-[9px] text-gray-500 font-bold tracking-wider mb-1">TICKS</div>
              <div className="text-sm font-bold text-navy">3000</div>
            </div>
          </div>

          {/* ----- Market / Trade Type row ----- */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-white border border-gray-200 rounded-xl p-3">
              <div className="text-[9px] text-gray-500 font-bold tracking-wider mb-1">SELECTED MARKET</div>
              <div className="text-xs font-semibold text-navy truncate">
                {scanned ? MOCK_RESULT.market : 'Scan to find the best market'}
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-3">
              <div className="text-[9px] text-gray-500 font-bold tracking-wider mb-1">TRADE TYPE</div>
              <div className="text-xs font-semibold text-navy truncate">
                {scanned ? MOCK_RESULT.tradeType : 'Waiting for scan'}
              </div>
            </div>
          </div>

          {/* ----- Stat cards (only after scan) ----- */}
          {scanned && (
            <>
              <div className="grid grid-cols-4 gap-2 mb-3">
                <div className="bg-white border border-gray-200 rounded-xl p-2.5">
                  <div className="text-[9px] text-gray-500 font-bold tracking-wider mb-0.5">AI SCORE</div>
                  <div className="text-xs font-bold text-navy">{MOCK_RESULT.aiScore}</div>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-2.5">
                  <div className="text-[9px] text-gray-500 font-bold tracking-wider mb-0.5">WIN RATE</div>
                  <div className="text-xs font-bold text-navy">{MOCK_RESULT.winRate}</div>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-2.5">
                  <div className="text-[9px] text-gray-500 font-bold tracking-wider mb-0.5">RECENT</div>
                  <div className="text-xs font-bold text-navy">{MOCK_RESULT.recent}</div>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-2.5">
                  <div className="text-[9px] text-gray-500 font-bold tracking-wider mb-0.5">SAMPLES</div>
                  <div className="text-xs font-bold text-navy">{MOCK_RESULT.samples}</div>
                </div>
              </div>

              {/* Heatmap insights */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-3">
                <div className="text-[11px] text-gray-700 leading-relaxed">
                  {MOCK_RESULT.heatmap}
                </div>
              </div>

              {/* Best market banner */}
              <div className="bg-green-50 border border-green-300 rounded-xl p-3 mb-4">
                <div className="text-[11px] text-green-800 font-semibold">
                  {MOCK_RESULT.bestMarket}
                </div>
              </div>
            </>
          )}

          {/* ----- Status bar (only before scan) ----- */}
          {!scanned && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4">
              <div className="text-[11px] text-yellow-800 font-semibold">
                Ready to scan Over{currentMode.over} / Under{currentMode.under}.
              </div>
            </div>
          )}

          {/* ----- Action buttons ----- */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleScan}
              disabled={scanning || scanned}
              className={`py-3 rounded-xl font-bold text-sm transition ${
                scanning || scanned
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'text-white shadow-md hover:opacity-90'
              }`}
              style={
                !scanning && !scanned
                  ? { background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)' }
                  : undefined
              }
            >
              {scanning ? 'Scanning...' : 'Scan Markets'}
            </button>

            <button
              onClick={handleLoadBot}
              disabled={!scanned}
              className={`py-3 rounded-xl font-bold text-sm transition ${
                !scanned
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'text-white shadow-md hover:opacity-90'
              }`}
              style={
                scanned
                  ? { background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)' }
                  : undefined
              }
            >
              Load Scanner Bot
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}