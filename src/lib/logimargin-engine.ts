import { z } from 'zod';

// --- SCHEMAS ---
export const loadSchema = z.object({
  id: z.string().optional(),
  origin: z.string(),
  destination: z.string(),
  rate: z.number(),
  miles: z.number(),
  broker: z.string(),
  status: z.string().default('draft')
});

export const AiParsedDocSchema = z.object({
  origin: z.string(),
  destination: z.string(),
  rate: z.number(),
  miles: z.number(),
  broker_name: z.string(),
  equipment_type: z.string().optional()
});

// --- ENGINE FUNCTIONS ---
export const analyzeTrip = (data: any) => ({ 
  success: true, 
  data, 
  scores: { profit: 0, risk: 'low' } 
});

export const calcRealProfit = (rate: number, miles: number, expenses: any) => ({
  net: rate - (miles * 1.5),
  margin: 20
});

export const evaluateBrokerRisk = (brokerName: string, history: any[]) => ({
  score: 'A',
  riskLevel: 'low',
  avgDaysToPay: 15
});

export const calcDetention = (startTime: string, endTime: string, rate: number = 50) => ({
  hours: 0,
  total: 0
});

export const detectMaintenanceAlerts = (vitals: any, cpm: any) => [];

// --- TYPES ---
export type BrokerDbRow = {
  id: string;
  name: string;
  rating: string;
};
