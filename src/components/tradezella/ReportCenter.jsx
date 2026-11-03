'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Download, FileText, FileSpreadsheet, Archive, CheckCircle2, Clock, Sparkles } from 'lucide-react';
import { REPORT_TYPES, buildReportArtifact } from '@/lib/reports/reportGenerator';

export function ReportCenter({ backtestRun, candles = [], config = {}, settings = {} }) {
  const [selectedReportType, setSelectedReportType] = useState('REPORT_A');
  const [selectedFormat, setSelectedFormat] = useState('PDF');
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportHistory, setReportHistory] = useState([]);

  const handleDownloadReport = useCallback(async () => {
    if (!backtestRun) return;
    setIsGenerating(true);

    try {
      const artifact = await buildReportArtifact(backtestRun, {
        reportType: selectedReportType,
        format: selectedFormat,
      });

      // Trigger browser download via Blob
      const blob = new Blob([artifact.artifact], { type: artifact.contentType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = artifact.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Add to Report History
      setReportHistory(prev => [
        {
          id: `rep-${Date.now()}`,
          name: artifact.filename,
          reportType: selectedReportType,
          format: selectedFormat,
          timestamp: new Date().toLocaleTimeString(),
          runId: backtestRun.runId,
          artifact,
        },
        ...prev,
      ]);
    } catch (err) {
      console.error('Report Generation & Download Failed:', err);
    } finally {
      setIsGenerating(false);
    }
  }, [backtestRun, selectedReportType, selectedFormat]);

  const handleDownloadHistoryItem = (item) => {
    const blob = new Blob([item.artifact.artifact], { type: item.artifact.contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = item.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const selectedTypeObj = REPORT_TYPES.find(r => r.id === selectedReportType) || REPORT_TYPES[0];

  return (
    <div className="flex flex-col gap-4 p-4 bg-card/50 rounded-2xl border">
      <div className="flex items-center justify-between border-b pb-3">
        <div>
          <h3 className="text-base font-bold text-foreground">Report Generation & Downloads Center</h3>
          <p className="text-xs text-muted-foreground">Generate and export institutional research reports in PDF, Excel, CSV, JSON, and ZIP packages.</p>
        </div>
        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">
          Phase 10 Production Ready
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Controls */}
        <div className="flex flex-col gap-3 p-4 bg-card rounded-xl border">
          <label className="text-xs font-semibold text-muted-foreground">Select Report Type</label>
          <Select value={selectedReportType} onValueChange={setSelectedReportType}>
            <SelectTrigger className="w-full text-xs">
              <SelectValue placeholder="Report Type" />
            </SelectTrigger>
            <SelectContent>
              {REPORT_TYPES.map(r => (
                <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <label className="text-xs font-semibold text-muted-foreground mt-2">Export Format</label>
          <Select value={selectedFormat} onValueChange={setSelectedFormat}>
            <SelectTrigger className="w-full text-xs">
              <SelectValue placeholder="Format" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PDF">PDF / Printable HTML Document</SelectItem>
              <SelectItem value="EXCEL">Excel Workbook (.xlsx)</SelectItem>
              <SelectItem value="CSV">Trades CSV (.csv)</SelectItem>
              <SelectItem value="JSON">Backtest Run JSON (.json)</SelectItem>
              <SelectItem value="ZIP">Complete Report Package (.zip)</SelectItem>
            </SelectContent>
          </Select>

          <Button 
            onClick={handleDownloadReport} 
            disabled={isGenerating || !backtestRun}
            className="w-full mt-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs"
          >
            <Download className={`mr-2 h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
            {isGenerating ? 'Generating Artifact...' : `Generate & Download ${selectedFormat}`}
          </Button>
        </div>

        {/* Selected Report Description Preview */}
        <div className="md:col-span-2 flex flex-col gap-3 p-4 bg-card/80 rounded-xl border">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <h4 className="text-sm font-bold">{selectedTypeObj.name}</h4>
          </div>
          <p className="text-xs text-muted-foreground">{selectedTypeObj.description}</p>

          {backtestRun ? (
            <div className="mt-auto p-3 rounded-lg border bg-muted/20 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div>Run ID: <strong className="font-mono">{backtestRun.runId}</strong></div>
              <div>Net PnL: <strong className={backtestRun.metrics?.netPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}>${backtestRun.metrics?.netPnl || 0}</strong></div>
              <div>Win Rate: <strong>{backtestRun.metrics?.winRate || 0}%</strong></div>
              <div>Total Trades: <strong>{backtestRun.metrics?.totalTrades || 0}</strong></div>
            </div>
          ) : (
            <div className="mt-auto p-3 rounded-lg border bg-amber-500/10 border-amber-500/20 text-amber-400 text-xs">
              Please run a Quantitative Backtest above first to generate downloadable reports.
            </div>
          )}
        </div>
      </div>

      {/* Report History */}
      {reportHistory.length > 0 && (
        <div className="flex flex-col gap-2 mt-2">
          <h4 className="text-xs font-bold text-muted-foreground uppercase">Generated Report History</h4>
          <div className="flex flex-col gap-1.5">
            {reportHistory.map(item => (
              <div key={item.id} className="flex items-center justify-between p-2 rounded-lg border bg-card/60 text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="font-medium">{item.name}</span>
                  <Badge variant="outline" className="text-[10px]">{item.format}</Badge>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground text-[11px]">{item.timestamp}</span>
                  <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => handleDownloadHistoryItem(item)}>
                    <Download className="w-3.5 h-3.5 mr-1" /> Re-Download
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
