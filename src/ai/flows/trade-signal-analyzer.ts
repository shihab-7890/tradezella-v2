'use server';

/**
 * @fileOverview A trade signal analysis AI agent.
 * 
 * - analyzeTradeSignals - A function that handles the trade signal analysis process.
 * - AnalyzeTradeSignalsInput - The input type for the analyzeTradeSignals function.
 * - AnalyzeTradeSignalsOutput - The return type for the analyzeTradeSignals function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeTradeSignalsInputSchema = z.object({
  candles: z.array(
    z.object({
      time: z.number(),
      open: z.number(),
      high: z.number(),
      low: z.number(),
      close: z.number(),
      volume: z.number(),
    })
  ).describe('An array of candlestick data.'),
  equalHighs: z.array(
    z.object({
      price: z.number(),
      indices: z.array(z.number()),
    })
  ).optional().describe('An array of equal high liquidity pool data.'),
  equalLows: z.array(
    z.object({
      price: z.number(),
      indices: z.array(z.number()),
    })
  ).optional().describe('An array of equal low liquidity pool data.'),
  sslCandidates: z.array(z.number()).optional().describe('An array of indices for Sell-Side Liquidity sweep candidates.'),
  bslCandidates: z.array(z.number()).optional().describe('An array of indices for Buy-Side Liquidity sweep candidates.'),
  buyConfirmed: z.array(z.number()).optional().describe('An array of indices for confirmed Buy signals.'),
  sellConfirmed: z.array(z.number()).optional().describe('An array of indices for confirmed Sell signals.'),
  lookback: z.number().default(20).describe('Lookback period for liquidity pool detection.'),
  minWickRatio: z.number().default(0.2).describe('Minimum wick ratio as a percentage of price.'),
  equalTolerance: z.number().default(0.02).describe('Price delta threshold to treat highs/lows as equal (percentage).'),
  filterTinySweepsThreshold: z.number().optional().describe('Threshold to filter out insignificant liquidity sweeps.'),
  mssConfirmationRequired: z.boolean().default(true).describe('Whether Market Structure Shift confirmation is required for trade signals.'),
  enableAiTradeSignalAnalyzer: z.boolean().default(false).describe('Enable AI-powered trade signal analysis.'),
});
export type AnalyzeTradeSignalsInput = z.infer<typeof AnalyzeTradeSignalsInputSchema>;

const AnalyzeTradeSignalsOutputSchema = z.object({
  filteredCandles: z.array(
    z.object({
      time: z.number(),
      open: z.number(),
      high: z.number(),
      low: z.number(),
      close: z.number(),
      volume: z.number(),
    })
  ).describe('Filtered array of candlestick data based on AI analysis.'),
  tradeLog: z.array(
    z.object({
      time: z.number(),
      type: z.string(),
      price: z.number(),
      timeframe: z.string(),
      notes: z.string().optional(),
    })
  ).describe('Trade log with AI-filtered trade signals.'),
});
export type AnalyzeTradeSignalsOutput = z.infer<typeof AnalyzeTradeSignalsOutputSchema>;

export async function analyzeTradeSignals(input: AnalyzeTradeSignalsInput): Promise<AnalyzeTradeSignalsOutput> {
  return analyzeTradeSignalsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'tradeSignalAnalyzerPrompt',
  input: {schema: AnalyzeTradeSignalsInputSchema},
  output: {schema: AnalyzeTradeSignalsOutputSchema},
  prompt: `You are an expert trading signal analyst. Your goal is to filter the provided candlestick data and generate a trade log based on liquidity sweeps and market structure shift confirmations, considering the user-provided strategy settings.\n\nHere are the strategy settings:\nLookback: {{{lookback}}}\nMin Wick Ratio: {{{minWickRatio}}}\nEqual Tolerance: {{{equalTolerance}}}\nFilter Tiny Sweeps Threshold: {{{filterTinySweepsThreshold}}}\nMSS Confirmation Required: {{{mssConfirmationRequired}}}\n\nHere is the candlestick data:\n{{#each candles}}\n  Time: {{{time}}}, Open: {{{open}}}, High: {{{high}}}, Low: {{{low}}}, Close: {{{close}}}, Volume: {{{volume}}}\n{{/each}}\n\nEqual Highs: {{#each equalHighs}} Price: {{{price}}}, Indices: {{indices}} {{/each}}\nEqual Lows: {{#each equalLows}} Price: {{{price}}}, Indices: {{indices}} {{/each}}\nSSL Candidates: {{sslCandidates}}\nBSL Candidates: {{bslCandidates}}\nBuy Confirmed: {{buyConfirmed}}\nSell Confirmed: {{sellConfirmed}}\n\nBased on this information, provide a filtered list of candles and a trade log reflecting only the trade signals that meet the specified criteria. The trade log should include the time, type (SSL candidate / BSL candidate / BUY confirmed / SELL confirmed), price, timeframe, and any relevant notes (e.g., MSS confirmed, MSS disabled, equal pool price).\n\nEnsure that only signals triggered and/or confirmed at a given candle index are included in the trade log and the filtered candle data. Only show relevant trade data to the user. Leverage AI reasoning to determine which candles are appropriate to flag and incorporate, based on the configured strategy settings.\n\nYour output must conform to the AnalyzeTradeSignalsOutputSchema.\n`,
  config: {
    safetySettings: [
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_ONLY_HIGH',
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_LOW_AND_ABOVE',
      },
    ],
  },
});

const analyzeTradeSignalsFlow = ai.defineFlow(
  {
    name: 'analyzeTradeSignalsFlow',
    inputSchema: AnalyzeTradeSignalsInputSchema,
    outputSchema: AnalyzeTradeSignalsOutputSchema,
  },
  async input => {
    if (!input.enableAiTradeSignalAnalyzer) {
      return {
        filteredCandles: input.candles,
        tradeLog: [],
      };
    }
    const {output} = await prompt(input);
    return output!;
  }
);
