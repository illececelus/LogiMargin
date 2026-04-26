import { AiLoadSchema } from './schemas';

export const SchemaAgent = {
  processAiDraft: (rawAiOutput: any) => {
    try {
      const validated = AiLoadSchema.parse(rawAiOutput);
      
      // Sabit kâr hesabı (basitleştirilmiş)
      const real_profit = validated.rate - (validated.miles * 1.45);
      
      return {
        ...validated,
        real_profit,
        status: 'draft' as const,
        created_at: new Date().toISOString()
      };
    } catch (error) {
      console.error("Schema Agent validation failed:", error);
      throw error;
    }
  }
};
