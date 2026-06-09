'use client';

import { memo, useEffect, useState } from 'react';
import { CalendarIcon, RefreshCw, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

const SessionSwitch = ({ id, label, checked, onCheckedChange }) => (
    <div className="flex items-center space-x-2">
        <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
        <Label htmlFor={id}>{label}</Label>
    </div>
);

export const TopBar = memo(function TopBar({ config, setConfig, onFetchData, isLoading, sessionSettings, setSessionSettings }) {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const handleDateChange = (date) => {
    setConfig((prev) => ({ ...prev, dateRange: date }));
  };
  
  return (
    <header className="flex flex-wrap items-center gap-4 border-b bg-card p-4">
      <div className="flex items-center gap-2">
        <label htmlFor="symbol" className="text-sm font-medium">Symbol</label>
        <Select
          value={config.symbol}
          onValueChange={(value) => setConfig(prev => ({ ...prev, symbol: value }))}
        >
          <SelectTrigger className="w-[180px]" id="symbol">
            <SelectValue placeholder="Symbol" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="XAU/USD">XAU/USD (Gold)</SelectItem>
            <SelectItem value="EUR/USD">EUR/USD</SelectItem>
            <SelectItem value="EUR/AUD">EUR/AUD</SelectItem>
            <SelectItem value="EUR/CAD">EUR/CAD</SelectItem>
            <SelectItem value="EUR/CHF">EUR/CHF</SelectItem>
            <SelectItem value="EUR/GBP">EUR/GBP</SelectItem>
            <SelectItem value="EUR/JPY">EUR/JPY</SelectItem>
            <SelectItem value="EUR/NZD">EUR/NZD</SelectItem>
            <SelectItem value="GBP/USD">GBP/USD</SelectItem>
            <SelectItem value="GBP/AUD">GBP/AUD</SelectItem>
            <SelectItem value="GBP/CAD">GBP/CAD</SelectItem>
            <SelectItem value="GBP/CHF">GBP/CHF</SelectItem>
            <SelectItem value="GBP/JPY">GBP/JPY</SelectItem>
            <SelectItem value="GBP/NZD">GBP/NZD</SelectItem>
            <SelectItem value="USD/JPY">USD/JPY</SelectItem>
            <SelectItem value="USD/CAD">USD/CAD</SelectItem>
            <SelectItem value="USD/CHF">USD/CHF</SelectItem>
            <SelectItem value="AUD/USD">AUD/USD</SelectItem>
            <SelectItem value="AUD/JPY">AUD/JPY</SelectItem>
            <SelectItem value="NZD/USD">NZD/USD</SelectItem>
            <SelectItem value="NZD/CAD">NZD/CAD</SelectItem>
            <SelectItem value="NZD/CHF">NZD/CHF</SelectItem>
            <SelectItem value="NZD/JPY">NZD/JPY</SelectItem>
            <SelectItem value="CAD/JPY">CAD/JPY</SelectItem>
            <SelectItem value="CHF/JPY">CHF/JPY</SelectItem>
            <SelectItem value="BTC/USD">BTC/USD</SelectItem>
            <SelectItem value="ETH/USD">ETH/USD</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="flex items-center gap-2">
        <label htmlFor="timeframe" className="text-sm font-medium">Timeframe</label>
        <Select
          value={config.timeframe}
          onValueChange={(value) => setConfig(prev => ({ ...prev, timeframe: value }))}
        >
          <SelectTrigger className="w-[120px]" id="timeframe">
            <SelectValue placeholder="Timeframe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1m">1 Minute</SelectItem>
            <SelectItem value="2m">2 Minutes</SelectItem>
            <SelectItem value="3m">3 Minutes</SelectItem>
            <SelectItem value="5m">5 Minutes</SelectItem>
            <SelectItem value="10m">10 Minutes</SelectItem>
            <SelectItem value="15m">15 Minutes</SelectItem>
            <SelectItem value="30m">30 Minutes</SelectItem>
            <SelectItem value="1h">1 Hour</SelectItem>
            <SelectItem value="4h">4 Hours</SelectItem>
            <SelectItem value="1D">1 Day</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
         <label className="text-sm font-medium">Date Range</label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              id="date"
              variant={"outline"}
              className={cn(
                "w-[260px] justify-start text-left font-normal",
                !config.dateRange && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {hasMounted && config.dateRange?.from ? (
                config.dateRange.to ? (
                  <>
                    {format(config.dateRange.from, "LLL dd, y")} -{" "}
                    {format(config.dateRange.to, "LLL dd, y")}
                  </>
                ) : (
                  format(config.dateRange.from, "LLL dd, y")
                )
              ) : (
                <span>Pick a date</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={config.dateRange?.from}
              selected={config.dateRange}
              onSelect={handleDateChange}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      </div>
      
      <Button onClick={onFetchData} disabled={isLoading} className="bg-primary hover:bg-primary/90 text-primary-foreground">
        <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
        {isLoading ? 'Loading...' : 'Load Data'}
      </Button>
      
      <div className="flex items-center gap-2 ml-auto">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <Settings2 className="mr-2 h-4 w-4"/>
              Session Overlay
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-4" align="end">
            <div className="grid gap-4">
              <div className="space-y-2">
                <h4 className="font-medium leading-none">Session Display</h4>
                <p className="text-sm text-muted-foreground">
                  Toggle Forex session bands on the chart.
                </p>
              </div>
              <Separator />
              <div className="grid gap-2">
                <SessionSwitch
                    id="session-master"
                    label="Enable Overlay"
                    checked={sessionSettings.enabled}
                    onCheckedChange={(checked) => setSessionSettings(prev => ({...prev, enabled: checked}))}
                />
                <SessionSwitch
                    id="session-asia"
                    label="Asia"
                    checked={sessionSettings.asia}
                    onCheckedChange={(checked) => setSessionSettings(prev => ({...prev, asia: checked}))}
                />
                 <SessionSwitch
                    id="session-london"
                    label="London"
                    checked={sessionSettings.london}
                    onCheckedChange={(checked) => setSessionSettings(prev => ({...prev, london: checked}))}
                />
                 <SessionSwitch
                    id="session-ny"
                    label="New York"
                    checked={sessionSettings.newYork}
                    onCheckedChange={(checked) => setSessionSettings(prev => ({...prev, newYork: checked}))}
                />
                 <SessionSwitch
                    id="session-overlaps"
                    label="Overlaps"
                    checked={sessionSettings.overlaps}
                    onCheckedChange={(checked) => setSessionSettings(prev => ({...prev, overlaps: checked}))}
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
});
