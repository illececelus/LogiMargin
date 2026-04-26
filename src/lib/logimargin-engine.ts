import { z } from 'zod';

export const loadSchema = z.object({
  id: z.string().optional(),
  origin: z.string(),
  destination: z.string(),
  rate: z.number(),
  miles: z.number(),
  broker: z.string(),
  status: z.string().default('draft')
});

/**
 * AI Yük Analizi Shim
 */
export const analyzeTrip = (data: any) => {
  return { 
    success: true, 
    data: data, 
    scores: { profit: 0, risk: 'low' } 
  };
};

/**
 * Bakım Tahminleme Shim - İki parametre (vitals, cpm) zorunludur.
 */
export const detectMaintenanceAlerts = (vitals: any, cpm: any) => {
  return [];
};
