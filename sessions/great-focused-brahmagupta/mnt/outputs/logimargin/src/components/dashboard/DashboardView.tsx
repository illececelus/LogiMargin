'use client';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, DollarSign, Truck, AlertTriangle, Activity, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn, fmt } from '@/lib/utils';
import type { DashboardKPIs } from '@/types';

async function fetchKPIs(): Promise<DashboardKPIs> {
  const res = await fetch('/api/fleet-metrics');
  if (!res.ok) throw new Error('Failed to fetch KPIs');
  return res.json();
}

function KPICard({ title, value, sub, icon: Icon, trend, className }: {
  title: string; value: string; sub?: string;
  icon: React.ElementType; trend?: 'up' | 'down' | 'neutral'; className?: string;
}) {
  return (
    <Card className={cn('relative overflow-hidden', className)}>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{title}</p>
            <p className="mt-1.5 font-mono text-2xl font-bold">{value}</p>
            {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className="rounded-lg bg-primary/10 p-2">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
        {trend && (
          <div className={cn('mt-3 flex items-center gap-1 text-xs font-medium', trend === 'up' ? 'text-profit' : trend === 'down' ? 'text-danger' : 'text-muted-foreground')}>
            {trend === 'up' ? <TrendingUp className="h-3 w-3" /> : trend === 'down' ? <TrendingDown className="h-3 w-3" /> : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardView() {
  const { data, isLoading, error } = useQuery({ queryKey: ['fleet-metrics'], queryFn: fetchKPIs });

  if (isLoading) return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 rounded bg-muted" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {[...Array(7)].map((_, i) => <div key={i} className="h-28 rounded-xl bg-muted" />)}
      </div>
    </div>
  );

  if (error) return (
    <div className="rounded-xl border border-danger/30 bg-danger/5 p-6 text-center">
      <AlertTriangle className="mx-auto h-8 w-8 text-danger mb-2" />
      <p className="text-sm text-danger font-medium">Failed to load fleet metrics</p>
    </div>
  );

  const kpi = data!;
  const healthColor = kpi.fleetHealthScore >= 80 ? 'text-profit' : kpi.fleetHealthScore >= 60 ? 'text-warning' : 'text-danger';

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="text-xl font-bold">Fleet Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Live snapshot — today's performance</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <KPICard
          title="Net Profit Today"
          value={fmt.currency(kpi.dailyNetProfit, 0)}
          sub={`${kpi.dailyNetProfitDelta > 0 ? '+' : ''}${kpi.dailyNetProfitDelta.toFixed(1)}% vs yesterday`}
          icon={DollarSign}
          trend={kpi.dailyNetProfitDelta > 0 ? 'up' : 'down'}
          className="border-profit/20"
        />
        <KPICard
          title="Active Cash Flow"
          value={fmt.currency(kpi.activeCashFlow, 0)}
          sub="In factoring pipeline"
          icon={Activity}
        />
        <KPICard
          title="Pending Invoices"
          value={String(kpi.pendingInvoiceCount)}
          sub="Awaiting approval"
          icon={FileText}
        />
        <KPICard
          title="Active Trips"
          value={String(kpi.activeTrips)}
          sub="In transit"
          icon={Truck}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Fleet Health Score</span>
            <span className={cn('font-mono text-lg font-bold', healthColor)}>{kpi.fleetHealthScore}/100</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress
            value={kpi.fleetHealthScore}
            className={cn(
              kpi.fleetHealthScore >= 80 ? '[&>div]:bg-profit' :
              kpi.fleetHealthScore >= 60 ? '[&>div]:bg-warning' : '[&>div]:bg-danger'
            )}
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>0 — Critical</span>
            <span>100 — Excellent</span>
          </div>
        </CardContent>
      </Card>

      {kpi.redFlagCount > 0 && (
        <Card className="border-danger/30 bg-danger/5">
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-danger shrink-0" />
            <div>
              <p className="text-sm font-semibold text-danger">{kpi.redFlagCount} Active Red Flag{kpi.redFlagCount > 1 ? 's' : ''}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Review your loads — one or more trips are below minimum margin threshold.</p>
            </div>
            <Badge variant="danger" className="ml-auto">{kpi.redFlagCount}</Badge>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-5 pb-5 text-center text-muted-foreground text-sm space-y-1">
          <p className="font-medium text-foreground">Quick Actions</p>
          <p>Use the nav above to analyze loads, manage factoring, run maintenance diagnostics, or track detention time.</p>
        </CardContent>
      </Card>
    </div>
  );
}
