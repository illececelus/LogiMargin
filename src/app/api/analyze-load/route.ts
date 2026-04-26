import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { analyzeTrip } from '@/lib/logimargin-engine';

const AnalyzeLoadSchema = z.object({
  grossPay: z.coerce.number().nonnegative(),
  loadedMiles: z.coerce.number().nonnegative(),
  deadheadMiles: z.coerce.number().nonnegative().default(0),
  fuelCost: z.coerce.number().nonnegative().default(0),
  tollCost: z.coerce.number().nonnegative().default(0),
  driverPay: z.coerce.number().nonnegative().default(0),
  maintCost: z.coerce.number().nonnegative().default(0),
  factoringRate: z.coerce.number().min(0).max(1).default(0.03),
  currentDieselPrice: z.coerce.number().positive().default(3.50),
});

export async function POST(req: NextRequest) {
  try {
    const payload = AnalyzeLoadSchema.parse(await req.json());

    if (payload.loadedMiles + payload.deadheadMiles <= 0) {
      return NextResponse.json({ error: 'At least one mile is required' }, { status: 400 });
    }

    return NextResponse.json(analyzeTrip(payload));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? 'Invalid load data' }, { status: 400 });
    }

    console.error('[/api/analyze-load]', err);
    return NextResponse.json({ error: 'Analyze load failed' }, { status: 500 });
  }
}
