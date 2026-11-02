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
                    </SettingsSection>

                    <Separator />

                    <SettingsSection title="Candle Psychology & Waterfall Momentum (Phase 2)">
                        <SettingSwitch
                            id="enable-candle-psychology"
                            label="Enable Candle Engine"
                            tooltip="Activates standardized OHLC body/wick metrics and directional pressure analysis."
                            checked={settings.enableCandlePsychology !== false}
                            onCheckedChange={(checked) => handleValueChange('enableCandlePsychology', checked)}
                        />
                        <SettingSelect
                            id="candle-preset"
                            label="Filtering Preset"
                            tooltip="Controls candidate strictness: Light (more signals), Balanced (default), Selective (higher confirmation)."
                            value={settings.candlePreset || 'Balanced'}
                            onValueChange={(val) => handleValueChange('candlePreset', val)}
                            items={[
                                { value: 'Light', label: 'Light' },
                                { value: 'Balanced', label: 'Balanced' },
                                { value: 'Selective', label: 'Selective' },
                            ]}
                        />
                        <SettingSwitch
                            id="enable-waterfall"
                            label="Waterfall Momentum"
                            tooltip="Enables state machine for Bearish Waterfalls and Bullish Cascades."
                            checked={settings.enableWaterfall !== false}
                            onCheckedChange={(checked) => handleValueChange('enableWaterfall', checked)}
                        />
                        <SettingSwitch
                            id="enable-bearish-waterfall"
                            label="Bearish Waterfalls"
                            tooltip="Detects rapid downward momentum and setup continuations."
                            checked={settings.enableBearishWaterfall !== false}
                            onCheckedChange={(checked) => handleValueChange('enableBearishWaterfall', checked)}
                        />
                        <SettingSwitch
                            id="enable-bullish-cascade"
                            label="Bullish Cascades"
                            tooltip="Detects rapid upward momentum and setup continuations."
                            checked={settings.enableBullishCascade !== false}
                            onCheckedChange={(checked) => handleValueChange('enableBullishCascade', checked)}
                        />
                        <SettingSwitch
                            id="enable-pattern-rec"
                            label="Multi-Bar Patterns"
                            tooltip="Detects engulfing, pin bars, and 3-candle expansion sequences."
                            checked={settings.enablePatternRecognition !== false}
                            onCheckedChange={(checked) => handleValueChange('enablePatternRecognition', checked)}
                        />
                        <SettingSwitch
                            id="enable-exhaustion-reversal"
                            label="Exhaustion Reversals"
                            tooltip="Detects structural exhaustion + sweep + rejection for counter-trend entries."
                            checked={settings.enableExhaustionReversal !== false}
                            onCheckedChange={(checked) => handleValueChange('enableExhaustionReversal', checked)}
                        />
                        <SettingInput
                            id="min-body-ratio"
                            label="Min Body Ratio"
                            tooltip="Minimum body percentage of range for strong displacement bars (e.g., 0.65)."
                            value={settings.minBodyRatio || 0.65}
                            onChange={(e) => handleValueChange('minBodyRatio', e.target.value, true)}
                            step="0.05"
                            min="0.4"
                        />
                        <SettingInput
                            id="rejection-wick-ratio"
                            label="Rejection Wick Ratio"
                            tooltip="Minimum wick percentage of range to qualify as rejection (e.g., 0.45)."
                            value={settings.rejectionWickRatio || 0.45}
                            onChange={(e) => handleValueChange('rejectionWickRatio', e.target.value, true)}
                            step="0.05"
                            min="0.3"
                        />
                        <SettingSwitch
                            id="show-candle-markers"
                            label="Show Waterfall Markers"
                            tooltip="Render lightweight visual markers for Waterfall setups on the chart."
                            checked={settings.showCandlePsychologyMarkers !== false}
                            onCheckedChange={(checked) => handleValueChange('showCandlePsychologyMarkers', checked)}
                        />
                    </SettingsSection>

                    <Separator />

                    <SettingsSection title="Advanced Smart Money Concepts & Liquidity (Phase 3)">
                        <SettingSwitch
                            id="enable-smc-engine"
                            label="Enable SMC Engine"
                            tooltip="Activates internal/external structure, BOS/CHoCH, BSL/SSL pools, OBs, FVGs, and Auto Fibonacci."
                            checked={settings.enableSmcEngine !== false}
                            onCheckedChange={(checked) => handleValueChange('enableSmcEngine', checked)}
                        />
                        <SettingSelect
                            id="smc-preset"
                            label="SMC Filter Preset"
                            tooltip="Filtering preset: Light (more candidate setups), Balanced (default), Selective (higher confluence)."
                            value={settings.smcPreset || 'Balanced'}
                            onValueChange={(val) => handleValueChange('smcPreset', val)}
                            items={[
                                { value: 'Light', label: 'Light' },
                                { value: 'Balanced', label: 'Balanced' },
                                { value: 'Selective', label: 'Selective' },
                            ]}
                        />
                        <SettingSwitch
                            id="enable-bos-choch"
                            label="BOS & CHoCH"
                            tooltip="Tracks Break of Structure and Change of Character events."
                            checked={settings.enableBosChoch !== false}
                            onCheckedChange={(checked) => handleValueChange('enableBosChoch', checked)}
                        />
                        <SettingSwitch
                            id="enable-liquidity-intel"
                            label="Liquidity Pools (BSL/SSL)"
                            tooltip="Maps Buy-Side & Sell-Side liquidity pools and detects sweeps vs genuine breakouts."
                            checked={settings.enableLiquidityIntelligence !== false}
                            onCheckedChange={(checked) => handleValueChange('enableLiquidityIntelligence', checked)}
                        />
                        <SettingSwitch
                            id="enable-adv-ob"
                            label="Advanced Order Blocks"
                            tooltip="Tracks Bullish/Bearish Order Blocks, Breaker Blocks, and Mitigation lifecycle."
                            checked={settings.enableAdvancedOrderBlocks !== false}
                            onCheckedChange={(checked) => handleValueChange('enableAdvancedOrderBlocks', checked)}
                        />
                        <SettingSwitch
                            id="enable-adv-fvg"
                            label="Advanced FVG & IFVG"
                            tooltip="Tracks 3-candle Fair Value Gaps, Inverse FVGs, and midpoint reactions."
                            checked={settings.enableAdvancedFvg !== false}
                            onCheckedChange={(checked) => handleValueChange('enableAdvancedFvg', checked)}
                        />
                        <SettingSwitch
                            id="enable-auto-fib"
                            label="Auto Fibonacci & OTE"
                            tooltip="Automatically anchors Fibonacci retracements on confirmed swing high/low points."
                            checked={settings.enableAutoFibonacci !== false}
                            onCheckedChange={(checked) => handleValueChange('enableAutoFibonacci', checked)}
                        />
                        <SettingSwitch
                            id="enable-dealing-range"
                            label="Dealing Range (P/D)"
                            tooltip="Calculates Premium, Equilibrium, and Discount zones for structural dealing ranges."
                            checked={settings.enableDealingRange !== false}
                            onCheckedChange={(checked) => handleValueChange('enableDealingRange', checked)}
                        />
                        <SettingSwitch
                            id="show-smc-overlays"
                            label="Show SMC Overlays"
                            tooltip="Renders BOS/CHoCH lines, BSL/SSL pools, OB/FVG zones, and Fib levels on the chart."
                            checked={settings.showSmcOverlays !== false}
                            onCheckedChange={(checked) => handleValueChange('showSmcOverlays', checked)}
                        />
                    </SettingsSection>

                    <Separator />

                    <SettingsSection title="Auto Intelligence & Adaptive Engine (Phase 4)">
                        <SettingSelect
                            id="settings-mode"
                            label="Settings Mode"
                            tooltip="AUTO (fully automated strategy & threshold adaptation), HYBRID (adapts unlocked settings), MANUAL (manual control)."
                            value={settings.settingsMode || 'AUTO'}
                            onValueChange={(val) => handleValueChange('settingsMode', val)}
                            items={[
                                { value: 'AUTO', label: 'AUTO (Smart Adaptation)' },
                                { value: 'HYBRID', label: 'HYBRID (User Locks Active)' },
                                { value: 'MANUAL', label: 'MANUAL (Full Control)' },
                            ]}
                        />
                        <SettingSelect
                            id="trading-style"
                            label="Trading Style Profile"
                            tooltip="Scalping (1m-5m focus), Intraday (5m-15m focus), Swing (15m-1D focus)."
                            value={settings.tradingStyle || 'Intraday'}
                            onValueChange={(val) => handleValueChange('tradingStyle', val)}
                            items={[
                                { value: 'Scalping', label: 'Scalping (Fast Microstructure)' },
                                { value: 'Intraday', label: 'Intraday (Session Structure)' },
                                { value: 'Swing', label: 'Swing (HTF Macro Structure)' },
                            ]}
                        />
                        <SettingSwitch
                            id="enable-market-regime"
                            label="Regime Detection"
                            tooltip="Continuously classifies market direction (Bullish, Bearish, Range) and volatility."
                            checked={settings.enableMarketRegimeEngine !== false}
                            onCheckedChange={(checked) => handleValueChange('enableMarketRegimeEngine', checked)}
                        />
                        <SettingSwitch
                            id="enable-adaptive-settings"
                            label="Adaptive Thresholds"
                            tooltip="Dynamically adjusts displacement ATR and confluence score thresholds to market conditions."
                            checked={settings.enableAdaptiveSettings !== false}
                            onCheckedChange={(checked) => handleValueChange('enableAdaptiveSettings', checked)}
                        />
                        <SettingSwitch
                            id="show-regime-dashboard"
                            label="Show Regime Dashboard"
                            tooltip="Displays a sleek Market Intelligence HUD on top of the chart canvas."
                            checked={settings.showRegimeDashboard !== false}
                            onCheckedChange={(checked) => handleValueChange('showRegimeDashboard', checked)}
                        />
                    </SettingsSection>

                    <Separator />

                    <SettingsSection title="Professional Scalping Intelligence (Phase 5)">
                        <SettingSwitch
                            id="enable-scalping-engine"
                            label="Enable Scalping Engine"
                            tooltip="Activates dedicated 1m/3m/5m lower-timeframe micro-structure, waterfall, and sweep scalping."
                            checked={settings.enableScalpingEngine !== false}
                            onCheckedChange={(checked) => handleValueChange('enableScalpingEngine', checked)}
                        />
                        <SettingSelect
                            id="scalping-mode"
                            label="Scalping Preset"
                            tooltip="Light (more candidates), Balanced (default confirmation), Selective (high confluence)."
                            value={settings.scalpingMode || 'Balanced'}
                            onValueChange={(val) => handleValueChange('scalpingMode', val)}
                            items={[
                                { value: 'Light', label: 'Light (Frequent Opportunities)' },
                                { value: 'Balanced', label: 'Balanced (Standard Quality)' },
                                { value: 'Selective', label: 'Selective (Strict Confirmation)' },
                            ]}
                        />
                        <SettingSelect
                            id="scalping-entry-style"
                            label="Precision Entry Style"
                            tooltip="Early (Immediate on close), Balanced (Limit at 50% candle), Confirmed (Stop breakout)."
                            value={settings.scalpingEntryStyle || 'Balanced'}
                            onValueChange={(val) => handleValueChange('scalpingEntryStyle', val)}
                            items={[
                                { value: 'Early', label: 'Early (Market on Confirmation)' },
                                { value: 'Balanced', label: 'Balanced (Limit in Mid-Zone)' },
                                { value: 'Confirmed', label: 'Confirmed (Stop Breakout Trigger)' },
                            ]}
                        />
                        <SettingSwitch
                            id="enable-spread-filter"
                            label="Spread Feasibility Filter"
                            tooltip="Rejects setups where spread cost exceeds 25% of stop-loss risk distance."
                            checked={settings.enableSpreadFilter === true}
                            onCheckedChange={(checked) => handleValueChange('enableSpreadFilter', checked)}
                        />
                    </SettingsSection>

                    <Separator />

                    <SettingsSection title="Advanced Intraday & Swing Intelligence (Phase 6)">
                        <SettingSwitch
                            id="enable-intraday-engine"
                            label="Enable Intraday Engine"
                            tooltip="Activates session high/low sweeps, intraday BOS/CHoCH/MSS & 15m/1h session setups."
                            checked={settings.enableIntradayEngine !== false}
                            onCheckedChange={(checked) => handleValueChange('enableIntradayEngine', checked)}
                        />
                        <SettingSwitch
                            id="enable-swing-engine"
                            label="Enable Swing Engine"
                            tooltip="Activates macro trend continuation, deep Fibonacci (OTE 61.8%-70.5%), major OB/FVG & 200-300 pip target setups."
                            checked={settings.enableSwingEngine !== false}
                            onCheckedChange={(checked) => handleValueChange('enableSwingEngine', checked)}
                        />
                    </SettingsSection>

                    <Separator />

                    <SettingsSection title="Unified Signal Intelligence & Decision Engine (Phase 7)">
                        <SettingSwitch
                            id="enable-unified-engine"
                            label="Unified Decision Engine"
                            tooltip="Coalesces all strategy detections into unified physical setups with explainable 0-100 scoring."
                            checked={settings.enableUnifiedSignalEngine !== false}
                            onCheckedChange={(checked) => handleValueChange('enableUnifiedSignalEngine', checked)}
                        />
                        <SettingSelect
                            id="quality-preset"
                            label="Quality Filter Preset"
                            tooltip="Light (Score >= 50), Balanced (Score >= 60), Selective (Score >= 75 / High Confluence)."
                            value={settings.qualityPreset || 'Balanced'}
                            onValueChange={(val) => handleValueChange('qualityPreset', val)}
                            items={[
                                { value: 'Light', label: 'Light (Score ≥ 50 / More Setups)' },
                                { value: 'Balanced', label: 'Balanced (Score ≥ 60 / Standard)' },
                                { value: 'Selective', label: 'Selective (Score ≥ 75 / Grade A/A+)' },
                            ]}
                        />
                        <SettingInput
                            id="unified-score-threshold"
                            label="Unified Score Threshold (0–100)"
                            tooltip="Minimum 0–100 quality score required for trade approval when in MANUAL mode."
                            value={settings.unifiedScoreThreshold !== undefined ? settings.unifiedScoreThreshold : 60}
                            onChange={(e) => handleValueChange('unifiedScoreThreshold', parseFloat(e.target.value))}
                            step="5"
                            min="10"
                        />
                        <SettingSwitch
                            id="enable-conflict-resolution"
                            label="Multi-Strategy Conflict Resolution"
                            tooltip="Resolves contradictory BUY vs SELL setups at same price zones and manages cross-timeframe trades."
                            checked={settings.enableConflictAnalysis !== false}
                            onCheckedChange={(checked) => handleValueChange('enableConflictAnalysis', checked)}
                        />
                        <SettingSwitch
                            id="preserve-independent-styles"
                            label="Preserve Independent Styles"
                            tooltip="Allows concurrent Scalp SELL and Swing BUY if risk parameters and horizons are decoupled."
                            checked={settings.preserveIndependentStyles !== false}
                            onCheckedChange={(checked) => handleValueChange('preserveIndependentStyles', checked)}
                        />
                        <SettingInput
                            id="duplicate-window"
                            label="Deduplication Window (Candles)"
                            tooltip="Number of candles within which detections of the same physical move are clustered."
                            value={settings.duplicateWindowCandles || 4}
                            onChange={(e) => handleValueChange('duplicateWindowCandles', parseInt(e.target.value, 10))}
                            step="1"
                            min="1"
                        />
                    </SettingsSection>

                    <Separator />

                    <SettingsSection title="Dynamic Risk Management & Position Sizing (Phase 8)">
                        <SettingSwitch
                            id="enable-risk-engine"
                            label="Enable Dynamic Risk Engine"
                            tooltip="Activates instrument-aware lot sizing, precision multi-target exits, break-even ratchets and portfolio circuit breakers."
                            checked={settings.enableRiskEngine !== false}
                            onCheckedChange={(checked) => handleValueChange('enableRiskEngine', checked)}
                        />
                        <SettingInput
                            id="account-balance"
                            label="Simulated Account Capital ($)"
                            tooltip="Starting balance used for precise monetary risk budgeting and position sizing."
                            value={settings.simulatedAccountBalance || 10000}
                            onChange={(e) => handleValueChange('simulatedAccountBalance', parseFloat(e.target.value))}
                            step="500"
                            min="100"
                        />
                        <SettingSelect
                            id="risk-profile"
                            label="Risk Profile Preset"
                            tooltip="Conservative (0.5%), Balanced (1.0%), Aggressive (2.0%), or Dynamic (regime-adapted)."
                            value={settings.riskProfile || 'Balanced'}
                            onValueChange={(val) => handleValueChange('riskProfile', val)}
                            items={[
                                { value: 'Conservative', label: 'Conservative (0.5% / trade)' },
                                { value: 'Balanced', label: 'Balanced (1.0% / trade)' },
                                { value: 'Aggressive', label: 'Aggressive (2.0% / trade)' },
                                { value: 'Dynamic', label: 'Dynamic (Regime-Adapted)' },
                            ]}
                        />
                        <SettingInput
                            id="risk-per-trade-pct"
                            label="Risk Per Trade (%)"
                            tooltip="Percentage of account capital risked per position (hard capped at user limit)."
                            value={settings.riskPerTradePct !== undefined ? settings.riskPerTradePct : 1.0}
                            onChange={(e) => handleValueChange('riskPerTradePct', parseFloat(e.target.value))}
                            step="0.1"
                            min="0.1"
                        />
                        <SettingSelect
                            id="capital-basis"
                            label="Capital Sizing Basis"
                            tooltip="Balance basis ignores unrealized floating swings; Equity basis dynamically adjusts to floating equity."
                            value={settings.capitalBasis || 'Balance'}
                            onValueChange={(val) => handleValueChange('capitalBasis', val)}
                            items={[
                                { value: 'Balance', label: 'Balance Basis (Stable)' },
                                { value: 'Equity', label: 'Equity Basis (Compounding)' },
                            ]}
                        />
                        <SettingSelect
                            id="sl-method"
                            label="Stop Loss Calculation Method"
                            tooltip="Method used to establish invalidation price with directional boundary validation."
                            value={settings.stopLossMethod || 'HYBRID'}
                            onValueChange={(val) => handleValueChange('stopLossMethod', val)}
                            items={[
                                { value: 'HYBRID', label: 'Hybrid (Structure + Volatility Buffer)' },
                                { value: 'STRUCTURE', label: 'Market Structure (Recent Swing H/L)' },
                                { value: 'ATR', label: 'ATR Volatility Multiple' },
                                { value: 'LIQUIDITY', label: 'Liquidity Pool Invalidation' },
                                { value: 'ORDER_BLOCK', label: 'Order Block Boundary' },
                                { value: 'FIXED', label: 'Fixed Pips / Points' },
                            ]}
                        />
                        <SettingSelect
                            id="tp-method"
                            label="Take Profit Target Method"
                            tooltip="Method used to establish multi-stage profit targets (TP1 40%, TP2 35%, TP3 25%)."
                            value={settings.takeProfitMethod || 'HYBRID'}
                            onValueChange={(val) => handleValueChange('takeProfitMethod', val)}
                            items={[
                                { value: 'HYBRID', label: 'Hybrid (Multi-Stage R:R + Structural)' },
                                { value: 'FIXED_RR', label: 'Fixed Risk-to-Reward Multiple' },
                                { value: 'LIQUIDITY_TARGET', label: 'Opposing Liquidity Pool' },
                                { value: 'STRUCTURE_TARGET', label: 'Key HTF Structural Level' },
                            ]}
                        />
                        <SettingSwitch
                            id="enable-break-even"
                            label="Dynamic Break-Even Ratchet"
                            tooltip="Automatically moves stop loss to entry + cost buffer once +1R or TP1 is reached."
                            checked={settings.enableBreakEven !== false}
                            onCheckedChange={(checked) => handleValueChange('enableBreakEven', checked)}
                        />
                        <SettingInput
                            id="be-trigger-r"
                            label="Break-Even Trigger (R-Multiple)"
                            tooltip="Minimum favorable move in R-multiples before stop loss ratchets to cost-buffered entry."
                            value={settings.breakEvenTriggerR !== undefined ? settings.breakEvenTriggerR : 1.0}
                            onChange={(e) => handleValueChange('breakEvenTriggerR', parseFloat(e.target.value))}
                            step="0.25"
                            min="0.5"
                        />
                        <SettingSwitch
                            id="enable-trailing-stop"
                            label="Active Trailing Stop Engine"
                            tooltip="Enables dynamic trailing stop loss on runner portion of position with strict ratchet lock."
                            checked={settings.enableTrailingStop !== false}
                            onCheckedChange={(checked) => handleValueChange('enableTrailingStop', checked)}
                        />
                        <SettingSelect
                            id="trailing-method"
                            label="Trailing Stop Method"
                            tooltip="Dynamic trailing algorithm: ATR multiple, Swing structure, Candle extrema, or Hybrid."
                            value={settings.trailingMethod || 'ATR'}
                            onValueChange={(val) => handleValueChange('trailingMethod', val)}
                            items={[
                                { value: 'ATR', label: 'ATR Volatility Trailing' },
                                { value: 'STRUCTURAL', label: 'Structural Swing Pivot Stepping' },
                                { value: 'CANDLE', label: 'Previous Candle Extrema' },
                                { value: 'MOMENTUM', label: 'Exhaustion Momentum Tightening' },
                                { value: 'HYBRID', label: 'Hybrid Adaptive Trailing' },
                            ]}
                        />
                        <SettingInput
                            id="max-daily-loss"
                            label="Daily Loss Circuit Breaker (%)"
                            tooltip="Maximum permitted daily realized loss percentage before new trades are halted (Default 3%)."
                            value={settings.maxDailyLossPct || 3.0}
                            onChange={(e) => handleValueChange('maxDailyLossPct', parseFloat(e.target.value))}
                            step="0.5"
                            min="1.0"
                        />
                        <SettingInput
                            id="max-drawdown-limit"
                            label="Max Drawdown Safeguard (%)"
                            tooltip="Peak-to-trough account drawdown cap before risk engine pauses (Default 10%)."
                            value={settings.maxDrawdownLimitPct || 10.0}
                            onChange={(e) => handleValueChange('maxDrawdownLimitPct', parseFloat(e.target.value))}
                            step="1.0"
                            min="2.0"
                        />
                        <SettingSwitch
                            id="show-risk-overlay"
                            label="Show Chart Risk Overlay (SL / TP / BE)"
                            tooltip="Draws interactive Entry, Stop Loss, Break-Even, and Multi-Target Take Profit lines on the chart."
                            checked={settings.showRiskOverlay !== false}
                            onCheckedChange={(checked) => handleValueChange('showRiskOverlay', checked)}
                        />
                    </SettingsSection>
                </div>
            </ScrollArea>
        </CardContent>
    );
}

export default memo(StrategySettings);
