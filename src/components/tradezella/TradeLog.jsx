'use client';

import { memo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download } from 'lucide-react';
import { cn } from '@/lib/utils';

export const TradeLog = memo(function TradeLog({ tradeLog }) {
  const exportToCSV = () => {
    if (tradeLog.length === 0) return;

    const headers = ['Time', 'Type', 'Price', 'Timeframe', 'Score', 'Quality', 'Strategy', 'Notes'];
    const csvContent = [
      headers.join(','),
      ...tradeLog.map(log => [
        new Date(log.time).toLocaleString(),
        log.type,
        log.price,
        log.timeframe,
        log.score?.toFixed(1) || '',
        log.qualityTier || '',
        log.strategy || '',
        `"${log.notes || ''}"`
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
  
  const getBadgeClass = (type) => {
     if (type.includes('BUY')) return 'bg-primary text-primary-foreground border-transparent';
     if (type.includes('SELL')) return 'bg-destructive text-destructive-foreground border-transparent';
     if (type.includes('SSL')) return 'bg-green-200 text-green-800 border-transparent dark:bg-green-800 dark:text-green-100';
     if (type.includes('BSL')) return 'bg-accent text-accent-foreground border-transparent';
     return '';
  }

  return (
    <CardContent className="p-0">
      <div className="flex justify-end p-2">
        <Button onClick={exportToCSV} variant="outline" size="sm" disabled={tradeLog.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>
      <div className="max-h-48 overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-card">
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Timeframe</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Quality</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tradeLog.length > 0 ? (
              tradeLog.map((log, index) => (
                <TableRow key={index}>
                  <TableCell>{new Date(log.time).toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn(getBadgeClass(log.type))}>{log.type}</Badge>
                  </TableCell>
                  <TableCell>{log.price.toFixed(4)}</TableCell>
                  <TableCell>{log.timeframe}</TableCell>
                  <TableCell>{log.score?.toFixed(1) || '-'}</TableCell>
                  <TableCell>{log.qualityTier || '-'}</TableCell>
                  <TableCell>{log.notes}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
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
