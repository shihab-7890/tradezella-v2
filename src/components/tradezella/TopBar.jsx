'use client';

import { memo, useEffect, useState } from 'react';
import { CalendarIcon, RefreshCw, Settings2, PanelRightOpen, PanelRightClose, Activity, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

const SessionSwitch = ({ id, label, checked, onCheckedChange }) => (
  <div className="flex items-center justify-between space-x-2">
    <Label htmlFor={id} className="text-xs text-gray-300">{label}</Label>
    <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
  </div>
);

const TIMEFRAMES = [
  { value: '1m', label: '1m' },
  { value: '3m', label: '3m' },
  { value: '5m', label: '5m' },
  { value: '15m', label: '15m' },
  { value: '1h', label: '1h' },
  { value: '4h', label: '4h' },
  { value: '1D', label: '1D' },
];

export const TopBar = memo(function TopBar({
  config,
  setConfig,
  onFetchData,
  isLoading,
  sessionSettings,
  setSessionSettings,
  sidebarOpen,
  setSidebarOpen,
  telemetry,
  isSimulated,
}) {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const handleDateChange = (date) => {
    setConfig((prev) => ({ ...prev, dateRange: date }));
  };

  return (
    <header className="flex h-12 w-full items-center justify-between border-b border-border/40 bg-[#090d14] px-3 text-xs text-foreground select-none shrink-0">
      {/* Left: Brand + Symbol & Timeframe Quick Selector */}
      <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar py-1">
        {/* Brand */}
        <div className="flex items-center gap-1.5 font-extrabold text-sm text-sky-400 shrink-0 pr-1 border-r border-white/10">
          <Activity className="h-4 w-4 text-sky-400" />
          <span className="hidden sm:inline bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">TradeZella</span>
          <span className="text-[10px] uppercase tracking-wider px-1 py-0.2 rounded bg-sky-500/10 text-sky-300 font-semibold border border-sky-500/20">Pro</span>
        </div>

        {/* Symbol Select */}
        <Select
          value={config.symbol}
          onValueChange={(value) => setConfig(prev => ({ ...prev, symbol: value }))}
        >
          <SelectTrigger className="h-8 w-[110px] sm:w-[130px] border-white/10 bg-white/5 text-xs font-bold text-white hover:bg-white/10 focus:ring-1 focus:ring-sky-500">
            <SelectValue placeholder="Symbol" />
          </SelectTrigger>
          <SelectContent className="bg-[#111827] border-white/10 text-white z-50">
            <SelectItem value="XAU/USD">XAU/USD (Gold)</SelectItem>
            <SelectItem value="EUR/USD">EUR/USD</SelectItem>
            <SelectItem value="GBP/USD">GBP/USD</SelectItem>
            <SelectItem value="USD/JPY">USD/JPY</SelectItem>
            <SelectItem value="AUD/USD">AUD/USD</SelectItem>
            <SelectItem value="USD/CAD">USD/CAD</SelectItem>
            <SelectItem value="USD/CHF">USD/CHF</SelectItem>
            <SelectItem value="EUR/JPY">EUR/JPY</SelectItem>
            <SelectItem value="GBP/JPY">GBP/JPY</SelectItem>
            <SelectItem value="BTC/USD">BTC/USD</SelectItem>
            <SelectItem value="ETH/USD">ETH/USD</SelectItem>
          </SelectContent>
        </Select>

        {/* Timeframe Quick Pills */}
        <div className="hidden sm:flex items-center gap-0.5 bg-white/5 p-0.5 rounded-lg border border-white/10">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setConfig(prev => ({ ...prev, timeframe: tf.value }))}
              className={cn(
                "h-7 px-2 rounded-md font-medium text-xs transition-colors",
                config.timeframe === tf.value
                  ? "bg-sky-500/20 text-sky-300 font-bold border border-sky-500/30"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              )}
            >
              {tf.label}
            </button>
          ))}
        </div>

        {/* Timeframe Dropdown for Mobile */}
        <div className="sm:hidden">
          <Select
            value={config.timeframe}
            onValueChange={(value) => setConfig(prev => ({ ...prev, timeframe: value }))}
          >
            <SelectTrigger className="h-8 w-[65px] border-white/10 bg-white/5 text-xs font-bold text-sky-300">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#111827] border-white/10 text-white">
              {TIMEFRAMES.map(tf => (
                <SelectItem key={tf.value} value={tf.value}>{tf.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Right: Date Picker, Load Data, Sessions, Feed status, Sidebar Toggle */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Data Feed Pill */}
        <div className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] bg-white/5 border border-white/10">
          <span className={cn("h-2 w-2 rounded-full animate-pulse", isSimulated ? "bg-amber-400" : "bg-emerald-400")} />
          <span className="text-gray-300 font-medium">
            {isSimulated ? 'Demo Feed' : 'Finage Real'}
          </span>
          {telemetry && (
            <span className="text-gray-500 text-[10px]">({telemetry.validCandles || 0} c)</span>
          )}
        </div>

        {/* Date Range Popover */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2.5 border-white/10 bg-white/5 text-xs text-gray-300 hover:text-white hover:bg-white/10"
            >
              <CalendarIcon className="mr-1.5 h-3.5 w-3.5 text-sky-400" />
              <span className="hidden md:inline">
                {hasMounted && config.dateRange?.from ? (
                  config.dateRange.to ? (
                    <>{format(config.dateRange.from, "MMM d")} - {format(config.dateRange.to, "MMM d")}</>
                  ) : (
                    format(config.dateRange.from, "MMM d")
                  )
                ) : (
                  "Range"
                )}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-[#111827] border-white/15 text-white shadow-2xl z-50" align="end">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={config.dateRange?.from}
              selected={config.dateRange}
              onSelect={handleDateChange}
              numberOfMonths={2}
              className="p-3 text-white"
            />
          </PopoverContent>
        </Popover>

        {/* Load Data Button */}
        <Button
          onClick={onFetchData}
          disabled={isLoading}
          size="sm"
          className="h-8 px-3 bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs transition-all shadow-sm gap-1.5"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
          <span className="hidden sm:inline">{isLoading ? 'Syncing...' : 'Sync Data'}</span>
        </Button>

        {/* Session Overlay Toggle */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" className="h-8 w-8 border-white/10 bg-white/5 text-gray-300 hover:text-white hover:bg-white/10" title="Session Overlay">
              <Settings2 className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-3 bg-[#111827] border-white/15 text-white shadow-2xl z-50" align="end">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="font-bold text-xs text-sky-400">Forex Sessions</span>
                <span className="text-[10px] text-gray-400">Chart Bands</span>
              </div>
              <div className="space-y-2">
                <SessionSwitch
                  id="session-master"
                  label="Enable Sessions"
                  checked={sessionSettings.enabled}
                  onCheckedChange={(checked) => setSessionSettings(prev => ({...prev, enabled: checked}))}
                />
                <Separator className="bg-white/10" />
                <SessionSwitch
                  id="session-asia"
                  label="Asia (00-09 UTC)"
                  checked={sessionSettings.asia}
                  onCheckedChange={(checked) => setSessionSettings(prev => ({...prev, asia: checked}))}
                />
                <SessionSwitch
                  id="session-london"
                  label="London (07-16 UTC)"
                  checked={sessionSettings.london}
                  onCheckedChange={(checked) => setSessionSettings(prev => ({...prev, london: checked}))}
                />
                <SessionSwitch
                  id="session-ny"
                  label="New York (12-21 UTC)"
                  checked={sessionSettings.newYork}
                  onCheckedChange={(checked) => setSessionSettings(prev => ({...prev, newYork: checked}))}
                />
                <SessionSwitch
                  id="session-overlaps"
                  label="Overlap Zones"
                  checked={sessionSettings.overlaps}
                  onCheckedChange={(checked) => setSessionSettings(prev => ({...prev, overlaps: checked}))}
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Desktop Sidebar Toggle Button */}
        {setSidebarOpen && (
          <Button
            variant="outline"
            size="icon"
            className={cn(
              "hidden md:flex h-8 w-8 border-white/10 transition-colors",
              sidebarOpen ? "bg-sky-500/20 text-sky-300 border-sky-500/30" : "bg-white/5 text-gray-400 hover:text-white"
            )}
            onClick={() => setSidebarOpen(prev => !prev)}
            title={sidebarOpen ? "Collapse Right Panel" : "Expand Right Panel"}
          >
            {sidebarOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
          </Button>
        )}
      </div>
    </header>
  );
});
