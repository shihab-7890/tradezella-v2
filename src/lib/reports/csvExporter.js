/**
 * Phase 10 — Formula-Injection Safe CSV Exporter
 * Generates RFC 4180 compliant CSV strings with formula injection protection (=, +, -, @)
 * and UTF-8 BOM encoding.
 */

export function sanitizeCsvField(field) {
  if (field === null || field === undefined) return '""';
  let str = String(field);

  // Formula injection protection: prepend single quote if value begins with =, +, -, @, \t, \r
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // Escape double quotes and enclose in quotes
  return `"${str.replace(/"/g, '""')}"`;
}

export function generateCsvFromObjects(data = [], columns = []) {
  if (!data || data.length === 0) return '';

  const headers = columns.map(c => sanitizeCsvField(c.label || c.key)).join(',');
  const rows = data.map(row => {
    return columns.map(c => {
      const val = row[c.key];
      const formatted = c.formatter ? c.formatter(val, row) : val;
      return sanitizeCsvField(formatted);
    }).join(',');
  });

  return '\uFEFF' + [headers, ...rows].join('\n'); // Prepend UTF-8 BOM
}

export function exportTradesToCsv(trades = []) {
  const columns = [
    { key: 'time', label: 'Time', formatter: val => new Date(val).toISOString() },
    { key: 'decision', label: 'Decision', formatter: (val, row) => val || (row.isApproved ? 'APPROVED' : 'WATCH') },
    { key: 'direction', label: 'Direction' },
    { key: 'price', label: 'Entry Price', formatter: val => Number(val || 0).toFixed(4) },
    { key: 'sl', label: 'Stop Loss', formatter: val => val ? Number(val).toFixed(4) : '' },
    { key: 'tp', label: 'Take Profit', formatter: val => val ? Number(val).toFixed(4) : '' },
    { key: 'unifiedScore', label: 'Score', formatter: (val, row) => val !== undefined ? val : (row.score ? Math.round(row.score * 10) : '') },
    { key: 'qualityTier', label: 'Grade', formatter: (val) => val || 'B' },
    { key: 'tradingStyle', label: 'Style', formatter: (val, row) => val || row?.tradingStyle || 'Intraday' },
    { key: 'strategy', label: 'Strategy' },
    { key: 'realizedPnl', label: 'Realized PnL ($)', formatter: val => val !== undefined ? Number(val).toFixed(2) : '0.00' },
    { key: 'realizedR', label: 'R-Multiple', formatter: val => val !== undefined ? Number(val).toFixed(2) : '' },
    { key: 'notes', label: 'Notes' },
  ];

  return generateCsvFromObjects(trades, columns);
}
