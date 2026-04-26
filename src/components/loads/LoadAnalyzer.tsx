'use client';
import { useState } from 'react';
import { Truck, CheckCircle2, XCircle, AlertTriangle, TrendingUp, DollarSign, Gauge } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { cn, fmt } from '@/lib/utils';
import type { FinancialReport, Verdict } from '@/types';

const DEFAULTS = {
  grossPay: '3200', loadedMiles: '850', deadheadMiles: '45',
  fuelCost: '680', tollCost: '0', driverPay: '0', maintCost: '80',
  factoringRate: '0.03', currentDieselPrice: '3.89',
};

const VERDICT_CONFIG: Record<Verdict, { label: string; Icon: React.ElementType; badgeVariant: 'profit' | 'warning' | 'danger'; border: string }> = {
  green:  { label: 'Book It',   Icon: CheckCircle2,    badgeVariant: 'profit',  border: 'border-profit/40' },
  yellow: { label: 'Negotiate', Icon: AlertTriangle,   badgeVariant: 'warning', border: 'border-warning/40' },
  red:    { label: 'Reject',    Icon: XCircle,         badgeVariant: 'danger',  border: 'border-danger/40' },
};

export function LoadAnalyzer() {
  const [form, setForm] = useState(DEFAULTS);
  const [report, setReport] = useState<FinancialReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(k: string, v: string) { setForm(prev => ({ ...prev, [k]: v })); }

  async function analyze() {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/analyze-load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(Object.entries(form).map(([k, v]) => [k, Number(v) || 0]))),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Analysis failed'); }
      setReport(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  const FIELDS = [
    { key: 'grossPay',          label: 'Gross Pay ($)',       step: '50'   },
    { key: 'loadedMiles',       label: 'Loaded Miles',        step: '10'   },
    { key: 'deadheadMiles',     label: 'Deadhead Miles',      step: '5'    },
    { key: 'fuelCost',          label: 'Fuel Cost ($)',        step: '10'   },
    { key: 'tollCost',          label: 'Toll Cost ($)',        step: '5'    },
    { key: 'driverPay',         label: 'Driver Pay ($)',       step: '50'   },
    { key: 'maintCost',         label: 'Maint. Cost ($)',      step: '10'   },
    { key: 'factoringRate',     label: 'Factoring Rate (0–1)', step: '0.01' },
    { key: 'currentDieselPrice', label: 'Diesel Price ($/gal)', step: '0.01' },
  ];

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2"><Truck className="h-5 w-5 text-primary" />Load Analyzer</h1>
        <p className="text-sm text-muted-foreground mt-1">Enter trip details to get a go/no-go verdict and full financial breakdown.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4 text-primary" />Trip Inputs</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {FIELDS.map(({ key, label, step }) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={key}>{label}</Label>
                <Input id={key} type="number" step={step} value={(form as Record<string, string>)[key] ?? ''}
                  onChange={e => set(key, e.target.value)} className="font-mono" />
              </div>
            ))}
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button onClick={analyze} disabled={loading} className="w-full sm:w-auto">
            {loading ? 'Analyzing…' : 'Analyze Load'}
          </Button>
        </CardContent>
      </Card>

      {report && (() => {
        const vc = VERDICT_CONFIG[report.verdict];
        return (
          <div className="space-y-4">
            <Card className={cn('border-2', vc.border)}>
              <CardContent className="pt-5 pb-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <vc.Icon className="h-5 w-5" />
                    <span className="font-bold text-lg">{vc.label}</span>
                  </div>
                  <Badge variant={vc.badgeVariant} className="text-sm px-3 py-1">Score {report.logimarginScore}/100</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{report.action}</p>
                <Progress
                  value={report.logimarginScore}
                  className={cn(
                    report.verdict === 'green' ? '[&>div]:bg-profit' :
                    report.verdict === 'yellow' ? '[&>div]:bg-warning' : '[&>div]:bg-danger'
                  )}
                />
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {[
                { label: 'Gross Pay',    val: fmt.currency(report.grossPay) },
                { label: 'Total Cost',   val: fmt.currency(report.totalCost) },
                { label: 'Net Profit',   val: fmt.currency(report.netProfit), highlight: report.netProfit > 0 ? 'profit' : 'danger' },
                { label: 'Net Margin',   val: fmt.percent(report.netMarginPct), highlight: report.netMarginPct >= 0.20 ? 'profit' : report.netMarginPct >= 0.15 ? 'warning' : 'danger' },
                { label: 'Gross RPM',    val: fmt.rpm(report.rpmGross) },
                { label: 'Net RPM',      val: fmt.rpm(report.rpmNet), highlight: report.rpmNet >= 1.25 ? 'profit' : 'warning' },
                { label: 'CPM',          val: fmt.rpm(report.cpm) },
                { label: 'Total Miles',  val: fmt.miles(report.totalMiles) },
                { label: 'Deadhead %',   val: fmt.percent(report.deadheadPct), highlight: report.deadheadPct <= 0.08 ? 'profit' : report.deadheadPct <= 0.12 ? 'warning' : 'danger' },
              ].map(({ label, val, highlight }) => (
                <Card key={label}>
                  <CardContent className="pt-3 pb-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
                    <p className={cn('font-mono text-base font-semibold mt-0.5',
                      highlight === 'profit' ? 'text-profit' : highlight === 'warning' ? 'text-warning' : highlight === 'danger' ? 'text-danger' : 'text-foreground'
                    )}>{val}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {report.flags.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-warning" />Flags & Warnings</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {report.flags.map((flag, i) => (
                    <div key={i} className={cn('rounded-lg border p-3', flag.type === 'red_flag' ? 'border-danger/30 bg-danger/5' : 'border-warning/30 bg-warning/5')}>
                      <p className="text-sm">{flag.message}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Gauge className="h-4 w-4 text-blue-400" />IFTA Estimate (TX)</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: 'Total Miles',     val: fmt.miles(report.ifta.totalMiles) },
                    { label: 'TX Miles (est)',   val: fmt.miles(report.ifta.txMiles) },
                    { label: 'Fuel Gallons',     val: `${report.ifta.estimatedFuelGallons.toFixed(1)} gal` },
                    { label: 'TX IFTA Tax',      val: fmt.currency(report.ifta.estimatedTxTax) },
                  ].map(({ label, val }) => (
                    <div key={label}>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
                      <p className="font-mono text-sm font-semibold mt-0.5">{val}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        );
      })()}
    </div>
  );
}
