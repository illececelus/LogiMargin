// ============================================================
// LogiMargin — /api/audit  (RateCon Go/No-Go Decision)
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { runFreightAudit, parseRateConfirmation } from '@/lib/claude-audit';
import { analyzeTrip } from '@/lib/logimargin-engine';
import { createServerClient } from '@/lib/supabase';
import type { TripInput } from '@/types';

export const runtime = 'nodejs';
export const maxDuration = 45;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const mode = (formData.get('mode') as string) ?? 'full';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // ── 1. Extract text from upload ───────────────────────────
    let docText: string;
    try {
      docText = await file.text();
    } catch {
      docText = `[Binary file: ${file.name}, ${(file.size / 1024).toFixed(1)} KB — OCR not supported in this env]`;
    }

    // ── 2. Parse RateCon with Claude ──────────────────────────
    const rateConData = await parseRateConfirmation(docText);

    if (mode === 'ratecon_only') {
      return NextResponse.json({ rateConData });
    }

    // ── 3. Run freight audit ──────────────────────────────────
    const auditResult = await runFreightAudit(docText);

    // ── 4. Confidence gate — flag for manual review ───────────
    if (auditResult.confidence < 0.85) {
      return NextResponse.json({
        verdict: 'manual_review',
        reason: `AI confidence ${(auditResult.confidence * 100).toFixed(0)}% is below threshold. Human review required.`,
        auditResult,
        rateConData,
        requiresManualReview: true,
      });
    }

    // ── 5. Fetch maintenance reserve from Supabase ────────────
    let maintenanceReserveCpm = 0;
    let maintenanceAlertActive = false;
    try {
      const db = createServerClient();
      const { data: vitals } = await db
        .from('vehicle_vitals')
        .select('current_odometer, last_oil_change_mi')
        .order('recorded_at', { ascending: false })
        .limit(1)
        .single();

      if (vitals) {
        const delta = vitals.current_odometer - (vitals.last_oil_change_mi ?? vitals.current_odometer);
        if (delta > 15_000) {
          maintenanceReserveCpm = 0.12;
          maintenanceAlertActive = true;
        }
      }
    } catch {
      // Non-fatal — proceed without maintenance data
    }

    // ── 6. Build TripInput from parsed RateCon ────────────────
    const grossPay: number = rateConData.grossPay ?? auditResult.expectedAmount ?? 0;
    const loadedMiles: number = rateConData.loadedMiles ?? 500;
    const dieselPrice = 3.89; // North Texas avg — can be replaced with live API
    const fuelCost = (loadedMiles / 6.5) * dieselPrice;
    const maintCost = maintenanceReserveCpm * loadedMiles;

    const tripInput: TripInput = {
      grossPay,
      loadedMiles,
      deadheadMiles: 0,
      fuelCost,
      tollCost: 0,
      driverPay: 0,
      maintCost,
      currentDieselPrice: dieselPrice,
    };

    // ── 7. Run LogiMargin engine ──────────────────────────────
    const report = analyzeTrip(tripInput, 'dry_van');

    // ── 8. Composite verdict ──────────────────────────────────
    const hasAiErrors = auditResult.hasErrors && auditResult.discrepancyAmount > 0;
    const finalVerdict = hasAiErrors && report.verdict === 'green'
      ? 'yellow'
      : report.verdict;

    const goNoGo = finalVerdict === 'green'
      ? { decision: 'GO', emoji: '✅', color: 'green' }
      : finalVerdict === 'yellow'
      ? { decision: 'NEGOTIATE', emoji: '🟡', color: 'yellow' }
      : { decision: 'NO-GO', emoji: '🔴', color: 'red' };

    return NextResponse.json({
      goNoGo,
      verdict: finalVerdict,
      logimarginScore: report.logimarginScore,
      action: report.action,
      netProfit: report.netProfit,
      netMarginPct: report.netMarginPct,
      rpmNet: report.rpmNet,
      flags: report.flags,
      auditResult,
      rateConData,
      maintenanceAlertActive,
      maintenanceReserveCpm,
      dieselPrice,
      requiresManualReview: false,
    });
  } catch (err) {
    console.error('[/api/audit]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Audit failed' },
      { status: 500 }
    );
  }
}
