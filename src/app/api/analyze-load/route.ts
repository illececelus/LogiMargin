import { NextRequest, NextResponse } from 'next/server';
import { analyzeTrip } from '@/lib/logimargin-engine';
import type { TripInput } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input: TripInput = {
      grossPay: Number(body.grossPay), loadedMiles: Number(body.loadedMiles),
      deadheadMiles: Number(body.deadheadMiles ?? 0), fuelCost: Number(body.fuelCost),
      tollCost: Number(body.tollCost ?? 0), driverPay: Number(body.driverPay ?? 0),
      maintCost: Number(body.maintCost ?? 0),
      factoringRate: body.factoringRate != null ? Number(body.factoringRate) : undefined,
      currentDieselPrice: body.currentDieselPrice != null ? Number(body.currentDieselPrice) : undefined,
    };
    if (!input.grossPay || !input.loadedMiles || !input.fuelCost)
      return NextResponse.json({ error: 'grossPay, loadedMiles, fuelCost are required' }, { status: 400 });
    return NextResponse.json(analyzeTrip(input, body.equipmentType ?? 'dry_van', body.brokerRating));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Analysis failed' }, { status: 500 });
  }
}
