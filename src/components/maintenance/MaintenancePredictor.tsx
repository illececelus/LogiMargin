'use client';
import { useState } from 'react';
import { Wrench, AlertTriangle, XCircle, Info, CheckCircle2, Gauge } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn, fmt } from '@/lib/utils';
import { detectMaintenanceAlerts } from '@/lib/logimargin-engine';
import type { VehicleVitals, MaintenanceAlert } from '@/types';

const DEFAULTS: VehicleVitals & { currentCpm: number } = {
  currentOdometer: 487_500, engineHours: 14_200,
  lastOilChangeMi: 475_000, lastTireRotateMi: 462_000,
  lastInjectorSvcMi: 387_000, lastDefFluidMi: 479_000,
  baselineCpm: 0.82, currentCpm: 0.97,
};

function AlertCard({ alert }: { alert: MaintenanceAlert }) {
  const cfg = {
    critical: { Icon: XCircle,       cls: 'border-danger/40 bg-danger/5',    label: 'CRITICAL', labelCls: 'text-danger'   },
    warning:  { Icon: AlertTriangle, cls: 'border-warning/40 bg-warning/5',  label: 'WARNING',  labelCls: 'text-warning'  },
    info:     { Icon: Info,          cls: 'border-blue-500/40 bg-blue-500/5', label: 'INFO',     labelCls: 'text-blue-400' },
  }[alert.severity];
  return (
    <div className={cn('rounded-xl border p-4 space-y-2', cfg.cls)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <cfg.Icon className="h-4 w-4 text-current shrink-0" />
          <span className={cn('text-xs font-bold uppercase tracking-wider', cfg.labelCls)}>{cfg.label}</span>
          <Badge variant="muted" className="text-[10px]">{alert.alertType.replace('_', ' ')}</Badge>
        </div>
        {alert.estimatedCost && (
          <span className="font-mono text-xs text-muted-foreground">Est. {fmt.currency(alert.estimatedCost, 0)}</span>
        )}
      </div>
      <p className="text-sm text-foreground">{alert.message}</p>
      <p className="text-xs text-muted-foreground font-mono">{alert.triggerMetric}</p>
      {alert.milesUntilDue !== undefined && alert.milesUntilDue > 0 && (
        <p className="text-xs text-muted-foreground">{fmt.miles(alert.milesUntilDue)} until due</p>
      )}
    </div>
  );
}

export function MaintenancePredictor() {
  const [form, setForm] = useState(DEFAULTS);
  const [alerts, setAlerts] = useState<MaintenanceAlert[] | null>(null);

  function set(k: string, v: number) { setForm(prev => ({ ...prev, [k]: v })); }

  function run() {
    const vitals: VehicleVitals = {
      currentOdometer: form.currentOdometer, engineHours: form.engineHours,
      lastOilChangeMi: form.lastOilChangeMi, lastTireRotateMi: form.lastTireRotateMi,
      lastInjectorSvcMi: form.lastInjectorSvcMi, lastDefFluidMi: form.lastDefFluidMi,
      baselineCpm: form.baselineCpm,
    };
    setAlerts(detectMaintenanceAlerts(vitals, form.currentCpm));
  }

  const criticalCount = alerts?.filter(a => a.severity === 'critical').length ?? 0;
  const warningCount  = alerts?.filter(a => a.severity === 'warning').length ?? 0;

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2"><Wrench className="h-5 w-5 text-warning" /> Mechanic's Eye</h1>
        <p className="text-sm text-muted-foreground mt-1">Predictive maintenance alerts based on mileage and CPM spikes.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Gauge className="h-4 w-4 text-blue-400" />Vehicle Vitals</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { key: 'currentOdometer',   label: 'Odometer (mi)',       step: '100'  },
              { key: 'lastOilChangeMi',   label: 'Last Oil Change mi',  step: '100'  },
              { key: 'lastTireRotateMi',  label: 'Last Tire Rotate mi', step: '100'  },
              { key: 'lastInjectorSvcMi', label: 'Last Injector Svc mi',step: '1000' },
              { key: 'lastDefFluidMi',    label: 'Last DEF Fill mi',    step: '100'  },
              { key: 'baselineCpm',       label: 'Baseline CPM ($)',    step: '0.01' },
              { key: 'currentCpm',        label: 'Current CPM ($)',     step: '0.01' },
              { key: 'engineHours',       label: 'Engine Hours',        step: '10'   },
            ].map(({ key, label, step }) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={key}>{label}</Label>
                <Input id={key} type="number" step={step} value={(form as Record<string, number>)[key] ?? 0}
                  onChange={e => set(key, Number(e.target.value))} className="font-mono" />
              </div>
            ))}
          </div>
          <Button onClick={run} className="w-full sm:w-auto"><Wrench className="h-4 w-4" />Run Diagnostic</Button>
        </CardContent>
      </Card>

      {alerts && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            {criticalCount > 0 && <Badge variant="danger">{criticalCount} Critical</Badge>}
            {warningCount  > 0 && <Badge variant="warning">{warningCount} Warning</Badge>}
            {alerts.length === 0 && (
              <div className="flex items-center gap-2 text-profit text-sm font-medium">
                <CheckCircle2 className="h-4 w-4" />All systems nominal — no alerts.
              </div>
            )}
          </div>
          {alerts.map((a, i) => <AlertCard key={i} alert={a} />)}
        </div>
      )}
    </div>
  );
}
