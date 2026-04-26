'use client';
// ============================================================
// LogiMargin v7 — DraftReviewView
// Magic Loading → AI-filled fields → One-tap CONFIRM & SYNC
// Mobile-first: large touch targets, high contrast, zero clutter
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2, AlertTriangle, Loader2,
  Zap, TrendingDown,
  Shield, ShieldAlert, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import type { BrokerRiskResult, EnrichedDraft } from '@/lib/logimargin-engine';

// ── Magic Loading Messages ────────────────────────────────────
const LOADING_STEPS = [
  { icon: '📄', text: 'Reading your document…' },
  { icon: '🧠', text: 'Extracting rates & miles…' },
  { icon: '⛽', text: 'Calculating real profit…' },
  { icon: '🔍', text: 'Checking broker history…' },
  { icon: '✅', text: 'Almost done…' },
];

function MagicLoader() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setStep(s => Math.min(s + 1, LOADING_STEPS.length - 1)), 1800);
    return () => clearInterval(interval);
  }, []);
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-6">
      <div className="relative">
        <div className="w-20 h-20 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center animate-pulse">
          <span className="text-3xl">{LOADING_STEPS[step].icon}</span>
        </div>
        <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
      <div className="text-center space-y-2">
        <p className="text-lg font-bold">AI is analyzing your document</p>
        <p className="text-sm text-muted-foreground">{LOADING_STEPS[step].text}</p>
      </div>
      <div className="flex gap-1.5">
        {LOADING_STEPS.map((_, i) => (
          <div key={i} className={cn('w-2 h-2 rounded-full transition-all', i <= step ? 'bg-primary' : 'bg-muted')} />
        ))}
      </div>
    </div>
  );
}

// ── Verdict display ───────────────────────────────────────────
function VerdictBanner({ verdict, aiAction, realProfit, realMarginPct }: {
  verdict: string | null; aiAction: string | null;
  realProfit: number | null; realMarginPct: number | null;
}) {
  if (!verdict) return null;
  const isGreen  = verdict === 'green';
  const isYellow = verdict === 'yellow';
  const isRed    = verdict === 'red';

  return (
    <div className={cn(
      'rounded-2xl p-5 text-center space-y-2 border-2',
      isGreen  && 'bg-profit/10 border-profit/40',
      isYellow && 'bg-warning/10 border-warning/40',
      isRed    && 'bg-danger/10 border-danger/40',
    )}>
      <div className="text-4xl">{isGreen ? '🟢' : isYellow ? '🟡' : '🔴'}</div>
      <p className={cn(
        'text-2xl font-black tracking-tight',
        isGreen ? 'text-profit' : isYellow ? 'text-warning' : 'text-danger'
      )}>
        {aiAction ?? verdict.toUpperCase()}
      </p>
      {realProfit !== null && (
        <p className="text-sm text-muted-foreground">
          Est. real profit: <span className={cn('font-bold', realProfit > 0 ? 'text-profit' : 'text-danger')}>
            ${realProfit.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </span>
          {realMarginPct !== null && <span className="text-xs ml-1">({realMarginPct.toFixed(1)}% margin)</span>}
        </p>
      )}
    </div>
  );
}

// ── Broker Risk Banner ────────────────────────────────────────
function BrokerRiskBanner({ brokerRisk }: { brokerRisk: BrokerRiskResult | null }) {
  if (!brokerRisk || !brokerRisk.brokerName) return null;
  const isHighRisk = brokerRisk.isHighRisk;
  const grade = brokerRisk.grade;

  return (
    <div className={cn(
      'rounded-xl p-4 flex items-start gap-3 border',
      isHighRisk ? 'bg-danger/10 border-danger/30' : 'bg-muted/30 border-border'
    )}>
      {isHighRisk
        ? <ShieldAlert className="h-5 w-5 text-danger shrink-0 mt-0.5" />
        : <Shield className="h-5 w-5 text-profit shrink-0 mt-0.5" />
      }
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-bold text-sm">{brokerRisk.brokerName}</p>
          {grade && (
            <Badge variant={grade === 'A' || grade === 'B' ? 'profit' : grade === 'C' ? 'warning' : 'danger'}
              className="text-[10px] font-black">
              Grade {grade}
            </Badge>
          )}
          {isHighRisk && <Badge variant="danger" className="text-[10px]">HIGH RISK</Badge>}
        </div>
        {brokerRisk.riskReason
          ? <p className="text-xs text-danger mt-1">{brokerRisk.riskReason}</p>
          : grade
          ? <p className="text-xs text-muted-foreground mt-1">
              {brokerRisk.avgPaymentDays ? `Avg ${brokerRisk.avgPaymentDays} days to pay` : 'No payment history yet'}
            </p>
          : <p className="text-xs text-muted-foreground mt-1">New broker — no history in system</p>
        }
        {brokerRisk.recommendedSurcharge > 0 && (
          <p className="text-xs font-semibold text-warning mt-1">
            💡 Add {brokerRisk.recommendedSurcharge}% surcharge to offset risk
          </p>
        )}
      </div>
    </div>
  );
}

// ── Field Row ─────────────────────────────────────────────────
function FieldRow({ label, value, highlight }: { label: string; value: string | null | undefined; highlight?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-3 py-3 border-b border-border/40 last:border-0">
      <p className="text-xs text-muted-foreground uppercase tracking-wide shrink-0 pt-0.5">{label}</p>
      <p className={cn('text-sm font-semibold text-right', highlight && 'text-profit font-bold text-base')}>{value}</p>
    </div>
  );
}

// ── Warning List ──────────────────────────────────────────────
function WarningList({ warnings }: { warnings: string[] }) {
  if (!warnings.length) return null;
  return (
    <div className="space-y-2">
      {warnings.map((w, i) => (
        <div key={i} className={cn(
          'flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs',
          w.includes('HIGH RISK') ? 'bg-danger/10 text-danger border border-danger/20'
          : 'bg-warning/10 text-warning border border-warning/20'
        )}>
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{w}</span>
        </div>
      ))}
    </div>
  );
}

// ── Cost Breakdown ────────────────────────────────────────────
function CostBreakdown({ data }: { data: EnrichedDraft }) {
  const [open, setOpen] = useState(false);
  if (!data.estimatedFuelCost && !data.estimatedMaintCost) return null;
  const fmt = (n: number | null) => n != null ? `$${n.toFixed(0)}` : '—';

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/20 hover:bg-muted/40 transition-colors"
      >
        <span className="text-sm font-semibold flex items-center gap-2">
          <TrendingDown className="h-4 w-4 text-muted-foreground" /> Estimated Cost Breakdown
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-4 pb-3 space-y-0 divide-y divide-border/30">
          {[
            ['⛽ Fuel',        data.estimatedFuelCost],
            ['🔧 Maintenance', data.estimatedMaintCost],
            ['📋 Factoring (3%)', data.grossPay ? data.grossPay * 0.03 : null],
            ['🏛️ IFTA Tax (est.)', data.grossPay ? (data.loadedMiles ?? 0) / 6.5 * 0.20 * 0.6 : null],
          ].map(([label, val]) => (
            <div key={label as string} className="flex justify-between py-2.5 text-sm">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-mono font-semibold">{fmt(val as number | null)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────
export function DraftReviewView({ draftId }: { draftId: string }) {
  const router = useRouter();
  const [data, setData] = useState<EnrichedDraft | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load draft from Supabase
  useEffect(() => {
    async function load() {
      try {
        const { data: draft, error: err } = await supabase
          .from('load_drafts')
          .select('*')
          .eq('id', draftId)
          .single();
        if (err || !draft) throw new Error(err?.message ?? 'Draft not found');
        setData(draft.raw_ai_data as EnrichedDraft);
        setWarnings(draft.warnings ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load draft');
      } finally {
        // Show magic loader for at least 3s for UX delight
        setTimeout(() => setLoading(false), 3000);
      }
    }
    load();
  }, [draftId]);

  const handleConfirm = useCallback(async () => {
    if (!data) return;
    setConfirming(true);
    try {
      const res = await fetch('/api/confirm-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Confirm failed');
      setConfirmed(true);
      setTimeout(() => router.push('/loads'), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Confirm failed');
      setConfirming(false);
    }
  }, [data, draftId, router]);

  // ── Loading State ─────────────────────────────────────────
  if (loading) return <MagicLoader />;

  // ── Error State ───────────────────────────────────────────
  if (error) return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 px-6 text-center">
      <AlertTriangle className="h-12 w-12 text-danger" />
      <p className="font-bold text-lg">Something went wrong</p>
      <p className="text-sm text-muted-foreground">{error}</p>
      <Button onClick={() => router.back()} variant="outline" className="h-12 px-8">Go Back</Button>
    </div>
  );

  // ── Confirmed State ───────────────────────────────────────
  if (confirmed) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
      <div className="w-20 h-20 rounded-full bg-profit/20 border-2 border-profit flex items-center justify-center">
        <CheckCircle2 className="h-10 w-10 text-profit" />
      </div>
      <p className="text-2xl font-black text-profit">Load Synced!</p>
      <p className="text-sm text-muted-foreground">Redirecting to Loads…</p>
    </div>
  );

  if (!data) return null;

  return (
    <div className="space-y-5 pb-32 animate-slide-up max-w-xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Zap className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-black">AI Review</h1>
          <p className="text-xs text-muted-foreground">Confidence: {((data.confidence ?? 0) * 100).toFixed(0)}%</p>
        </div>
        <Badge variant={data.confidence >= 0.8 ? 'profit' : data.confidence >= 0.5 ? 'warning' : 'danger'} className="ml-auto">
          {data.confidence >= 0.8 ? 'HIGH' : data.confidence >= 0.5 ? 'MEDIUM' : 'LOW'} CONFIDENCE
        </Badge>
      </div>

      {/* Verdict */}
      <VerdictBanner
        verdict={data.verdict ?? null}
        aiAction={data.aiAction ?? null}
        realProfit={data.realProfit ?? null}
        realMarginPct={data.realMarginPct ?? null}
      />

      {/* Broker Risk */}
      <BrokerRiskBanner brokerRisk={data.brokerRisk} />

      {/* Warnings */}
      <WarningList warnings={warnings} />

      {/* Core Fields */}
      <Card>
        <CardContent className="pt-4 pb-2">
          <FieldRow label="Route"
            value={data.origin && data.destination ? `${data.origin} → ${data.destination}` : null} />
          <FieldRow label="Gross Pay" value={data.grossPay ? `$${data.grossPay.toLocaleString()}` : null} highlight />
          <FieldRow label="Real Profit (est.)" value={data.realProfit != null ? `$${Math.round(data.realProfit).toLocaleString()}` : null} highlight />
          <FieldRow label="Loaded Miles" value={data.loadedMiles ? `${data.loadedMiles.toLocaleString()} mi` : null} />
          <FieldRow label="RPM (Gross)" value={data.rpmGross ? `$${data.rpmGross.toFixed(2)}/mi` : null} />
          <FieldRow label="Broker" value={data.brokerName} />
          <FieldRow label="Equipment" value={data.equipmentType?.replace('_', ' ')} />
          <FieldRow label="Pickup" value={data.pickupDate} />
          <FieldRow label="Delivery" value={data.deliveryDate} />
          <FieldRow label="Load #" value={data.loadNumber} />
          <FieldRow label="Payment Terms" value={data.paymentTerms} />
        </CardContent>
      </Card>

      {/* Cost Breakdown */}
      <CostBreakdown data={data} />

      {/* Line Items */}
      {data.lineItems && data.lineItems.length > 0 && (
        <Card>
          <CardContent className="pt-4 pb-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Line Items</p>
            {data.lineItems.map((item, i) => (
              <div key={i} className="flex justify-between py-2 border-b border-border/30 last:border-0 text-sm">
                <span className="text-muted-foreground">{item.description}</span>
                <span className="font-mono font-semibold">${item.amount.toFixed(2)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* AI Notes */}
      {data.notes && (
        <div className="rounded-xl bg-muted/30 border border-border p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">AI Notes</p>
          <p className="text-sm text-muted-foreground leading-relaxed">{data.notes}</p>
        </div>
      )}

      {/* CONFIRM BUTTON — fixed bottom, huge touch target */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-sm border-t border-border z-50">
        <div className="max-w-xl mx-auto space-y-2">
          {data.brokerRisk?.isHighRisk && (
            <p className="text-xs text-center text-danger font-semibold">
              ⚠️ High risk broker detected — proceed with caution
            </p>
          )}
          <Button
            onClick={handleConfirm}
            disabled={confirming}
            className={cn(
              'w-full h-16 text-lg font-black tracking-wide rounded-2xl transition-all active:scale-95',
              data.verdict === 'red'
                ? 'bg-danger hover:bg-danger/90 text-white'
                : 'bg-primary hover:bg-primary/90 text-primary-foreground'
            )}
          >
            {confirming ? (
              <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Syncing…</>
            ) : (
              <><CheckCircle2 className="h-5 w-5 mr-2" /> CONFIRM & SYNC</>
            )}
          </Button>
          <Button variant="ghost" className="w-full h-11 text-muted-foreground" onClick={() => router.back()}>
            Review Later
          </Button>
        </div>
      </div>
    </div>
  );
}
