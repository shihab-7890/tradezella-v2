/**
 * Phase 8 — Instrument Metadata & Contract Specifications
 * Handles Gold (XAUUSD), major Forex pairs, crosses, and tick/point monetary calculations.
 */

export const INSTRUMENT_REGISTRY = {
  // Gold (Spot Gold in USD)
  'XAUUSD': {
    symbol: 'XAUUSD',
    aliases: ['XAU/USD', 'GOLD', 'XAU-USD'],
    assetClass: 'Commodities',
    baseCurrency: 'XAU',
    quoteCurrency: 'USD',
    contractSize: 100, // 100 troy ounces per 1.0 standard lot
    tickSize: 0.01,    // $0.01 per ounce
    pipSize: 0.1,      // 10 cents ($0.10) per pip in standard gold convention
    pipValuePerLotUSD: 10.0, // 100 oz * $0.10 = $10.00 per pip per lot
    pointValueUSD: 100.0,    // $1.00 price move * 100 oz = $100 per 1.0 lot
    lotStep: 0.01,
    minLot: 0.01,
    maxLot: 100.0,
    typicalSpreadPips: 0.25, // ~$0.25 on gold
    marginRequirementPct: 1.0, // 1:100 leverage typical
  },

  // Major Forex Pairs (Quote is USD)
  'EURUSD': {
    symbol: 'EURUSD',
    aliases: ['EUR/USD', 'EUR-USD'],
    assetClass: 'Forex',
    baseCurrency: 'EUR',
    quoteCurrency: 'USD',
    contractSize: 100000,
    tickSize: 0.00001,
    pipSize: 0.0001,
    pipValuePerLotUSD: 10.0, // 100,000 * 0.0001 = $10.00 per pip per lot
    pointValueUSD: 100000.0,
    lotStep: 0.01,
    minLot: 0.01,
    maxLot: 100.0,
    typicalSpreadPips: 1.0,
    marginRequirementPct: 3.33, // 1:30 leverage typical
  },

  'GBPUSD': {
    symbol: 'GBPUSD',
    aliases: ['GBP/USD', 'GBP-USD'],
    assetClass: 'Forex',
    baseCurrency: 'GBP',
    quoteCurrency: 'USD',
    contractSize: 100000,
    tickSize: 0.00001,
    pipSize: 0.0001,
    pipValuePerLotUSD: 10.0,
    pointValueUSD: 100000.0,
    lotStep: 0.01,
    minLot: 0.01,
    maxLot: 100.0,
    typicalSpreadPips: 1.2,
    marginRequirementPct: 3.33,
  },

  'USDJPY': {
    symbol: 'USDJPY',
    aliases: ['USD/JPY', 'USD-JPY'],
    assetClass: 'Forex',
    baseCurrency: 'USD',
    quoteCurrency: 'JPY',
    contractSize: 100000,
    tickSize: 0.001,
    pipSize: 0.01,
    pipValuePerLotUSD: null, // Requires JPY/USD conversion (e.g. 1000 JPY / current USDJPY rate)
    pointValueUSD: null,
    lotStep: 0.01,
    minLot: 0.01,
    maxLot: 100.0,
    typicalSpreadPips: 1.0,
    marginRequirementPct: 3.33,
  },

  'AUDUSD': {
    symbol: 'AUDUSD',
    aliases: ['AUD/USD', 'AUD-USD'],
    assetClass: 'Forex',
    baseCurrency: 'AUD',
    quoteCurrency: 'USD',
    contractSize: 100000,
    tickSize: 0.00001,
    pipSize: 0.0001,
    pipValuePerLotUSD: 10.0,
    pointValueUSD: 100000.0,
    lotStep: 0.01,
    minLot: 0.01,
    maxLot: 100.0,
    typicalSpreadPips: 1.2,
    marginRequirementPct: 3.33,
  },

  'USDCAD': {
    symbol: 'USDCAD',
    aliases: ['USD/CAD', 'USD-CAD'],
    assetClass: 'Forex',
    baseCurrency: 'USD',
    quoteCurrency: 'CAD',
    contractSize: 100000,
    tickSize: 0.00001,
    pipSize: 0.0001,
    pipValuePerLotUSD: null, // Requires CAD/USD conversion (10 CAD / current USDCAD)
    pointValueUSD: null,
    lotStep: 0.01,
    minLot: 0.01,
    maxLot: 100.0,
    typicalSpreadPips: 1.5,
    marginRequirementPct: 3.33,
  },

  'USDCHF': {
    symbol: 'USDCHF',
    aliases: ['USD/CHF', 'USD-CHF'],
    assetClass: 'Forex',
    baseCurrency: 'USD',
    quoteCurrency: 'CHF',
    contractSize: 100000,
    tickSize: 0.00001,
    pipSize: 0.0001,
    pipValuePerLotUSD: null, // Requires CHF/USD conversion
    pointValueUSD: null,
    lotStep: 0.01,
    minLot: 0.01,
    maxLot: 100.0,
    typicalSpreadPips: 1.5,
    marginRequirementPct: 3.33,
  },

  'NZDUSD': {
    symbol: 'NZDUSD',
    aliases: ['NZD/USD', 'NZD-USD'],
    assetClass: 'Forex',
    baseCurrency: 'NZD',
    quoteCurrency: 'USD',
    contractSize: 100000,
    tickSize: 0.00001,
    pipSize: 0.0001,
    pipValuePerLotUSD: 10.0,
    pointValueUSD: 100000.0,
    lotStep: 0.01,
    minLot: 0.01,
    maxLot: 100.0,
    typicalSpreadPips: 1.8,
    marginRequirementPct: 3.33,
  },

  // Crosses
  'EURGBP': {
    symbol: 'EURGBP',
    aliases: ['EUR/GBP', 'EUR-GBP'],
    assetClass: 'Forex',
    baseCurrency: 'EUR',
    quoteCurrency: 'GBP',
    contractSize: 100000,
    tickSize: 0.00001,
    pipSize: 0.0001,
    pipValuePerLotUSD: null, // 10 GBP converted to USD via GBPUSD rate
    pointValueUSD: null,
    lotStep: 0.01,
    minLot: 0.01,
    maxLot: 100.0,
    typicalSpreadPips: 1.5,
    marginRequirementPct: 3.33,
  },

  'EURJPY': {
    symbol: 'EURJPY',
    aliases: ['EUR/JPY', 'EUR-JPY'],
    assetClass: 'Forex',
    baseCurrency: 'EUR',
    quoteCurrency: 'JPY',
    contractSize: 100000,
    tickSize: 0.001,
    pipSize: 0.01,
    pipValuePerLotUSD: null,
    pointValueUSD: null,
    lotStep: 0.01,
    minLot: 0.01,
    maxLot: 100.0,
    typicalSpreadPips: 1.8,
    marginRequirementPct: 3.33,
  },

  'GBPJPY': {
    symbol: 'GBPJPY',
    aliases: ['GBP/JPY', 'GBP-JPY'],
    assetClass: 'Forex',
    baseCurrency: 'GBP',
    quoteCurrency: 'JPY',
    contractSize: 100000,
    tickSize: 0.001,
    pipSize: 0.01,
    pipValuePerLotUSD: null,
    pointValueUSD: null,
    lotStep: 0.01,
    minLot: 0.01,
    maxLot: 100.0,
    typicalSpreadPips: 2.2,
    marginRequirementPct: 3.33,
  },
};

/**
 * Standardizes a symbol string to registry key.
 */
export function normalizeSymbol(rawSymbol = '') {
  const s = String(rawSymbol).toUpperCase().replace(/[^A-Z]/g, '');
  for (const [key, spec] of Object.entries(INSTRUMENT_REGISTRY)) {
    if (key === s) return key;
    if (spec.aliases.some(a => a.replace(/[^A-Z]/g, '') === s)) return key;
  }
  return s || 'XAUUSD';
}

/**
 * Retrieves full instrument specification or safe fallback.
 */
export function getInstrumentSpec(rawSymbol = 'XAUUSD') {
  const norm = normalizeSymbol(rawSymbol);
  if (INSTRUMENT_REGISTRY[norm]) {
    return { ...INSTRUMENT_REGISTRY[norm] };
  }

  // Safe generic fallback
  const isGold = norm.includes('XAU') || norm.includes('GOLD');
  const isJpy = norm.includes('JPY');
  return {
    symbol: norm,
    aliases: [norm],
    assetClass: isGold ? 'Commodities' : 'Forex',
    baseCurrency: norm.slice(0, 3) || 'USD',
    quoteCurrency: norm.slice(3, 6) || 'USD',
    contractSize: isGold ? 100 : 100000,
    tickSize: isGold ? 0.01 : (isJpy ? 0.001 : 0.00001),
    pipSize: isGold ? 0.1 : (isJpy ? 0.01 : 0.0001),
    pipValuePerLotUSD: isGold ? 10.0 : (isJpy ? null : 10.0),
    pointValueUSD: isGold ? 100.0 : 100000.0,
    lotStep: 0.01,
    minLot: 0.01,
    maxLot: 100.0,
    typicalSpreadPips: isGold ? 0.25 : 1.5,
    marginRequirementPct: isGold ? 1.0 : 3.33,
    isFallbackSpec: true,
  };
}

/**
 * Calculates the monetary value of a 1.0 unit (price move of 1.00) for 1 standard lot
 * in the simulated account currency.
 */
export function calculatePointValueInAccountCurrency(
  spec,
  currentPrice,
  accountCurrency = 'USD',
  conversionRates = {}
) {
  // If quote currency is same as account currency:
  // For XAUUSD: 1 lot = 100 oz. $1.00 move = $100.00.
  // For EURUSD: 1 lot = 100,000 units. 1.00 move = $100,000.
  if (spec.quoteCurrency === accountCurrency) {
    return spec.contractSize;
  }

  // If quote currency differs from account currency:
  // e.g. USDJPY: Quote is JPY, Account is USD.
  // 1 pip = 0.01 JPY * 100,000 = 1,000 JPY.
  // In USD = 1,000 JPY / USDJPY rate.
  // 1.00 price move = 100,000 JPY / USDJPY rate.
  if (spec.baseCurrency === accountCurrency && currentPrice > 0) {
    return spec.contractSize / currentPrice;
  }

  // If cross rate requires conversion pair (e.g. EURGBP quoted in GBP, account is USD):
  const crossRateKey = `${spec.quoteCurrency}${accountCurrency}`;
  const inverseRateKey = `${accountCurrency}${spec.quoteCurrency}`;
  if (conversionRates[crossRateKey]) {
    return spec.contractSize * conversionRates[crossRateKey];
  }
  if (conversionRates[inverseRateKey] && conversionRates[inverseRateKey] > 0) {
    return spec.contractSize / conversionRates[inverseRateKey];
  }

  // If conversion rate is unavailable, disclose limitation and use 1.0 parity
  return {
    value: spec.contractSize,
    warning: `Historical conversion rate for ${spec.quoteCurrency} to ${accountCurrency} unavailable. Monetary results are approximate.`,
  };
}

/**
 * Clamps and rounds lot size to instrument lotStep, minLot, and maxLot.
 * Always floors to avoid exceeding maximum allowed monetary risk!
 */
export function normalizeLotSize(rawLots, spec) {
  if (!Number.isFinite(rawLots) || rawLots <= 0) return 0;

  const min = spec.minLot || 0.01;
  const max = spec.maxLot || 100.0;
  const step = spec.lotStep || 0.01;

  if (rawLots < min) return 0; // Less than minimum lot is invalid / rejected

  // Strict flooring to lotStep to guarantee risk limit is never exceeded
  const precision = Math.round(-Math.log10(step));
  const stepped = Math.floor((rawLots + 1e-9) / step) * step;
  const clamped = Math.min(max, Math.max(min, stepped));

  return Number(clamped.toFixed(precision));
}
