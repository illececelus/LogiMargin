import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    dailyNetProfit: 847.42,
    dailyNetProfitDelta: 12.3,
    activeCashFlow: 14200,
    pendingInvoiceCount: 3,
    fleetHealthScore: 72,
    activeTrips: 2,
    redFlagCount: 1,
  });
}
