/* ================================================================
   Deriv DBot XML Parser
   - Parses standard Deriv bot XML files (from deriv.com/bot)
   - Extracts the core trade parameters
   - Warns if the XML uses advanced blocks we can't represent
   - Returns a StingerFX-compatible SavedBlock[]
   ================================================================ */

import type { SavedBlock } from './storage';

/* ---------- Symbol → Market name mapping ---------- */
const SYMBOL_TO_MARKET: Record<string, string> = {
  '1HZ10V': 'Volatility 10 (1s) Index',
  '1HZ25V': 'Volatility 25 (1s) Index',
  '1HZ30V': 'Volatility 30 (1s) Index',
  '1HZ50V': 'Volatility 50 (1s) Index',
  '1HZ75V': 'Volatility 75 (1s) Index',
  '1HZ100V': 'Volatility 100 (1s) Index',
  'R_10': 'Volatility 10 Index',
  'R_25': 'Volatility 25 Index',
  'R_50': 'Volatility 50 Index',
  'R_75': 'Volatility 75 Index',
  'R_100': 'Volatility 100 Index',
  'BOOM1000': 'Bull Market Index',
  'CRASH1000': 'Bear Market Index',
  'frxEURUSD': 'EUR/USD',
  'frxGBPUSD': 'GBP/USD',
  'frxUSDJPY': 'USD/JPY',
  'cryBTCUSD': 'BTC/USD',
  'cryETHUSD': 'ETH/USD',
};

/* ---------- Trade type mapping ---------- */
const TRADETYPE_MAP: Record<string, string> = {
  'callput': 'Up/Down › Rise/Fall',
  'callputequal': 'Up/Down › Rise/Fall',
  'higherlower': 'Up/Down › Higher/Lower',
  'touchnotouch': 'Touch/No Touch',
  'endsinout': 'In/Out › Ends Between/Outside',
  'staysinout': 'In/Out › Ends Between/Outside',
  'matchesdiffers': 'Digits › Matches/Differs',
  'evenodd': 'Digits › Even/Odd',
  'overunder': 'Digits › Over/Under',
};

/* ---------- Contract type mapping ---------- */
const CONTRACT_TYPE_MAP: Record<string, string> = {
  'CALL': 'Rise only',
  'PUT': 'Fall only',
  'CALLE': 'Higher',
  'PUTE': 'Lower',
  'ONETOUCH': 'Touch',
  'NOTOUCH': 'No Touch',
  'EXPIRYRANGE': 'Ends Between',
  'EXPIRYMISS': 'Ends Outside',
  'DIGITMATCH': 'Matches',
  'DIGITDIFF': 'Differs',
  'DIGITEVEN': 'Even',
  'DIGITODD': 'Odd',
  'DIGITOVER': 'Over',
  'DIGITUNDER': 'Under',
};

/* ---------- Candle interval mapping ---------- */
const CANDLE_MAP: Record<string, string> = {
  '60': '1 minute',
  '120': '2 minutes',
  '300': '5 minutes',
  '900': '15 minutes',
  '3600': '1 hour',
};

/* ---------- Advanced block types we can't fully represent ---------- */
const ADVANCED_BLOCKS = [
  'controls_if',
  'controls_for',
  'controls_whileUntil',
  'controls_flow_statements',
  'logic_compare',
  'logic_operation',
  'logic_ternary',
  'math_arithmetic',
  'math_single',
  'math_number_property',
  'math_random_int',
  'text_join',
  'text_print',
  'text_statement',
  'variables_set',
  'variables_get',
  'notify',
  'total_profit',
  'read_details',
  'last_digit',
  'contract_check_result',
  'check_sell',
  'sell_at_market',
  'lists_create_with',
  'lists_getIndex',
  'lists_setIndex',
];

/* ---------- Main parse result ---------- */
export type ParseResult = {
  blocks: SavedBlock[];
  botName: string;
  hasAdvancedBlocks: boolean;
  advancedBlockTypes: string[];
  warnings: string[];
};

/* ---------- Parse XML string ---------- */
export function parseDerivXml(xmlString: string): ParseResult {
  const warnings: string[] = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'application/xml');

  // Check for parse errors
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error('Invalid XML: ' + parseError.textContent?.slice(0, 100));
  }

  /* ---- Extract all fields from the XML ---- */
  const getAllFields = (name: string): string[] => {
    const nodes = doc.querySelectorAll(`field[name="${name}"]`);
    return Array.from(nodes).map((n) => n.textContent?.trim() ?? '');
  };

  const getFirstField = (name: string): string => getAllFields(name)[0] ?? '';

  /* ---- Extract trade parameters ---- */
  const symbolCode = getFirstField('SYMBOL_LIST');
  const tradetypeCat = getFirstField('TRADETYPECAT_LIST');
  const tradetypeList = getFirstField('TRADETYPE_LIST');
  const contractType = getFirstField('TYPE_LIST');
  const candleInterval = getFirstField('CANDLEINTERVAL_LIST');
  const durationType = getFirstField('DURATIONTYPE_LIST');
  const restartOnError = getFirstField('RESTARTONERROR');

  // Duration, Amount, Prediction are in <value> blocks
  const getValueNumber = (valueName: string): number | null => {
    const value = doc.querySelector(`value[name="${valueName}"]`);
    if (!value) return null;
    const numField = value.querySelector('block[type="math_number"] field[name="NUM"]');
    if (numField) return Number(numField.textContent);
    return null;
  };

  const durationValue = getValueNumber('DURATION') ?? 1;

  // Stake default from `variables_set` for "Stake"
  let stakeValue = 0.35;
  doc.querySelectorAll('block[type="variables_set"]').forEach((node) => {
    const varField = node.querySelector('field[name="VAR"]');
    if (varField?.textContent?.trim() === 'Stake') {
      const numField = node.querySelector('field[name="NUM"]');
      if (numField) stakeValue = Number(numField.textContent);
    }
  });

  // Expected Profit
  let expectedProfit = 7;
  doc.querySelectorAll('block[type="variables_set"]').forEach((node) => {
    const varField = node.querySelector('field[name="VAR"]');
    if (varField?.textContent?.trim() === 'Expected Profit') {
      const numField = node.querySelector('field[name="NUM"]');
      if (numField) expectedProfit = Number(numField.textContent);
    }
  });

  // Stop Loss
  let stopLoss = 999;
  doc.querySelectorAll('block[type="variables_set"]').forEach((node) => {
    const varField = node.querySelector('field[name="VAR"]');
    if (varField?.textContent?.trim() === 'Stop Loss') {
      const numField = node.querySelector('field[name="NUM"]');
      if (numField) stopLoss = Number(numField.textContent);
    }
  });

  // Martingale Level (not commonly used in Deriv XML, default to 1.05)
  const martingaleLevel = 1.05;

  // Prediction (for digits trades) - extract from ternary default
  let prediction = 5;
  const predictionValue = doc.querySelector('value[name="PREDICTION"]');
  if (predictionValue) {
    const simpleNum = predictionValue.querySelector('block[type="math_number"] field[name="NUM"]');
    if (simpleNum) prediction = Number(simpleNum.textContent);
    else if (predictionValue.querySelector('block[type="logic_ternary"]')) {
      warnings.push('Prediction uses advanced logic — defaulted to 5');
    }
  }

  /* ---- Map to readable names ---- */
  const market = SYMBOL_TO_MARKET[symbolCode] ?? symbolCode ?? 'Volatility 100 (1s) Index';
  const tradeType = TRADETYPE_MAP[tradetypeList] ?? TRADETYPE_MAP[tradetypeCat] ?? 'Up/Down › Rise/Fall';
  const mappedContractType = CONTRACT_TYPE_MAP[contractType] ?? 'Both';
  const mappedCandleInterval = CANDLE_MAP[candleInterval] ?? '1 minute';

  /* ---- Detect advanced blocks ---- */
  const blockTypes = new Set<string>();
  doc.querySelectorAll('block').forEach((node) => {
    const type = node.getAttribute('type');
    if (type) blockTypes.add(type);
  });

  const advancedBlockTypes: string[] = [];
  blockTypes.forEach((type) => {
    if (ADVANCED_BLOCKS.includes(type)) advancedBlockTypes.push(type);
  });
  const hasAdvancedBlocks = advancedBlockTypes.length > 0;

  /* ---- Build SavedBlock[] ---- */
  const now = Date.now();

  // Derive direction value from contract type
  const direction: SavedBlock['direction'] =
    contractType === 'DIGITUNDER' ? 'Under' :
    contractType === 'DIGITOVER' ? 'Over' :
    contractType === 'DIGITMATCH' ? 'Matches' :
    contractType === 'DIGITDIFF' ? 'Differs' :
    contractType === 'DIGITEVEN' ? 'Even' :
    contractType === 'DIGITODD' ? 'Odd' :
    contractType === 'PUT' ? 'Fall' :
    contractType === 'PUTE' ? 'Lower' :
    contractType === 'NOTOUCH' ? 'No Touch' :
    contractType === 'CALLE' ? 'Higher' :
    contractType === 'ONETOUCH' ? 'Touch' :
    'Rise';

  const blocks: SavedBlock[] = [
    {
      id: `imported-tp-${now}`,
      type: 'trade_params',
      open: true,
      market,
      tradeType,
      contractType: mappedContractType,
      digitBarrier: prediction,
      candleInterval: mappedCandleInterval,
      restartBuySell: false,
      restartLastTrade: restartOnError === 'TRUE',
      runOnceValues: {
        'Initial Amount': stakeValue,
        'Win Amount': stakeValue,
        'Expected Profit': expectedProfit,
        'Stop Loss': stopLoss,
        'Martingale Level': martingaleLevel,
      },
      durationType: durationType === 't' ? 'Ticks' : 'Ticks',
      durationValue,
      stakeType: 'Initial Amount',
    },
    {
      id: `imported-purchase-${now}`,
      type: 'purchase',
      open: true,
      direction,
    },
    {
      id: `imported-sell-${now}`,
      type: 'sell',
      open: true,
    },
    {
      id: `imported-restart-${now}`,
      type: 'restart',
      open: true,
    },
  ];

  /* ---- Derive a bot name ---- */
  const botName = deriveBotNameFromXml(doc, market, tradeType);

  return {
    blocks,
    botName,
    hasAdvancedBlocks,
    advancedBlockTypes,
    warnings,
  };
}

/* ---------- Derive a bot name from the XML ---------- */
function deriveBotNameFromXml(doc: Document, market: string, tradeType: string): string {
  // Look for a text_print in INITIALIZATION statement — often the bot's self-declared name
  const textPrints = doc.querySelectorAll('block[type="text_print"] field[name="TEXT"]');
  for (const node of Array.from(textPrints)) {
    const text = node.textContent?.trim();
    if (text && text.length > 0 && text.length < 60 && !text.includes('&')) {
      return text;
    }
  }

  // Fall back to market + trade type
  const shortMarket = market.replace(' Index', '');
  const shortTrade = tradeType.split(' › ').pop() ?? '';
  return `Imported ${shortMarket} ${shortTrade}`.trim();
}