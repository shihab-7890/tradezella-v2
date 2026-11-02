'use client';

import { memo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export const TradeLog = memo(function TradeLog({ 
  tradeLog = [], 
  selectedTrade = null, 
  onSelectTrade = null 
}) {
  const exportToCSV = () => {
    if (tradeLog.length === 0) return;

    const headers = ['Time', 'Decision', 'Direction', 'Price', 'Score (0-100)', 'Grade', 'Trading Style', 'Strategy', 'Notes', 'Conflict'];
    const csvContent = [
      headers.join(','),
      ...tradeLog.map(log => [
        new Date(log.time).toLocaleString(),
        log.decision || (log.isApproved ? 'APPROVED' : 'WATCH'),
        log.direction || log.type,
        log.price,
        log.unifiedScore !== undefined ? log.unifiedScore : (log.score ? log.score * 10 : ''),
        log.qualityTier || '',
        log.tradingStyle || '',
        log.strategy || '',
        `"${log.notes || ''}"`,
        `"${log.conflictWarning || ''}"`,
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'trade_log.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };
  
  const getBadgeClass = (direction, isApproved) => {
    if (direction === 'BUY' || String(direction).includes('BUY')) {
      return isApproved ? 'bg-emerald-600 text-white' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
    }
    if (direction === 'SELL' || String(direction).includes('SELL')) {
      return isApproved ? 'bg-rose-600 text-white' : 'bg-rose-500/20 text-rose-400 border-rose-500/40';
    }
    return 'bg-muted text-muted-foreground';
  };

  const getGradeBadgeClass = (tier) => {
    switch (tier) {
      case 'A+': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 font-bold';
      case 'A': return 'bg-teal-500/20 text-teal-400 border-teal-500/50 font-bold';
      case 'B': return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
      case 'Watch': return 'bg-amber-500/20 text-amber-400 border-amber-500/50';
      case 'Low': return 'bg-rose-500/20 text-rose-400 border-rose-500/50';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <CardContent className="p-0">
      <div className="flex justify-between items-center p-2.5 border-b bg-card/40">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            Showing <span className="font-semibold text-foreground">{tradeLog.length}</span> physical setups
          </span>
          {selectedTrade && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-[11px] font-medium">
              <span>Selected on chart ({selectedTrade.type || selectedTrade.direction} @ {Number(selectedTrade.price).toFixed(2)})</span>
              <button 
                onClick={() => onSelectTrade?.(null)}
                className="hover:text-foreground underline ml-0.5"
                title="Deselect trade levels"
              >
                Clear
              </button>
            </span>
          )}
        </div>
        <Button onClick={exportToCSV} variant="outline" size="sm" className="h-7 text-xs" disabled={tradeLog.length === 0}>
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Export CSV
        </Button>
      </div>
      <div className="max-h-56 overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-card z-10">
            <TableRow className="text-xs">
              <TableHead>Time</TableHead>
              <TableHead>Decision</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Style</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Grade</TableHead>
              <TableHead>Strategy</TableHead>
              <TableHead>Confluence Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tradeLog.length > 0 ? (
              tradeLog.map((log, index) => {
                const scoreDisplay = log.unifiedScore !== undefined ? log.unifiedScore : (log.score ? Math.round(log.score * 10) : '-');
                const decisionText = log.decision || (log.isApproved ? `${log.direction} APPROVED` : 'WATCH');
                const isApproved = log.isApproved || decisionText.includes('APPROVED');
                
                const isSelected = selectedTrade && (
                  (selectedTrade.id && log.id && selectedTrade.id === log.id) ||
                  (selectedTrade.time === log.time && Number(selectedTrade.price) === Number(log.price))
                );

                return (
                  <TableRow 
                    key={log.id || index} 
                    onClick={() => onSelectTrade?.(isSelected ? null : log)}
                    className={cn(
                      "text-xs transition-colors cursor-pointer select-none",
                      isSelected 
                        ? "bg-primary/15 hover:bg-primary/20 border-l-2 border-primary" 
                        : "hover:bg-muted/40"
                    )}
                    title={isSelected ? "Click to deselect" : "Click to view Entry, SL & TP levels on chart"}
                  >
                    <TableCell className="font-mono text-[11px] whitespace-nowrap">
                      {new Date(log.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 font-bold", getBadgeClass(log.direction || log.type, isApproved))}>
                          {decisionText}
                        </Badge>
                        {log.conflictWarning && (
                          <span title={log.conflictWarning} className="text-amber-400 cursor-help">
                            <AlertCircle className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">{Number(log.price).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px] px-1 py-0">
                        {log.tradingStyle || 'Intraday'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold">{scoreDisplay}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", getGradeBadgeClass(log.qualityTier))}>
                        {log.qualityTier || 'B'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium truncate max-w-[120px]" title={log.strategy}>
                      {log.strategy}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-[11px] truncate max-w-[200px]" title={log.explanation || log.notes}>
                      {log.explanation || log.notes}
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                  No trades logged for current filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </CardContent>
  );
});
