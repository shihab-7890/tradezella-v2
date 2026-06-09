'use client';

import { memo } from 'react';
import { CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

const SettingInput = ({ id, label, tooltip, value, onChange, type = 'number', step = '0.01', min }) => (
    <div className="flex flex-col gap-2">
        <Label htmlFor={id} className="flex items-center gap-1 text-sm">
            {label}
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{tooltip}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </Label>
        <Input
            id={id}
            type={type}
            value={value}
            onChange={onChange}
            step={step}
            min={min}
            className="h-8"
        />
    </div>
);

const SettingSwitch = ({ id, label, tooltip, checked, onCheckedChange }) => (
     <div className="flex flex-col gap-2">
        <Label htmlFor={id} className="flex items-center gap-1 text-sm whitespace-nowrap">
            {label}
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{tooltip}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </Label>
        <div className="h-8 flex items-center">
            <Switch
                id={id}
                checked={checked}
                onCheckedChange={onCheckedChange}
            />
        </div>
    </div>
);

const SettingSelect = ({ id, label, tooltip, value, onValueChange, items }) => (
    <div className="flex flex-col gap-2">
        <Label htmlFor={id} className="flex items-center gap-1 text-sm">
            {label}
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{tooltip}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </Label>
        <Select value={value} onValueChange={onValueChange}>
            <SelectTrigger className="h-8" id={id}>
                <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
                {items.map(item => (
                    <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                ))}
            </SelectContent>
        </Select>
    </div>
);

const SettingsSectionHeader = ({ title, onToggleAll, allOn }) => (
    <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-semibold">{title}</h3>
        {onToggleAll && (
            <Button variant="link" onClick={onToggleAll} className="p-0 h-auto text-xs">
                {allOn ? 'Turn All Off' : 'Turn All On'}
            </Button>
        )}
    </div>
);


const SettingsSection = ({ title, children, onToggleAll, allOn }) => (
    <div>
        <SettingsSectionHeader title={title} onToggleAll={onToggleAll} allOn={allOn} />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-7 gap-x-6 gap-y-4 items-start">
            {children}
        </div>
    </div>
);

function StrategySettings({ settings, setSettings }) {
    
    const handleValueChange = (key, value, isNumber = false, isPercentage = false) => {
        let finalValue = value;
        if (isNumber) {
            finalValue = Number(value);
            if (isPercentage) {
                 finalValue = finalValue / 100;
            }
        }
        setSettings(prev => ({ ...prev, [key]: finalValue }));
    };

    const handleStrategyChange = (key, value) => {
        setSettings(prev => ({ 
            ...prev, 
            strategy: { ...prev.strategy, [key]: value }
        }));
    };
    
    const handleToggleAll = (keys, groupKey = null) => {
        const source = groupKey ? settings[groupKey] : settings;
        const allCurrentlyOn = keys.every(key => source[key]);
        const newValues = keys.reduce((acc, key) => {
            acc[key] = !allCurrentlyOn;
            return acc;
        }, {});

        if (groupKey) {
            setSettings(prev => ({
                ...prev,
                [groupKey]: { ...prev[groupKey], ...newValues }
            }));
        } else {
            setSettings(prev => ({ ...prev, ...newValues }));
        }
    };

    const rangeStrategyKeys = ['liquiditySweep', 'breakerBlocks', 'mitigationBlock', 'institutionalRange', 'asianRange', 'powerOfThree', 'londonBreakout'];
    const trendStrategyKeys = ['obMss', 'fvgImbalance', 'liquidityVoid', 'obFvgConfluence', 'cobMss', 'classicBreakout', 'londonKillzone', 'newYorkKillzone', 'momentumSpike'];
    
    const areAllRangeOn = rangeStrategyKeys.every(key => settings.strategy[key]);
    const areAllTrendOn = trendStrategyKeys.every(key => settings.strategy[key]);
    
    const displayKeys = [
        'showLiquidityPools', 'showSweepWick', 'showMss', 
        'showBreakerBlocks', 'showMitigationBlocks', 'showFvgs', 'showAsianRange', 'showSLTP', 
        'showHtfTrends', 'showHtfKeyLevels', 'showCandidateOnlyMarkers', 'showOrderBlocks'
    ];
    const areAllDisplaysOn = displayKeys.every(key => settings[key]);


    return (
        <CardContent className="p-4 pt-2">
            <ScrollArea className="w-full h-auto">
                <div className="flex flex-col gap-6 pr-4 max-h-[60vh]">
                    <SettingsSection 
                        title="Range-bound or Balanced Markets Strategies"
                        onToggleAll={() => handleToggleAll(rangeStrategyKeys, 'strategy')}
                        allOn={areAllRangeOn}
                    >
                        {rangeStrategyKeys.map(key => (
                             <SettingSwitch
                                key={`strategy-${key}`}
                                id={`strategy-${key}`}
                                label={key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                                tooltip={`Enable/disable the ${key} strategy.`}
                                checked={settings.strategy[key]}
                                onCheckedChange={(checked) => handleStrategyChange(key, checked)}
                            />
                        ))}
                    </SettingsSection>

                    <Separator />

                    <SettingsSection 
                        title="Trend-following institutional-grade Strategies"
                        onToggleAll={() => handleToggleAll(trendStrategyKeys, 'strategy')}
                        allOn={areAllTrendOn}
                    >
                        {trendStrategyKeys.map(key => (
                            <SettingSwitch
                                key={`strategy-${key}`}
                                id={`strategy-${key}`}
                                label={key === 'obFvgConfluence' ? 'Sweep + OB + FVG' : key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                                tooltip={`Enable/disable the ${key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())} strategy.`}
                                checked={settings.strategy[key]}
                                onCheckedChange={(checked) => handleStrategyChange(key, checked)}
                            />
                        ))}
                    </SettingsSection>
                    
                    <Separator />

                    <SettingsSection title="Momentum Spike Settings">
                        <SettingInput
                            id="minRangeMultiplier"
                            label="Min Range (ATR)"
                            tooltip="Multiplier applied to ATR to define a 'large range' candle."
                            value={settings.minRangeMultiplier}
                            onChange={(e) => handleValueChange('minRangeMultiplier', e.target.value, true)}
                            step="0.1"
                            min="1.0"
                        />
                        <SettingInput
                            id="volumeSurgeFactor"
                            label="Volume Surge Factor"
                            tooltip="Multiple of the volume moving average required for confirmation."
                            value={settings.volumeSurgeFactor}
                            onChange={(e) => handleValueChange('volumeSurgeFactor', e.target.value, true)}
                            step="0.1"
                            min="1.0"
                        />
                        <SettingInput
                            id="bodyPercentageThreshold"
                            label="Body % Threshold"
                            tooltip="Minimum body percentage in the direction of the move to filter out wicks."
                            value={settings.bodyPercentageThreshold * 100}
                            onChange={(e) => handleValueChange('bodyPercentageThreshold', e.target.value, true, true)}
                            step="1"
                            min="0"
                        />
                        <SettingInput
                            id="atrPeriod"
                            label="ATR Period"
                            tooltip="Lookback period for calculating Average True Range."
                            value={settings.atrPeriod}
                            onChange={(e) => handleValueChange('atrPeriod', e.target.value, true)}
                            step="1"
                            min="1"
                        />
                        <SettingSwitch
                            id="requireMomentumBreakout"
                            label="Require Breakout"
                            tooltip="Whether the spike must break the highest high or lowest low of the last 10 candles."
                            checked={settings.requireMomentumBreakout}
                            onCheckedChange={(checked) => handleValueChange('requireMomentumBreakout', checked)}
                        />
                        <SettingSelect
                            id="momentumEntryType"
                            label="Entry Type"
                            tooltip="Choose between entering immediately or waiting for a retest."
                            value={settings.momentumEntryType}
                            onValueChange={(value) => handleValueChange('momentumEntryType', value)}
                            items={[
                                { value: 'Close of Spike', label: 'Close of Spike' },
                                { value: 'Retest of Spike Level', label: 'Retest of Spike' },
                            ]}
                        />
                    </SettingsSection>

                    <Separator />
                    
                    <SettingsSection title="Classic Breakout Settings">
                        <SettingInput
                            id="classicBreakoutLookback"
                            label="Consolidation Lookback"
                            tooltip="Number of bars to look back to define the consolidation range."
                            value={settings.classicBreakoutLookback}
                            onChange={(e) => handleValueChange('classicBreakoutLookback', e.target.value, true)}
                            step="1"
                            min="5"
                        />
                        <SettingSwitch
                            id="classicBreakoutVolumeSpike"
                            label="Require Volume Spike"
                            tooltip="Requires the breakout candle to have above-average volume."
                            checked={settings.classicBreakoutVolumeSpike}
                            onCheckedChange={(checked) => handleValueChange('classicBreakoutVolumeSpike', checked)}
                        />
                         <SettingSwitch
                            id="classicBreakoutEnableRetest"
                            label="Enable Retest Conf."
                            tooltip="Wait for price to retest the breakout level before entering."
                            checked={settings.classicBreakoutEnableRetest}
                            onCheckedChange={(checked) => handleValueChange('classicBreakoutEnableRetest', checked)}
                        />
                    </SettingsSection>


                    <Separator />

                    <SettingsSection title="ICT Power of Three">
                        <SettingSwitch
                            id="strategy-powerOfThree"
                            label="Power Of Three"
                            tooltip="Enable/disable the Power Of Three (AMD) strategy."
                            checked={settings.strategy.powerOfThree}
                            onCheckedChange={(checked) => handleStrategyChange('powerOfThree', checked)}
                        />
                        <SettingInput
                            id="powerOfThreeAccumulationLookback"
                            label="Accumulation Lookback"
                            tooltip="How many candles to look back to identify the accumulation phase."
                            value={settings.powerOfThreeAccumulationLookback}
                            onChange={(e) => handleValueChange('powerOfThreeAccumulationLookback', e.target.value, true)}
                            step="1"
                            min="10"
                        />
                    </SettingsSection>
                    
                    <SettingsSection title="Manipulation Phase Settings">
                        <SettingSwitch
                            id="observeManipulation"
                            label="Observe Manipulation"
                            tooltip="Enable or disable observation of the Manipulation phase."
                            checked={settings.observeManipulation}
                            onCheckedChange={(checked) => handleValueChange('observeManipulation', checked)}
                        />
                        <SettingInput
                            id="manipulationLookback"
                            label="Manipulation Lookback"
                            tooltip="Range over which manipulation breakouts are detected."
                            value={settings.manipulationLookback}
                            onChange={(e) => handleValueChange('manipulationLookback', e.target.value, true)}
                            step="1"
                            min="1"
                        />
                        <SettingSwitch
                            id="manipulationVolumeConfirmation"
                            label="Volume Confirmation"
                            tooltip="Confirm manipulation phase with above-average volume."
                            checked={settings.manipulationVolumeConfirmation}
                            onCheckedChange={(checked) => handleValueChange('manipulationVolumeConfirmation', checked)}
                        />
                        <SettingSwitch
                            id="requireCloseOutsideRange"
                            label="Require Close Outside Range"
                            tooltip="Require candle to close outside accumulation range during manipulation."
                            checked={settings.requireCloseOutsideRange}
                            onCheckedChange={(checked) => handleValueChange('requireCloseOutsideRange', checked)}
                        />
                    </SettingsSection>

                    <SettingsSection title="Distribution Phase Settings">
                        <SettingSwitch
                            id="enableDistributionEntries"
                            label="Enable Distribution Entries"
                            tooltip="Enable trade entries during the Distribution phase."
                            checked={settings.enableDistributionEntries}
                            onCheckedChange={(checked) => handleValueChange('enableDistributionEntries', checked)}
                        />
                        <SettingInput
                            id="distributionEntryLookback"
                            label="Entry Lookback"
                            tooltip="Retracement period into accumulation range for confirmed entries."
                            value={settings.distributionEntryLookback}
                            onChange={(e) => handleValueChange('distributionEntryLookback', e.target.value, true)}
                            step="1"
                            min="1"
                        />
                        <SettingInput
                            id="distributionRiskRewardRatio"
                            label="R:R Ratio"
                            tooltip="Risk-to-reward ratio for automatic take profit calculation."
                            value={settings.distributionRiskRewardRatio}
                            onChange={(e) => handleValueChange('distributionRiskRewardRatio', e.target.value, true)}
                            step="0.1"
                            min="0.1"
                        />
                        <SettingSwitch
                            id="distributionMssConfirmation"
                            label="MSS Confirmation"
                            tooltip="Only allow entries with validated Market Structure Shifts."
                            checked={settings.distributionMssConfirmation}
                            onCheckedChange={(checked) => handleValueChange('distributionMssConfirmation', checked)}
                        />
                    </SettingsSection>


                    <Separator />

                    <SettingsSection title="London Kill Zone Filter">
                        <SettingInput
                            id="londonKzStartTime"
                            label="Start Time (GMT)"
                            tooltip="The GMT hour for the London Kill Zone to start (e.g., 8 for 8:00 AM)."
                            value={settings.londonKzStartTime}
                            onChange={(e) => handleValueChange('londonKzStartTime', e.target.value, true)}
                            step="1"
                            min="0"
                        />
                        <SettingInput
                            id="londonKzEndTime"
                            label="End Time (GMT)"
                            tooltip="The GMT hour for the London Kill Zone to end (e.g., 12 for 12:00 PM)."
                            value={settings.londonKzEndTime}
                            onChange={(e) => handleValueChange('londonKzEndTime', e.target.value, true)}
                            step="1"
                            min="0"
                        />
                        <SettingSwitch
                            id="londonKzVolumeConfirmation"
                            label="Volume Confirmation"
                            tooltip="Requires above-average volume on the sweep for a valid signal."
                            checked={settings.londonKzVolumeConfirmation}
                            onCheckedChange={(checked) => handleValueChange('londonKzVolumeConfirmation', checked)}
                        />
                    </SettingsSection>

                    <Separator />

                    <SettingsSection title="New York Kill Zone Filter">
                        <SettingInput
                            id="newYorkKzStartTime"
                            label="Start Time (GMT)"
                            tooltip="The GMT hour for the New York Kill Zone to start (e.g., 13 for 1:00 PM)."
                            value={settings.newYorkKzStartTime}
                            onChange={(e) => handleValueChange('newYorkKzStartTime', e.target.value, true)}
                            step="1"
                            min="0"
                        />
                        <SettingInput
                            id="newYorkKzEndTime"
                            label="End Time (GMT)"
                            tooltip="The GMT hour for the New York Kill Zone to end (e.g., 17 for 5:00 PM)."
                            value={settings.newYorkKzEndTime}
                            onChange={(e) => handleValueChange('newYorkKzEndTime', e.target.value, true)}
                            step="1"
                            min="0"
                        />
                        <SettingSwitch
                            id="newYorkKzVolumeConfirmation"
                            label="Volume Confirmation"
                            tooltip="Requires above-average volume on the sweep for a valid signal."
                            checked={settings.newYorkKzVolumeConfirmation}
                            onCheckedChange={(checked) => handleValueChange('newYorkKzVolumeConfirmation', checked)}
                        />
                    </SettingsSection>
                    
                    <Separator />

                    <SettingsSection title="Continuation OB + MSS">
                        <SettingInput
                            id="cobLookbackPeriod"
                            label="COB Lookback"
                            tooltip="How far back to search for a valid Continuation Order Block."
                            value={settings.cobLookbackPeriod}
                            onChange={(e) => handleValueChange('cobLookbackPeriod', e.target.value, true)}
                            step="1"
                            min="1"
                        />
                        <SettingInput
                            id="cobMinBodyPercentage"
                            label="Min COB Body (%)"
                            tooltip="The body of the OB must be at least this percentage of its total range."
                            value={settings.cobMinBodyPercentage * 100}
                            onChange={(e) => handleValueChange('cobMinBodyPercentage', e.target.value, true, true)}
                            step="1"
                            min="0"
                        />
                        <SettingSwitch
                            id="cobRequireMssConfirmation"
                            label="Require MSS Conf."
                            tooltip="Requires a Market Structure Shift on the LTF for a valid signal."
                            checked={settings.cobRequireMssConfirmation}
                            onCheckedChange={(checked) => handleValueChange('cobRequireMssConfirmation', checked)}
                        />
                        <SettingSwitch
                            id="cobAllowRefinedEntry"
                            label="Refined Entry"
                            tooltip="Allow entry on a smaller OB/FVG formed after the MSS for a tighter SL."
                            checked={settings.cobAllowRefinedEntry}
                            onCheckedChange={(checked) => handleValueChange('cobAllowRefinedEntry', checked)}
                        />
                    </SettingsSection>
                    
                    <Separator />
                    
                     <SettingsSection title="FVG / Imbalance Settings">
                        <SettingSwitch
                            id="detect-imbalance-zones"
                            label="Detect Imbalance Zones"
                            tooltip="Group adjacent FVGs into larger, higher probability zones."
                            checked={settings.detectInstitutionalImbalanceZones}
                            onCheckedChange={(checked) => handleValueChange('detectInstitutionalImbalanceZones', checked)}
                        />
                        <SettingSwitch
                            id="only-show-zones-threshold"
                            label="Only Show Zones > Threshold"
                            tooltip="Only display zones comprised of a minimum number of FVGs."
                            checked={settings.onlyShowZonesAboveThreshold}
                            onCheckedChange={(checked) => handleValueChange('onlyShowZonesAboveThreshold', checked)}
                        />
                        <SettingInput
                            id="min-fvgs-per-zone"
                            label="Min FVGs per Zone"
                            tooltip="The minimum number of merged FVGs to form an Imbalance Zone."
                            value={settings.minFvgsPerZone}
                            onChange={(e) => handleValueChange('minFvgsPerZone', e.target.value, true)}
                            step="1"
                            min="1"
                        />
                    </SettingsSection>
                    
                    <Separator />
                    
                     <SettingsSection title="Breaker Block Settings">
                         <SettingSelect
                            id="breakerBlockConfirmation"
                            label="Confirmation Type"
                            tooltip="Define confirmation condition for valid Breaker Block retest."
                            value={settings.breakerBlockConfirmation}
                            onValueChange={(value) => handleValueChange('breakerBlockConfirmation', value)}
                            items={[
                                { value: 'Candle Rejection', label: 'Candle Rejection' },
                                { value: 'FVG', label: 'FVG Confirmation' },
                                { value: 'MSS', label: 'MSS Confirmation' },
                            ]}
                        />
                    </SettingsSection>

                    <Separator />

                    <SettingsSection title="Mitigation Block Settings">
                        <SettingSelect
                            id="mitigationBlockConfirmation"
                            label="Confirmation Type"
                            tooltip="Define confirmation condition for valid mitigation."
                            value={settings.mitigationBlockConfirmation}
                            onValueChange={(value) => handleValueChange('mitigationBlockConfirmation', value)}
                            items={[
                                { value: 'Rejection Candle', label: 'Rejection Candle' },
                                { value: 'FVG', label: 'FVG Confirmation' },
                                { value: 'MSS', label: 'MSS Confirmation' },
                            ]}
                        />
                    </SettingsSection>
                    
                    <Separator />
                    
                    <SettingsSection title="Order Block Scoring">
                        <SettingSwitch
                            id="enable-ob-scoring"
                            label="Enable OB Scoring"
                            tooltip="Only highlight and trade Order Blocks that meet a minimum strength score."
                            checked={settings.enableOrderBlockScoring}
                            onCheckedChange={(checked) => handleValueChange('enableOrderBlockScoring', checked)}
                        />
                        <SettingInput
                            id="min-ob-score"
                            label="Minimum OB Score"
                            tooltip="The minimum score required for an Order Block to be considered valid (Max 5)."
                            value={settings.minObScore}
                            onChange={(e) => handleValueChange('minObScore', e.target.value, true)}
                            step="0.5"
                            min="0"
                        />
                    </SettingsSection>

                    <Separator />

                    <SettingsSection title="Liquidity Sweep Filters">
                        <SettingSwitch
                            id="enable-qualified-sweep"
                            label="Enable Qualified Filters"
                            tooltip="Apply additional filters to Liquidity Sweeps for higher quality signals."
                            checked={settings.enableQualifiedSweepFilters}
                            onCheckedChange={(checked) => handleValueChange('enableQualifiedSweepFilters', checked)}
                        />
                        <SettingSwitch
                            id="require-volume-conf"
                            label="Require Volume Conf."
                            tooltip="Only validate sweeps with above-average volume."
                            checked={settings.requireVolumeConfirmation}
                            onCheckedChange={(checked) => handleValueChange('requireVolumeConfirmation', checked)}
                        />
                        <SettingInput
                            id="min-wick-size"
                            label="Min. Wick Size (%)"
                            tooltip="Minimum percentage of the candle's range the wick must constitute."
                            value={settings.minQualifiedWickSize * 100}
                            onChange={(e) => handleValueChange('minQualifiedWickSize', e.target.value, true, true)}
                            step="1"
                            min="0"
                        />
                        <SettingInput
                            id="volume-ma-period"
                            label="Volume MA Period"
                            tooltip="Period for the moving average of volume."
                            value={settings.volumeMaPeriod}
                            onChange={(e) => handleValueChange('volumeMaPeriod', e.target.value, true)}
                            step="1"
                            min="1"
                        />
                    </SettingsSection>

                    <Separator />

                    <SettingsSection title="Multi-Timeframe Confluence Engine">
                        <SettingSwitch
                            id="enable-mtf-engine"
                            label="Enable MTF Engine"
                            tooltip="Filters all signals through higher-timeframe trend and key level analysis for higher probability."
                            checked={settings.enableMtfEngine}
                            onCheckedChange={(checked) => handleValueChange('enableMtfEngine', checked)}
                        />
                        <SettingSelect
                            id="htfTimeframe"
                            label="HTF for Analysis"
                            tooltip="Select the higher timeframe to use for confluence analysis."
                            value={settings.htfTimeframe}
                            onValueChange={(value) => handleValueChange('htfTimeframe', value)}
                            items={[
                                { value: '30m', label: '30 Minutes' },
                                { value: '1h', label: '1 Hour' },
                                { value: '4h', label: '4 hours' },
                                { value: '1D', label: '1 Day' },
                            ]}
                        />
                        <SettingInput
                            id="confluenceScoreThreshold"
                            label="Confluence Score"
                            tooltip="Minimum score required for a signal to be approved (default: 3)."
                            value={settings.confluenceScoreThreshold}
                            onChange={(e) => handleValueChange('confluenceScoreThreshold', e.target.value, true)}
                            step="0.5"
                            min="0"
                        />
                        <SettingSwitch
                            id="volumeConfirmationGlobal"
                            label="Global Volume Filter"
                            tooltip="Require confirmed signals to have at least 1.2x recent average volume when volume data is available."
                            checked={settings.volumeConfirmationGlobal}
                            onCheckedChange={(checked) => handleValueChange('volumeConfirmationGlobal', checked)}
                        />
                        <SettingInput
                            id="minimumDisplacementAtr"
                            label="Min Displacement ATR"
                            tooltip="Minimum recent candle body size as a multiple of ATR for confirmed signals."
                            value={settings.minimumDisplacementAtr}
                            onChange={(e) => handleValueChange('minimumDisplacementAtr', e.target.value, true)}
                            step="0.1"
                            min="0"
                        />
                        <SettingInput
                            id="minCandlesBetweenSignals"
                            label="Signal Spacing"
                            tooltip="Minimum candles between approved signals after priority filtering."
                            value={settings.minCandlesBetweenSignals}
                            onChange={(e) => handleValueChange('minCandlesBetweenSignals', e.target.value, true)}
                            step="1"
                            min="0"
                        />
                        <SettingSwitch
                            id="showOnlyHighQuality"
                            label="Only A+ Signals"
                            tooltip="Only show approved signals with confluence score of 5 or higher."
                            checked={settings.showOnlyHighQuality}
                            onCheckedChange={(checked) => handleValueChange('showOnlyHighQuality', checked)}
                        />
                         <SettingSwitch
                            id="show-sl-tp"
                            label="Show SL/TP Lines"
                            tooltip="Show/Hide Stop-Loss and Take-Profit lines for approved signals."
                            checked={settings.showSLTP}
                            onCheckedChange={(checked) => handleValueChange('showSLTP', checked)}
                        />
                        <SettingInput
                            id="keyLevelProximity"
                            label="Key Level Proximity (%)"
                            tooltip="Percentage distance from HTF key level to consider for confluence (default: 0.5%)."
                            value={settings.keyLevelProximity * 100}
                            onChange={(e) => handleValueChange('keyLevelProximity', e.target.value, true, true)}
                            step="0.01"
                            min="0"
                        />
                        <SettingInput
                            id="defaultRiskRewardRatio"
                            label="Default R:R Ratio"
                            tooltip="Default R:R ratio for take-profit calculation (e.g., 1.5 for 1:1.5)."
                            value={settings.defaultRiskRewardRatio}
                            onChange={(e) => handleValueChange('defaultRiskRewardRatio', e.target.value, true)}
                            step="0.1"
                            min="0.1"
                        />
                    </SettingsSection>
                    
                    <Separator />
                    
                    <SettingsSection title="General Settings">
                        <SettingInput
                            id="lookback"
                            label="Lookback"
                            tooltip="Number of past candles to check for liquidity pools."
                            value={settings.lookback}
                            onChange={(e) => handleValueChange('lookback', e.target.value, true)}
                            step="1"
                            min="1"
                        />
                        <SettingInput
                            id="minWickRatio"
                            label="Min Wick Ratio (%)"
                            tooltip="Minimum wick size as a percentage of price to be considered significant."
                            value={settings.minWickRatio * 100}
                            onChange={(e) => handleValueChange('minWickRatio', e.target.value, true, true)}
                             min="0"
                        />
                        <SettingInput
                            id="equalTolerance"
                            label="Equal Tolerance (%)"
                            tooltip="Price delta threshold to treat highs/lows as equal."
                            value={settings.equalTolerance * 100}
                            onChange={(e) => handleValueChange('equalTolerance', e.target.value, true, true)}
                             min="0"
                        />
                        <SettingInput
                            id="filterTinySweeps"
                            label="Filter Sweeps Threshold"
                            tooltip="Threshold to filter out insignificant liquidity sweeps."
                            value={settings.filterTinySweepsThreshold}
                            onChange={(e) => handleValueChange('filterTinySweepsThreshold', e.target.value, true)}
                             min="0"
                        />
                        <SettingSwitch
                            id="mss-confirmation"
                            label="MSS Confirmation"
                            tooltip="Require Market Structure Shift for a confirmed signal."
                            checked={settings.mssConfirmationRequired}
                            onCheckedChange={(checked) => handleValueChange('mssConfirmationRequired', checked)}
                        />
                        <SettingSwitch
                            id="ai-analyzer"
                            label="AI Analyzer"
                            tooltip="Enable AI-powered filtering of trade signals."
                            checked={settings.enableAiTradeSignalAnalyzer}
                            onCheckedChange={(checked) => handleValueChange('enableAiTradeSignalAnalyzer', checked)}
                        />
                    </SettingsSection>
                    
                    <Separator />
                    
                    <SettingsSection 
                        title="Chart Display"
                        onToggleAll={() => handleToggleAll(displayKeys)}
                        allOn={areAllDisplaysOn}
                    >
                        <SettingSwitch
                            id="show-liquidity-pools"
                            label="Show Liquidity"
                            tooltip="Show/Hide liquidity pool lines."
                            checked={settings.showLiquidityPools}
                            onCheckedChange={(checked) => handleValueChange('showLiquidityPools', checked)}
                        />
                        <SettingSwitch
                            id="show-sweep-wick"
                            label="Show Sweep Wick"
                            tooltip="Show/Hide circle markers for liquidity sweep wicks."
                            checked={settings.showSweepWick}
                            onCheckedChange={(checked) => handleValueChange('showSweepWick', checked)}
                        />
                        <SettingSwitch
                            id="show-mss"
                            label="Show MSS"
                            tooltip="Show/Hide triangle markers for Market Structure Shifts."
                            checked={settings.showMss}
                            onCheckedChange={(checked) => handleValueChange('showMss', checked)}
                        />
                         <SettingSwitch
                            id="show-order-blocks"
                            label="Show Order Blocks"
                            tooltip="Show/Hide highlighted Order Block zones."
                            checked={settings.showOrderBlocks}
                            onCheckedChange={(checked) => handleValueChange('showOrderBlocks', checked)}
                        />
                        <SettingSwitch
                            id="show-breaker-blocks"
                            label="Show Breaker Blocks"
                            tooltip="Show/Hide highlighted Breaker Block zones."
                            checked={settings.showBreakerBlocks}
                            onCheckedChange={(checked) => handleValueChange('showBreakerBlocks', checked)}
                        />
                        <SettingSwitch
                            id="show-mitigation-blocks"
                            label="Show Mitigation Blocks"
                            tooltip="Show/Hide highlighted Mitigation Block zones."
                            checked={settings.showMitigationBlocks}
                            onCheckedChange={(checked) => handleValueChange('showMitigationBlocks', checked)}
                        />
                        <SettingSwitch
                            id="show-fvgs"
                            label="Show FVG"
                            tooltip="Show/Hide Fair Value Gap zones."
                            checked={settings.showFvgs}
                            onCheckedChange={(checked) => handleValueChange('showFvgs', checked)}
                        />
                        <SettingSwitch
                            id="show-asian-range"
                            label="Show Asian Range"
                            tooltip="Show/Hide the Asian session range box."
                            checked={settings.showAsianRange}
                            onCheckedChange={(checked) => handleValueChange('showAsianRange', checked)}
                        />
                         <SettingSwitch
                            id="showHtfTrends"
                            label="Show HTF Trend"
                            tooltip="Displays higher-timeframe trend direction on the chart."
                            checked={settings.showHtfTrends}
                            onCheckedChange={(checked) => handleValueChange('showHtfTrends', checked)}
                        />
                        <SettingSwitch
                            id="showHtfKeyLevels"
                            label="Show HTF Key Levels"
                            tooltip="Displays significant support/resistance levels from higher timeframes."
                            checked={settings.showHtfKeyLevels}
                            onCheckedChange={(checked) => handleValueChange('showHtfKeyLevels', checked)}
                        />
                         <SettingSwitch
                            id="show-candidates"
                            label="Show Candidates"
                            tooltip="Show markers for sweep candidates before confirmation."
                            checked={settings.showCandidateOnlyMarkers}
                            onCheckedChange={(checked) => handleValueChange('showCandidateOnlyMarkers', checked)}
                        />
                    </SettingsSection>
                </div>
            </ScrollArea>
        </CardContent>
    );
}

export default memo(StrategySettings);
