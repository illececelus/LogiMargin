// ============================================================
// LogiMargin — /api/confirm-draft
// Confirm draft → move to trips table → create load_document
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { draftId, overrides } = body as {
      draftId: string;
      overrides?: {
        origin?: string;
        destination?: string;
        grossPay?: number;
        loadedMiles?: number;
        equipmentType?: string;
        brokerName?: string;
        pickupDate?: string;
        deliveryDate?: string;
        fuelCost?: number;
        tollCost?: number;
        driverPay?: number;
        maintCost?: number;
      };
    };

    if (!draftId) {
      return NextResponse.json({ error: 'draftId required' }, { status: 400 });
    }

    const db = createServerClient();

    // ── 1. Auth ───────────────────────────────────────────────
    const { data: { user }, error: authErr } = await db.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // ── 2. Fetch draft ────────────────────────────────────────
    const { data: draft, error: draftErr } = await db
      .from('load_drafts')
      .select('*')
      .eq('id', draftId)
      .eq('user_id', user.id)
      .single();

    if (draftErr || !draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    if (draft.status === 'confirmed') {
      return NextResponse.json({ error: 'Draft already confirmed' }, { status: 409 });
    }

    // ── 3. Merge AI data + user overrides ─────────────────────
    const ai = draft.raw_ai_data as Record<string, unknown>;
    const origin = overrides?.origin ?? (ai.origin as string) ?? 'Unknown';
    const destination = overrides?.destination ?? (ai.destination as string) ?? 'Unknown';
    const grossPay = overrides?.grossPay ?? (ai.grossPay as number) ?? 0;
    const loadedMiles = overrides?.loadedMiles ?? (ai.loadedMiles as number) ?? 1;
    const equipmentType = overrides?.equipmentType ?? (ai.equipmentType as string) ?? 'dry_van';
    const brokerName = overrides?.brokerName ?? (ai.brokerName as string) ?? null;
    const pickupDate = overrides?.pickupDate ?? (ai.pickupDate as string) ?? null;
    const deliveryDate = overrides?.deliveryDate ?? (ai.deliveryDate as string) ?? null;
    const fuelCost = overrides?.fuelCost ?? 0;
    const tollCost = overrides?.tollCost ?? 0;
    const driverPay = overrides?.driverPay ?? 0;
    const maintCost = overrides?.maintCost ?? 0;

    const totalCost = fuelCost + tollCost + driverPay + maintCost;
    const netProfit = grossPay - totalCost;
    const netMarginPct = grossPay > 0 ? netProfit / grossPay : 0;

    // ── 4. Insert into trips ──────────────────────────────────
    const { data: trip, error: tripErr } = await db
      .from('trips')
      .insert({
        user_id: user.id,
        origin,
        destination,
        equipment_type: equipmentType,
        gross_pay: grossPay,
        loaded_miles: loadedMiles,
        deadhead_miles: 0,
        fuel_cost: fuelCost,
        toll_cost: tollCost,
        driver_pay: driverPay,
        maint_cost: maintCost,
        net_profit: netProfit,
        net_margin_pct: netMarginPct,
        status: 'booked',
        broker_name: brokerName,
        pickup_date: pickupDate,
        delivery_date: deliveryDate,
      })
      .select()
      .single();

    if (tripErr) {
      return NextResponse.json({ error: `Trip insert failed: ${tripErr.message}` }, { status: 500 });
    }

    // ── 5. Create load_document record ────────────────────────
    await db.from('load_documents').insert({
      user_id: user.id,
      trip_id: trip.id,
      draft_id: draftId,
      doc_type: (ai.docType as string) ?? 'ratecon',
      file_url: draft.file_url,
      file_name: draft.file_name,
      metadata: ai,
    });

    // ── 6. Mark draft as confirmed ────────────────────────────
    await db
      .from('load_drafts')
      .update({ status: 'confirmed' })
      .eq('id', draftId);

    return NextResponse.json({
      success: true,
      tripId: trip.id,
      redirectTo: `/loads`,
    });
  } catch (err) {
    console.error('[confirm-draft]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Confirm failed' },
      { status: 500 }
    );
  }
}
