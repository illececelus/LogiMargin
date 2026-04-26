import { z } from 'zod';

export const AiLoadSchema = z.object({
  origin: z.string().min(2, "Origin required"),
  destination: z.string().min(2, "Destination required"),
  rate: z.coerce.number().positive(),
  miles: z.coerce.number().positive(),
  broker_name: z.string(),
  pickup_date: z.string().optional(),
});

export const BrokerScoreSchema = z.object({
  mc_number: z.string().length(7),
  rating: z.enum(['A', 'B', 'C', 'D', 'F']),
  days_to_pay: z.number().default(30),
});
