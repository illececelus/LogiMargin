'use client';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  TrendingUp, TrendingDown, DollarSign, Truck, AlertTriangle,
  Activity, FileText, Plus, Upload, Timer, Star, ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { cn, fmt } from '@/lib/utils';
import { useTrips } from '@/hooks/use-logistics';
import type { DashboardKPIs } from '@/types';

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
    <Card className={cn('relative overflow-hidden', className)}>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{title}</p>
            <p className="mt-1.5 font-mono text-2xl font-bold truncate">{value}</p>
            {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className="rounded-lg bg-primary/10 p-2 shrink-0 ml-2">
            <Icon className="h-5 w-5 text-primary" />
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

const VERDICT_COLORS = {
  green:  { badge: 'profit',   label: 'GO',        dot: 'bg-profit'  },
  yellow: { badge: 'warning',  label: 'NEGOTIATE', dot: 'bg-warning' },
  red:    { badge: 'danger',   label: 'NO-GO',     dot: 'bg-danger'  },
} satisfies Record<string, { badge: BadgeProps['variant']; label: string; dot: string }>;
type VerdictColor = { badge: BadgeProps['variant']; label: string; dot: string };
const DEFAULT_VERDICT_COLOR = { badge: 'secondary', label: 'REVIEW', dot: 'bg-muted-foreground' } satisfies VerdictColor;
const VERDICT_COLOR_LOOKUP = VERDICT_COLORS as Record<string, VerdictColor>;

const STATUS_LABELS: Record<string, string> = {
  booked: 'Booked', in_transit: 'In Transit', delivered: 'Delivered',
  invoiced: 'Invoiced', paid: 'Paid', quoted: 'Quoted', cancelled: 'Cancelled',
};

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Fleet Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Bugünün anlık performansı</p>
        </div>
        <Badge variant="outline" className="text-xs font-mono">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-profit mr-1.5 animate-pulse" />
          CANLI
        </Badge>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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

      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Hızlı İşlemler</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Button variant="outline" className="flex-col h-auto py-3 gap-1.5" onClick={() => router.push('/loads')}>
            <Plus className="h-4 w-4 text-primary" />
            <span className="text-xs">Yük Analiz Et</span>
          </Button>
          <Button variant="outline" className="flex-col h-auto py-3 gap-1.5" onClick={() => router.push('/factoring')}>
            <Upload className="h-4 w-4 text-profit" />
            <span className="text-xs">RateCon Yükle</span>
          </Button>
          <Button variant="outline" className="flex-col h-auto py-3 gap-1.5" onClick={() => router.push('/detention')}>
            <Timer className="h-4 w-4 text-warning" />
            <span className="text-xs">Detention Başlat</span>
          </Button>
          <Button variant="outline" className="flex-col h-auto py-3 gap-1.5" onClick={() => router.push('/brokers')}>
            <Star className="h-4 w-4 text-primary" />
            <span className="text-xs">Broker Skorları</span>
          </Button>
        </CardContent>
      </Card>

      {/* Fleet Health */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Filo Sağlık Skoru</span>
            <span className={cn('font-mono text-lg font-bold', healthColor)}>{kpi.fleetHealthScore}/100</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress value={kpi.fleetHealthScore} className={healthBarClass} />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>0 — Kritik</span>
            <span className={cn('font-medium', healthColor)}>
              {kpi.fleetHealthScore >= 80 ? 'Mükemmel' : kpi.fleetHealthScore >= 60 ? 'İyi' : 'Dikkat Gerekli'}
            </span>
            <span>100 — Mükemmel</span>
          </div>
        </CardContent>
      </Card>

      {/* Red Flag */}
      {kpi.redFlagCount > 0 && (
        <Card className="border-danger/30 bg-danger/5">
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-danger shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-danger">{kpi.redFlagCount} Aktif Red Flag</p>
              <p className="text-xs text-muted-foreground mt-0.5">Bir veya daha fazla sefer minimum margin eşiğinin altında.</p>
            </div>
            <Badge variant="danger">{kpi.redFlagCount}</Badge>
          </CardContent>
        </Card>
      )}

      {/* Son 5 Yük */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-primary" />
              Son Yükler
            </span>
            <button
              onClick={() => router.push('/loads')}
              className="flex items-center gap-1 text-xs text-primary font-medium hover:underline"
            >
              Tümü <ArrowRight className="h-3 w-3" />
            </button>
          </CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="pt-3">
          {tripsLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />)}
            </div>
          ) : recentTrips.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              <Truck className="mx-auto h-8 w-8 mb-2 opacity-30" />
              Henüz yük yok. İlk yükü eklemek için RateCon yükle.
            </div>
          ) : (
            <div className="space-y-2">
              {recentTrips.map(trip => {
                const vc = trip.verdict ? VERDICT_COLOR_LOOKUP[trip.verdict] ?? DEFAULT_VERDICT_COLOR : null;
                return (
                  <div key={trip.id} className="flex items-center gap-3 rounded-lg border border-border/50 px-3 py-2.5 hover:bg-secondary/30 transition-colors">
                    <div className={cn('w-2 h-2 rounded-full shrink-0', vc?.dot ?? 'bg-muted-foreground')} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{trip.origin} → {trip.destination}</p>
                      <p className="text-xs text-muted-foreground">{STATUS_LABELS[trip.status] ?? trip.status}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={cn('text-sm font-mono font-semibold',
                        (trip.netProfit ?? 0) >= 0 ? 'text-profit' : 'text-danger'
                      )}>
                        {trip.netProfit != null ? fmt.currency(trip.netProfit, 0) : fmt.currency(trip.grossPay, 0)}
                      </p>
                      {trip.logimarginScore != null && (
                        <p className="text-[10px] text-muted-foreground">{trip.logimarginScore}/100</p>
                      )}
                    </div>
                    {vc && (
                      <Badge variant={vc.badge} className="text-[10px] shrink-0">{vc.label}</Badge>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
