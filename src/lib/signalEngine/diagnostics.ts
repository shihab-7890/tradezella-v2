import { SignalEngineDiagnostics, TradingSignal } from './types';

export class DiagnosticsCollector {
  private diagnostics: SignalEngineDiagnostics;

  constructor(symbol: string = 'UNKNOWN', timeframe: string = '15m', totalCandles: number = 0) {
    this.diagnostics = {
      symbol,
      timeframe,
      totalCandles,
      rawBuyCandidates: 0,
      rawSellCandidates: 0,
      confirmedBuySetups: 0,
      confirmedSellSetups: 0,
      approvedBuy: 0,
      approvedSell: 0,
      duplicatesSuppressed: 0,
      rejectedByScore: 0,
      rejectedByQualityFilter: 0,
      strategyBreakdown: {},
      rejectionReasons: {},
      htfTrendBreakdown: {
        bullishBars: 0,
        bearishBars: 0,
        rangingBars: 0,
      },
    };
  }

  public recordRawCandidate(direction: 'BUY' | 'SELL', strategy: string): void {
    if (direction === 'BUY') this.diagnostics.rawBuyCandidates++;
    else this.diagnostics.rawSellCandidates++;

    if (!this.diagnostics.strategyBreakdown[strategy]) {
      this.diagnostics.strategyBreakdown[strategy] = { buy: 0, sell: 0, approved: 0 };
    }
    if (direction === 'BUY') this.diagnostics.strategyBreakdown[strategy].buy++;
    else this.diagnostics.strategyBreakdown[strategy].sell++;
  }

  public recordConfirmedSetup(direction: 'BUY' | 'SELL'): void {
    if (direction === 'BUY') this.diagnostics.confirmedBuySetups++;
    else this.diagnostics.confirmedSellSetups++;
  }

  public recordApprovedSignal(signal: TradingSignal): void {
    if (signal.direction === 'BUY') this.diagnostics.approvedBuy++;
    else this.diagnostics.approvedSell++;

    const strat = signal.strategy || 'general';
    if (!this.diagnostics.strategyBreakdown[strat]) {
      this.diagnostics.strategyBreakdown[strat] = { buy: 0, sell: 0, approved: 0 };
    }
    this.diagnostics.strategyBreakdown[strat].approved++;
  }

  public recordRejection(reason: string, isScore: boolean = false): void {
    if (isScore) {
      this.diagnostics.rejectedByScore++;
    } else {
      this.diagnostics.rejectedByQualityFilter++;
    }
    this.diagnostics.rejectionReasons[reason] = (this.diagnostics.rejectionReasons[reason] || 0) + 1;
  }

  public recordDuplicatesSuppressed(count: number): void {
    this.diagnostics.duplicatesSuppressed += count;
  }

  public recordHtfBar(trend: 'BULLISH' | 'BEARISH' | 'Ranging'): void {
    if (trend === 'BULLISH') this.diagnostics.htfTrendBreakdown.bullishBars++;
    else if (trend === 'BEARISH') this.diagnostics.htfTrendBreakdown.bearishBars++;
    else this.diagnostics.htfTrendBreakdown.rangingBars++;
  }

  public getSummary(): SignalEngineDiagnostics {
    return { ...this.diagnostics };
  }

  public logSummary(): void {
    const d = this.diagnostics;
    console.log(
      `[Signal Diagnostics] ${d.symbol} (${d.timeframe}) | ` +
      `Candles: ${d.totalCandles} | ` +
      `Raw: [BUY ${d.rawBuyCandidates}, SELL ${d.rawSellCandidates}] | ` +
      `Confirmed: [BUY ${d.confirmedBuySetups}, SELL ${d.confirmedSellSetups}] | ` +
      `Approved: [BUY ${d.approvedBuy}, SELL ${d.approvedSell}] | ` +
      `Suppressed: ${d.duplicatesSuppressed} | ` +
      `Rejected Score: ${d.rejectedByScore}`
    );
  }
}
