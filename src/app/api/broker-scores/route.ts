// ============================================================
// LogiMargin v5 — /api/broker-scores
// Supabase'den broker verisini çek, A/B/C/D skor hesapla
// ============================================================
import { NextResponse } from 'next/server';
import { createServerClient, isSupabaseServerConfigured } from '@/lib/supabase';

export const runtime = 'nodejs';

export interface BrokerScore {
  brokerName: string;
  totalLoads: number;
  avgGrossPay: number;
  avgMarginPct: number;       // 0-100
  avgPaymentDays: number | null;
  disputeCount: number;
  invoiceCount: number;
  lastLoadAt: string | null;
  grade: 'A' | 'B' | 'C' | 'D';
  gradeColor: string;
  recommendation: string;
  score: number;              // 0-100 composite
}

interface BrokerScoreRow {
  broker_name: string;
  total_loads: number;
  avg_gross_pay: number | string | null;
  avg_margin_pct: number | string | null;
  avg_payment_days: number | string | null;
  dispute_count: number | null;
  invoice_count: number | null;
  last_load_at: string | null;
}

function parseDbNumber(value: number | string | null): number {
  if (typeof value === 'number') return value;
  return parseFloat(value ?? '0');
}

function calcGrade(avgMargin: number, avgDays: number | null, disputeRate: number): {
  grade: 'A' | 'B' | 'C' | 'D';
  gradeColor: string;
  recommendation: string;
  score: number;
} {
  // Margin skoru (0-40 puan): %25+ ideal
  const marginScore = Math.min(40, (avgMargin / 25) * 40);

  // Ödeme hızı skoru (0-40 puan): 30 gün ideal, 60+ kötü
  let payScore = 40;
  if (avgDays !== null) {
    if (avgDays <= 30) payScore = 40;
    else if (avgDays <= 45) payScore = 30;
    else if (avgDays <= 60) payScore = 20;
    else payScore = 5;
  } else {
    payScore = 20; // veri yok → orta puan
  }

  // Dispute cezası (0-20 puan): dispute yoksa tam puan
  const disputePenalty = Math.min(20, disputeRate * 100);
  const disputeScore = 20 - disputePenalty;

  const score = Math.round(marginScore + payScore + disputeScore);

  let grade: 'A' | 'B' | 'C' | 'D';
  let gradeColor: string;
  let recommendation: string;

  if (score >= 75) {
    grade = 'A';
    gradeColor = 'profit';
    recommendation = 'Güvenilir broker. Öncelikli olarak çalış.';
  } else if (score >= 55) {
    grade = 'B';
    gradeColor = 'primary';
    recommendation = 'İyi broker. Fiyatı müzakere etmeye devam et.';
  } else if (score >= 35) {
    grade = 'C';
    gradeColor = 'warning';
    recommendation = 'Dikkatli ol. Daha iyi ödeme koşulları talep et.';
  } else {
    grade = 'D';
    gradeColor = 'danger';
    recommendation = 'Riskli broker. Mümkünse kaçın veya peşin ödeme talep et.';
  }

  return { grade, gradeColor, recommendation, score };
}

export async function GET() {
  try {
    if (!isSupabaseServerConfigured()) {
      return NextResponse.json([]);
    }

    const db = createServerClient();

    const { data: { user }, error: authErr } = await db.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // broker_scores view'dan çek (user_id RLS otomatik filtreler)
    const { data, error } = await db
      .from('broker_scores')
      .select('*')
      .order('total_loads', { ascending: false });

    if (error) {
      // View henüz oluşturulmamışsa trips tablosundan manuel agregasyon yap
      const { data: trips, error: tripErr } = await db
        .from('trips')
        .select('broker_name, gross_pay, net_margin_pct, created_at')
        .not('broker_name', 'is', null)
        .neq('broker_name', '');

      if (tripErr) throw new Error(tripErr.message);

      // Manuel agregasyon
      const brokerMap = new Map<string, {
        totalLoads: number; totalGross: number; totalMargin: number; lastLoadAt: string;
      }>();

      for (const t of (trips ?? [])) {
        const name = t.broker_name as string;
        const existing = brokerMap.get(name) ?? { totalLoads: 0, totalGross: 0, totalMargin: 0, lastLoadAt: '' };
        brokerMap.set(name, {
          totalLoads: existing.totalLoads + 1,
          totalGross: existing.totalGross + (t.gross_pay ?? 0),
          totalMargin: existing.totalMargin + (t.net_margin_pct ?? 0),
          lastLoadAt: t.created_at > existing.lastLoadAt ? t.created_at : existing.lastLoadAt,
        });
      }

      const scores: BrokerScore[] = Array.from(brokerMap.entries()).map(([name, v]) => {
        const avgMargin = v.totalLoads > 0 ? (v.totalMargin / v.totalLoads) * 100 : 0;
        const { grade, gradeColor, recommendation, score } = calcGrade(avgMargin, null, 0);
        return {
          brokerName: name,
          totalLoads: v.totalLoads,
          avgGrossPay: v.totalLoads > 0 ? v.totalGross / v.totalLoads : 0,
          avgMarginPct: avgMargin,
          avgPaymentDays: null,
          disputeCount: 0,
          invoiceCount: 0,
          lastLoadAt: v.lastLoadAt || null,
          grade, gradeColor, recommendation, score,
        };
      });

      scores.sort((a, b) => b.totalLoads - a.totalLoads);
      return NextResponse.json(scores);
    }

    // View'dan gelen veriyi işle
    const scores: BrokerScore[] = ((data ?? []) as BrokerScoreRow[]).map(row => {
      const invoiceCount = row.invoice_count ?? 0;
      const disputeCount = row.dispute_count ?? 0;
      const avgMargin = parseDbNumber(row.avg_margin_pct);
      const avgDays = row.avg_payment_days ? parseDbNumber(row.avg_payment_days) : null;
      const disputeRate = invoiceCount > 0 ? disputeCount / invoiceCount : 0;
      const { grade, gradeColor, recommendation, score } = calcGrade(avgMargin, avgDays, disputeRate);

      return {
        brokerName: row.broker_name,
        totalLoads: row.total_loads,
        avgGrossPay: parseDbNumber(row.avg_gross_pay),
        avgMarginPct: avgMargin,
        avgPaymentDays: avgDays,
        disputeCount,
        invoiceCount,
        lastLoadAt: row.last_load_at ?? null,
        grade, gradeColor, recommendation, score,
      };
    });

    return NextResponse.json(scores);
  } catch (err) {
    console.error('[broker-scores]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 }
    );
  }
}
