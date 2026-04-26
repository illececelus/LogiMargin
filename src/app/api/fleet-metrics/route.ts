// ============================================================
// LogiMargin — /api/fleet-metrics  (Live Supabase KPIs)
// ============================================================
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const db = createServerClient();
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Run all queries in parallel
    const [tripsRes, invoicesRes, vitalsRes, yesterdayRes] = await Promise.all([
      // Today's trips
      db.from('trips')
        .select('net_profit, verdict, status')
        .gte('created_at', `${today}T00:00:00.000Z`),

      // All invoices
      db.from('invoices')
        .select('invoice_amount, status'),

      // Latest vehicle vitals
      db.from('vehicle_vitals')
        .select('current_odometer, last_oil_change_mi, baseline_cpm')
        .order('recorded_at', { ascending: false })
        .limit(1),

      // Yesterday's trips for delta
      db.from('trips')
        .select('net_profit')
        .gte('created_at', `${getPrevDay()}T00:00:00.000Z`)
        .lt('created_at', `${today}T00:00:00.000Z`),
    ]);

    const todayTrips = tripsRes.data ?? [];
    const invoices = invoicesRes.data ?? [];
    const vitals = vitalsRes.data ?? [];
    const yesterdayTrips = yesterdayRes.data ?? [];

    // Daily net profit
    const dailyNetProfit = todayTrips.reduce((s, t) => s + (t.net_profit ?? 0), 0);
    const yesterdayProfit = yesterdayTrips.reduce((s, t) => s + (t.net_profit ?? 0), 0);
    const dailyNetProfitDelta = yesterdayProfit > 0
      ? ((dailyNetProfit - yesterdayProfit) / yesterdayProfit) * 100
      : 0;

    // Active cash flow = pending + submitted invoices
    const activeCashFlow = invoices
      .filter(i => i.status === 'pending' || i.status === 'submitted')
      .reduce((s, i) => s + (i.invoice_amount ?? 0), 0);

    const pendingInvoiceCount = invoices.filter(i => i.status === 'pending').length;
    const activeTrips = todayTrips.filter(t => t.status === 'in_transit').length;
    const redFlagCount = todayTrips.filter(t => t.verdict === 'red').length;

    // Fleet health: penalize for red flags + maintenance issues
    let fleetHealthScore = 85;
    fleetHealthScore -= redFlagCount * 10;

    if (vitals.length > 0) {
      const v = vitals[0];
      const oilDelta = v.current_odometer - (v.last_oil_change_mi ?? v.current_odometer);
      if (oilDelta > 15_000) fleetHealthScore -= 20;
      else if (oilDelta > 12_000) fleetHealthScore -= 10;
    }

    fleetHealthScore = Math.max(0, Math.min(100, fleetHealthScore));

    return NextResponse.json({
      dailyNetProfit,
      dailyNetProfitDelta: parseFloat(dailyNetProfitDelta.toFixed(1)),
      activeCashFlow,
      pendingInvoiceCount,
      fleetHealthScore,
      activeTrips,
      redFlagCount,
    });
  } catch (err) {
    console.error('[/api/fleet-metrics]', err);
    // Fallback to zeros — never crash the dashboard
    return NextResponse.json({
      dailyNetProfit: 0,
      dailyNetProfitDelta: 0,
      activeCashFlow: 0,
      pendingInvoiceCount: 0,
      fleetHealthScore: 50,
      activeTrips: 0,
      redFlagCount: 0,
    });
  }
}

function getPrevDay(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}
