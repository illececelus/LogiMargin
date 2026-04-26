'use client';
import { useState } from 'react';
import {
  Truck, CheckCircle2, XCircle, AlertTriangle, TrendingUp,
  DollarSign, Gauge, Save, Loader2, History, MapPin,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { cn, fmt } from '@/lib/utils';
import { useTrips, useInsertTrip } from '@/hooks/use-logistics';
import type { FinancialReport, Verdict } from '@/types';

const DEFAULTS = {
  origin: '', destination: '', brokerName: '',
  grossPay: '3200', loadedMiles: '850', deadheadMiles: '45',
  fuelCost: '680', tollCost: '0', driverPay: '0', maintCost: '80',
  factoringRate: '0.03', currentDieselPrice: '3.89',
};

const VERDICT_CONFIG: Record<Verdict, {
  label: string; emoji: string; Icon: React.ElementType;
  badgeVariant: 'profit' | 'warning' | 'danger'; border: string; bg: string;
}> = {
  green:  { label: 'Book It',   emoji: '🟢', Icon: CheckCircle2,  badgeVariant: 'profit',  border: 'border-profit/40',  bg: 'bg-profit/5'  },
  yellow: { label: 'Negotiate', emoji: '🟡', Icon: AlertTriangle, badgeVariant: 'warning', border: 'border-warning/40', bg: 'bg-warning/5' },
  red:    { label: 'Reject',    emoji: '🔴', Icon: XCircle,       badgeVariant: 'danger',  border: 'border-danger/40',  bg: 'bg-danger/5'  },
};

const STATUS_COLORS: Record<string, string> = {
  booked: 'bg-primary', in_transit: 'bg-warning', delivered: 'bg-profit',
  invoiced: 'bg-blue-400', paid: 'bg-profit', quoted: 'bg-muted-foreground',
};

export function LoadAnalyzer() {
  const [form, setForm] = useState(DEFAULTS);
  const [report, setReport] = useState<FinancialReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'analyze' | 'history'>('analyze');

  const { data: trips } = useTrips();
  const insertTrip = useInsertTrip();

  function set(k: string, v: string) { setForm(prev => ({ ...prev, [k]: v })); }

  async function analyze() {
    setLoading(true); setError(null); setSaved(false);
    try {
      const res = await fetch('/api/analyze-load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(
          Object.entries(form)
            .filter(([k]) => !['origin','destination','brokerName'].includes(k))
            .map(([k, v]) => [k, Number(v) || 0])
        )),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Analiz başarısız'); }
      setReport(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bilinmeyen hata');
    } finally {
      setLoading(false);
    }
  }

  async function saveTrip() {
    if (!report) return;
    setSaveError(null);
    try {
      await insertTrip.mutateAsync({
        origin: form.origin || 'Belirtilmedi',
        destination: form.destination || 'Belirtilmedi',
        equipment_type: 'dry_van',
        gross_pay: report.grossPay,
        loaded_miles: report.loadedMiles,
        deadhead_miles: report.deadheadMiles,
        fuel_cost: Number(form.fuelCost) || 0,
        toll_cost: Number(form.tollCost) || 0,
        driver_pay: Number(form.driverPay) || 0,
        maint_cost: Number(form.maintCost) || 0,
        net_profit: report.netProfit,
        net_margin_pct: report.netMarginPct,
        logimargin_score: report.logimarginScore,
        verdict: report.verdict,
        action: report.action,
        broker_name: form.brokerName || undefined,
      });
      setSaved(true);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Kayıt başarısız');
    }
  }

  const COST_FIELDS = [
    { key: 'grossPay',     label: 'Gross Pay ($)',    step: '50'   },
    { key: 'loadedMiles',  label: 'Yüklü Mil',        step: '10'   },
    { key: 'deadheadMiles',label: 'Boş Mil',          step: '5'    },
    { key: 'fuelCost',     label: 'Yakıt ($)',         step: '10'   },
    { key: 'tollCost',     label: 'Geçiş Ücreti ($)', step: '5'    },
    { key: 'driverPay',    label: 'Sürücü Ücreti ($)', step: '50'  },
    { key: 'maintCost',    label: 'Bakım Maliyeti ($)',step: '10'   },
    { key: 'factoringRate',label: 'Factoring Oranı',  step: '0.01' },
    { key: 'currentDieselPrice', label: 'Motorin ($/gal)', step: '0.01' },
  ];

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" /> Load Analyzer
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Yük detaylarını gir, anında Go/No-Go kararı al.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant={tab === 'analyze' ? 'default' : 'outline'} size="sm" onClick={() => setTab('analyze')}>
            <DollarSign className="h-3.5 w-3.5 mr-1" /> Analiz
          </Button>
          <Button variant={tab === 'history' ? 'default' : 'outline'} size="sm" onClick={() => setTab('history')}>
            <History className="h-3.5 w-3.5 mr-1" /> Geçmiş ({trips?.length ?? 0})
          </Button>
        </div>
      </div>

      {tab === 'history' ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <History className="h-4 w-4" /> Son Yükler
            </CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="pt-3">
            {!trips || trips.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Truck className="mx-auto h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">Henüz kaydedilmiş yük yok.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {trips.slice(0, 15).map(trip => (
                  <div key={trip.id} className="flex items-center gap-3 rounded-lg border border-border/50 px-3 py-2.5">
                    <div className={cn('w-2 h-2 rounded-full shrink-0',
                      trip.verdict === 'green' ? 'bg-profit' :
                      trip.verdict === 'yellow' ? 'bg-warning' :
                      trip.verdict === 'red' ? 'bg-danger' : 'bg-muted-foreground'
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{trip.origin} → {trip.destination}</p>
                      <p className="text-xs text-muted-foreground">{trip.pickupDate ?? '—'}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={cn('text-sm font-mono font-semibold',
                        (trip.netProfit ?? 0) >= 0 ? 'text-profit' : 'text-danger'
                      )}>
                        {trip.netProfit != null ? fmt.currency(trip.netProfit, 0) : '—'}
                      </p>
                      {trip.logimarginScore != null && (
                        <p className="text-[10px] text-muted-foreground">{trip.logimarginScore}/100</p>
                      )}
                    </div>
                    <div className={cn('w-2 h-2 rounded-full shrink-0', STATUS_COLORS[trip.status] ?? 'bg-muted-foreground')} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" /> Güzergah & Broker
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="origin">Çıkış Noktası</Label>
                  <Input id="origin" value={form.origin} onChange={e => set('origin', e.target.value)} placeholder="Dallas, TX" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="destination">Varış Noktası</Label>
                  <Input id="destination" value={form.destination} onChange={e => set('destination', e.target.value)} placeholder="Denver, CO" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="brokerName">Broker Adı</Label>
                  <Input id="brokerName" value={form.brokerName} onChange={e => set('brokerName', e.target.value)} placeholder="Coyote Logistics" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" /> Finansal Girişler
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {COST_FIELDS.map(({ key, label, step }) => (
                  <div key={key} className="space-y-1.5">
                    <Label htmlFor={key}>{label}</Label>
                    <Input
                      id={key} type="number" step={step}
                      value={(form as Record<string, string>)[key] ?? ''}
                      onChange={e => set(key, e.target.value)}
                      className="font-mono"
                    />
                  </div>
                ))}
              </div>
              {error && (
                <div className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2">
                  <p className="text-sm text-danger">{error}</p>
                </div>
              )}
              <Button onClick={analyze} disabled={loading} className="w-full sm:w-auto">
                {loading
                  ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Analiz ediliyor…</>
                  : <><TrendingUp className="h-4 w-4 mr-2" />Yükü Analiz Et</>
                }
              </Button>
            </CardContent>
          </Card>

          {report && (() => {
            const vc = VERDICT_CONFIG[report.verdict];
            return (
              <div className="space-y-4">
                {/* Verdict Card */}
                <Card className={cn('border-2', vc.border, vc.bg)}>
                  <CardContent className="pt-5 pb-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{vc.emoji}</span>
                        <span className="font-black text-xl">{vc.label}</span>
                      </div>
                      <Badge variant={vc.badgeVariant} className="text-sm px-3 py-1">
                        {report.logimarginScore}/100
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{report.action}</p>
                    <Progress
                      value={report.logimarginScore}
                      className={cn(
                        report.verdict === 'green' ? '[&>div]:bg-profit' :
                        report.verdict === 'yellow' ? '[&>div]:bg-warning' : '[&>div]:bg-danger'
                      )}
                    />
                    <Separator />
                    {/* Save button */}
                    {saved ? (
                      <div className="flex items-center gap-2 text-sm text-profit font-semibold">
                        <CheckCircle2 className="h-4 w-4" /> Yük Active Loads&apos;a kaydedildi!
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <Button
                          size="sm"
                          onClick={saveTrip}
                          disabled={insertTrip.isPending}
                          className="bg-profit hover:bg-profit/90 text-white"
                        >
                          {insertTrip.isPending
                            ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Kaydediliyor…</>
                            : <><Save className="h-3.5 w-3.5 mr-1.5" />Bu Yükü Kaydet</>
                          }
                        </Button>
                        {saveError && <p className="text-xs text-danger">{saveError}</p>}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {[
                    { label: 'Gross Pay',   val: fmt.currency(report.grossPay),    hl: '' },
                    { label: 'Toplam Maliyet', val: fmt.currency(report.totalCost), hl: '' },
                    { label: 'Net Kar',     val: fmt.currency(report.netProfit),   hl: report.netProfit > 0 ? 'profit' : 'danger' },
                    { label: 'Net Margin',  val: fmt.percent(report.netMarginPct), hl: report.netMarginPct >= 0.20 ? 'profit' : report.netMarginPct >= 0.15 ? 'warning' : 'danger' },
                    { label: 'Gross RPM',   val: fmt.rpm(report.rpmGross),         hl: '' },
                    { label: 'Net RPM',     val: fmt.rpm(report.rpmNet),           hl: report.rpmNet >= 1.25 ? 'profit' : 'warning' },
                    { label: 'CPM',         val: fmt.rpm(report.cpm),             hl: '' },
                    { label: 'Toplam Mil',  val: fmt.miles(report.totalMiles),     hl: '' },
                    { label: 'Deadhead %',  val: fmt.percent(report.deadheadPct),  hl: report.deadheadPct <= 0.08 ? 'profit' : report.deadheadPct <= 0.12 ? 'warning' : 'danger' },
                  ].map(({ label, val, hl }) => (
                    <Card key={label}>
                      <CardContent className="pt-3 pb-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
                        <p className={cn('font-mono text-base font-semibold mt-0.5',
                          hl === 'profit' ? 'text-profit' : hl === 'warning' ? 'text-warning' : hl === 'danger' ? 'text-danger' : ''
                        )}>{val}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Flags */}
                {report.flags.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-warning" /> Uyarılar ({report.flags.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {report.flags.map((flag, i) => (
                        <div key={i} className={cn('rounded-lg border p-3',
                          flag.type === 'red_flag' ? 'border-danger/30 bg-danger/5' : 'border-warning/30 bg-warning/5'
                        )}>
                          <p className="text-sm">{flag.message}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* IFTA */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Gauge className="h-4 w-4 text-primary" /> IFTA Tahmini (TX)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {[
                        { label: 'Toplam Mil',      val: fmt.miles(report.ifta.totalMiles) },
                        { label: 'TX Mil (tahmini)', val: fmt.miles(report.ifta.txMiles) },
                        { label: 'Yakıt (gal)',      val: `${report.ifta.estimatedFuelGallons.toFixed(1)} gal` },
                        { label: 'TX IFTA Vergisi',  val: fmt.currency(report.ifta.estimatedTxTax) },
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
        </>
      )}
    </div>
  );
}
