'use client';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  TrendingUp, TrendingDown, DollarSign, Truck, AlertTriangle,
  Activity, FileText, Plus, Upload, Timer, Star, ArrowRight,
  MapPinned, Radio, ShieldCheck,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { cn, fmt } from '@/lib/utils';
import { useTrips } from '@/hooks/use-logistics';
import type { DashboardKPIs, Verdict } from '@/types';

async function fetchKPIs(): Promise<DashboardKPIs> {
  const res = await fetch('/api/fleet-metrics');
  if (!res.ok) throw new Error('Failed to fetch KPIs');
  return res.json();
}

function KPICard({ title, value, sub, icon: Icon, trend, delta, className }: {
  title: string; value: string; sub?: string;
  icon: React.ElementType; trend?: 'up' | 'down' | 'neutral';
  delta?: number; className?: string;
}) {
  return (
    <Card className={cn('relative overflow-hidden border-white/10 bg-white/5 backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-emerald-400/30 hover:bg-white/[0.07]', className)}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/50 to-transparent" />
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-slate-400">{title}</p>
            <p className="mt-1.5 truncate font-mono text-2xl font-bold text-slate-50">{value}</p>
            {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className="ml-2 shrink-0 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-2">
            <Icon className="h-5 w-5 text-emerald-300" />
          </div>
        </div>
        {trend && delta !== undefined && (
          <div className={cn('mt-3 flex items-center gap-1 text-xs font-semibold',
            trend === 'up' ? 'text-profit' : trend === 'down' ? 'text-danger' : 'text-muted-foreground'
          )}>
            {trend === 'up' ? <TrendingUp className="h-3 w-3" /> : trend === 'down' ? <TrendingDown className="h-3 w-3" /> : null}
            <span>{delta > 0 ? '+' : ''}{delta.toFixed(1)}% vs dün</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const VERDICT_COLORS: Record<Verdict, { badge: BadgeProps['variant']; label: string; dot: string }> = {
  green:  { badge: 'profit',   label: 'GO',        dot: 'bg-profit'  },
  yellow: { badge: 'warning',  label: 'NEGOTIATE', dot: 'bg-warning' },
  red:    { badge: 'danger',   label: 'NO-GO',     dot: 'bg-danger'  },
};

const STATUS_LABELS: Record<string, string> = {
  booked: 'Booked', in_transit: 'In Transit', delivered: 'Delivered',
  invoiced: 'Invoiced', paid: 'Paid', quoted: 'Quoted', cancelled: 'Cancelled',
  active: 'Active',
};

const ACTIVE_TRIP_STATUSES: ReadonlySet<string> = new Set(['active', 'booked', 'in_transit']);

export function DashboardView() {
  const router = useRouter();
  const { data, isLoading, error } = useQuery({ queryKey: ['fleet-metrics'], queryFn: fetchKPIs });
  const { data: trips, isLoading: tripsLoading } = useTrips();

  const recentTrips = (trips ?? []).slice(0, 5);

  if (isLoading) return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 rounded bg-muted" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-xl bg-muted" />)}
      </div>
      <div className="h-40 rounded-xl bg-muted" />
    </div>
  );

  if (error) return (
    <div className="rounded-xl border border-danger/30 bg-danger/5 p-6 text-center">
      <AlertTriangle className="mx-auto h-8 w-8 text-danger mb-2" />
      <p className="text-sm text-danger font-medium">Metrikler yüklenemedi</p>
    </div>
  );

  const kpi = data!;
  const healthColor = kpi.fleetHealthScore >= 80 ? 'text-profit' : kpi.fleetHealthScore >= 60 ? 'text-warning' : 'text-danger';
  const healthBarClass = kpi.fleetHealthScore >= 80 ? '[&>div]:bg-profit' : kpi.fleetHealthScore >= 60 ? '[&>div]:bg-warning' : '[&>div]:bg-danger';

  return (
    <div className="space-y-6 animate-slide-up">

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-300/80">Logistics Command Center</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-50 sm:text-4xl">Fleet Operations Cockpit</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">Margin, cash flow, active loads ve detention risklerini tek koyu slate kokpitte izle.</p>
        </div>
        <Badge variant="outline" className="w-fit border-emerald-400/30 bg-emerald-400/10 text-xs font-mono text-emerald-200">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-profit mr-1.5 animate-pulse" />
          CANLI
        </Badge>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPICard
          title="Net Kar (Bugün)"
          value={fmt.currency(kpi.dailyNetProfit, 0)}
          icon={DollarSign}
          trend={kpi.dailyNetProfitDelta > 0 ? 'up' : 'down'}
          delta={kpi.dailyNetProfitDelta}
          className="border-profit/20"
        />
        <KPICard
          title="Aktif Nakit"
          value={fmt.currency(kpi.activeCashFlow, 0)}
          sub="Factoringde"
          icon={Activity}
        />
        <KPICard
          title="Bekleyen Fatura"
          value={String(kpi.pendingInvoiceCount)}
          sub="Onay bekliyor"
          icon={FileText}
        />
        <KPICard
          title="Aktif Sefer"
          value={String(kpi.activeTrips)}
          sub="Yolda"
          icon={Truck}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Active Loads */}
        <Card className="lg:col-span-7 bg-white/[0.04] backdrop-blur-md">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-emerald-300" />
                Aktif Yükler
              </span>
              <button
                onClick={() => router.push('/loads')}
                className="flex items-center gap-1 text-xs font-medium text-emerald-300 hover:text-emerald-200"
              >
                Tümü <ArrowRight className="h-3 w-3" />
              </button>
            </CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="pt-3">
            {tripsLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-white/5 animate-pulse" />)}
              </div>
            ) : recentTrips.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] py-10 text-center text-sm text-slate-400">
                <Truck className="mx-auto mb-2 h-8 w-8 opacity-30" />
                Henüz yük yok. İlk yükü eklemek için RateCon yükle.
              </div>
            ) : (
              <div className="space-y-2">
                {recentTrips.map(trip => {
                  const vc = trip.verdict ? VERDICT_COLORS[trip.verdict] : null;
                  const isActive = ACTIVE_TRIP_STATUSES.has(trip.status);
                  return (
                    <div key={trip.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/50 px-3 py-3 transition-all hover:border-emerald-400/30 hover:bg-emerald-400/5">
                      <div className="relative shrink-0">
                        <div className={cn('h-2.5 w-2.5 rounded-full', isActive ? 'bg-emerald-400 animate-pulse' : vc?.dot ?? 'bg-slate-500')} />
                        {isActive && <div className="absolute inset-0 h-2.5 w-2.5 animate-ping rounded-full bg-emerald-400/40" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-100">{trip.origin} → {trip.destination}</p>
                        <p className="text-xs text-slate-400">{STATUS_LABELS[trip.status] ?? trip.status}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={cn('text-sm font-mono font-semibold',
                          (trip.netProfit ?? 0) >= 0 ? 'text-profit' : 'text-danger'
                        )}>
                          {trip.netProfit != null ? fmt.currency(trip.netProfit, 0) : fmt.currency(trip.grossPay, 0)}
                        </p>
                        {trip.logimarginScore != null && (
                          <p className="text-[10px] text-slate-500">{trip.logimarginScore}/100</p>
                        )}
                      </div>
                      {vc && (
                        <Badge variant={vc.badge} className="hidden text-[10px] shrink-0 sm:inline-flex">{vc.label}</Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Command Map */}
        <Card className="relative min-h-72 overflow-hidden lg:col-span-5 bg-slate-950/70">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.09)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.09)_1px,transparent_1px)] bg-[size:32px_32px]" />
          <div className="absolute left-1/4 top-1/3 h-28 w-28 rounded-full bg-emerald-400/20 blur-3xl" />
          <CardHeader className="relative">
            <CardTitle className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <MapPinned className="h-4 w-4 text-emerald-300" />
                Route Radar
              </span>
              <Badge variant="outline" className="border-emerald-400/20 bg-black/20 font-mono text-[10px] text-emerald-200">
                <Radio className="h-3 w-3 animate-pulse" /> LIVE MAP
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="relative flex h-52 flex-col justify-between">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                <p className="text-xs text-slate-400">Corridor</p>
                <p className="mt-1 font-mono text-sm font-semibold text-slate-100">TX / Midwest</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                <p className="text-xs text-slate-400">Signals</p>
                <p className="mt-1 font-mono text-sm font-semibold text-emerald-300">{kpi.activeTrips} active</p>
              </div>
            </div>
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/80">Dispatch Intelligence</p>
              <p className="mt-2 text-sm text-slate-200">KPI, broker risk ve detention sinyalleri komuta panelinde birleştirildi.</p>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="lg:col-span-4 bg-white/[0.04] backdrop-blur-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Hızlı İşlemler</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            {[
              { label: 'Yük Analiz Et', Icon: Plus, href: '/loads', tone: 'text-emerald-300' },
              { label: 'RateCon Yükle', Icon: Upload, href: '/factoring', tone: 'text-profit' },
              { label: 'Detention Başlat', Icon: Timer, href: '/detention', tone: 'text-warning' },
              { label: 'Broker Skorları', Icon: Star, href: '/brokers', tone: 'text-emerald-300' },
            ].map(({ label, Icon, href, tone }) => (
              <Button key={label} variant="outline" className="h-auto flex-col gap-2 rounded-2xl border-white/10 bg-slate-950/50 py-4 hover:bg-emerald-400/10" onClick={() => router.push(href)}>
                <Icon className={cn('h-4 w-4', tone)} />
                <span className="text-xs">{label}</span>
              </Button>
            ))}
          </CardContent>
        </Card>

        {/* Fleet Health */}
        <Card className="lg:col-span-4 bg-white/[0.04] backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-300" /> Filo Sağlık Skoru</span>
              <span className={cn('font-mono text-lg font-bold', healthColor)}>{kpi.fleetHealthScore}/100</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={kpi.fleetHealthScore} className={healthBarClass} />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>0 Kritik</span>
              <span className={cn('font-medium', healthColor)}>
                {kpi.fleetHealthScore >= 80 ? 'Mükemmel' : kpi.fleetHealthScore >= 60 ? 'İyi' : 'Dikkat Gerekli'}
              </span>
              <span>100 Mükemmel</span>
            </div>
          </CardContent>
        </Card>

        <Card className={cn('lg:col-span-4', kpi.redFlagCount > 0 ? 'border-danger/30 bg-danger/10' : 'bg-white/[0.04] backdrop-blur-md')}>
          <CardContent className="flex h-full items-center gap-3 pt-6">
            <AlertTriangle className={cn('h-6 w-6 shrink-0', kpi.redFlagCount > 0 ? 'text-danger' : 'text-emerald-300')} />
            <div className="flex-1">
              <p className={cn('text-sm font-semibold', kpi.redFlagCount > 0 ? 'text-danger' : 'text-slate-100')}>
                {kpi.redFlagCount > 0 ? `${kpi.redFlagCount} Aktif Red Flag` : 'Red Flag Yok'}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {kpi.redFlagCount > 0 ? 'Minimum margin eşiğinin altında sefer var.' : 'Margin eşiği ve broker sinyalleri normal.'}
              </p>
            </div>
            <Badge variant={kpi.redFlagCount > 0 ? 'danger' : 'profit'}>{kpi.redFlagCount}</Badge>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
