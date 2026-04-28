'use client';
import { useState } from 'react';
import {
  Wrench, AlertTriangle, XCircle, Info, CheckCircle2,
  Gauge, Save, Loader2, Clock, TrendingDown,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn, fmt } from '@/lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { isSupabaseClientConfigured } from '@/lib/supabase';
import { createClient } from '@/utils/supabase/client';
import { detectMaintenanceAlerts } from '@/lib/logimargin-engine';
import { getLocalVehicleVitals, insertLocalVehicleVitals } from '@/lib/local-store';
import type { VehicleVitals, MaintenanceAlert } from '@/types';

type VehicleVitalsRow = {
  current_odometer: number | null;
  engine_hours: number | null;
  last_oil_change_mi: number | null;
  last_tire_rotate_mi: number | null;
  last_injector_svc_mi: number | null;
  last_def_fluid_mi: number | null;
  baseline_cpm: number | null;
  recorded_at: string;
};

const DEFAULTS = {
  currentOdometer: 487_500, engineHours: 14_200,
  lastOilChangeMi: 475_000, lastTireRotateMi: 462_000,
  lastInjectorSvcMi: 387_000, lastDefFluidMi: 479_000,
  baselineCpm: 0.82, currentCpm: 0.97,
};

const MAINTENANCE_ITEMS = [
  { key: 'lastOilChangeMi',    label: 'Yağ Değişimi',      interval: 15_000,  cost: 350  },
  { key: 'lastTireRotateMi',   label: 'Lastik Rotasyonu',  interval: 25_000,  cost: 200  },
  { key: 'lastInjectorSvcMi',  label: 'Enjektör Servisi',  interval: 100_000, cost: 1200 },
  { key: 'lastDefFluidMi',     label: 'DEF Dolum',         interval: 10_000,  cost: 80   },
];

function AlertCard({ alert }: { alert: MaintenanceAlert }) {
  const cfg = {
    critical: { Icon: XCircle,       cls: 'border-danger/40 bg-danger/5',   label: 'KRİTİK', labelCls: 'text-danger'  },
    warning:  { Icon: AlertTriangle, cls: 'border-warning/40 bg-warning/5', label: 'UYARI',  labelCls: 'text-warning' },
    info:     { Icon: Info,          cls: 'border-primary/40 bg-primary/5', label: 'BİLGİ',  labelCls: 'text-primary' },
  }[alert.severity];
  return (
    <div className={cn('rounded-xl border p-4 space-y-2', cfg.cls)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <cfg.Icon className="h-4 w-4 shrink-0" />
          <span className={cn('text-xs font-bold uppercase tracking-wider', cfg.labelCls)}>{cfg.label}</span>
          <Badge variant="muted" className="text-[10px]">{alert.alertType.replace(/_/g, ' ')}</Badge>
        </div>
        {alert.estimatedCost && (
          <span className="font-mono text-xs text-muted-foreground">~{fmt.currency(alert.estimatedCost, 0)}</span>
        )}
      </div>
      <p className="text-sm">{alert.message}</p>
      <p className="text-xs text-muted-foreground font-mono">{alert.triggerMetric}</p>
      {alert.milesUntilDue !== undefined && alert.milesUntilDue > 0 && (
        <p className="text-xs text-muted-foreground">{fmt.miles(alert.milesUntilDue)} kaldı</p>
      )}
    </div>
  );
}

export function MaintenancePredictor() {
  const qc = useQueryClient();
  const [form, setForm] = useState(DEFAULTS);
  const [alerts, setAlerts] = useState<MaintenanceAlert[] | null>(null);
  const [saved, setSaved] = useState(false);

  // Load latest saved vitals
  const { data: latestVitals } = useQuery<VehicleVitalsRow[]>({
    queryKey: ['vehicle-vitals-detail'],
    queryFn: async () => {
      if (!isSupabaseClientConfigured) return getLocalVehicleVitals();
      const supabase = createClient();
      const { data } = await supabase
        .from('vehicle_vitals')
        .select('*')
        .order('recorded_at', { ascending: false })
        .limit(10);
      return (data ?? []) as VehicleVitalsRow[];
    },
  });

  // Save vitals mutation
  const saveVitals = useMutation({
    mutationFn: async () => {
      if (!isSupabaseClientConfigured) {
        insertLocalVehicleVitals({
          current_odometer: form.currentOdometer,
          engine_hours: form.engineHours,
          last_oil_change_mi: form.lastOilChangeMi,
          last_tire_rotate_mi: form.lastTireRotateMi,
          last_injector_svc_mi: form.lastInjectorSvcMi,
          last_def_fluid_mi: form.lastDefFluidMi,
          baseline_cpm: form.baselineCpm,
        });
        return;
      }
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase.from('vehicle_vitals').insert({
        user_id: user.id,
        current_odometer: form.currentOdometer,
        engine_hours: form.engineHours,
        last_oil_change_mi: form.lastOilChangeMi,
        last_tire_rotate_mi: form.lastTireRotateMi,
        last_injector_svc_mi: form.lastInjectorSvcMi,
        last_def_fluid_mi: form.lastDefFluidMi,
        baseline_cpm: form.baselineCpm,
        recorded_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setSaved(true);
      qc.invalidateQueries({ queryKey: ['vehicle-vitals'] });
      qc.invalidateQueries({ queryKey: ['vehicle-vitals-detail'] });
    },
  });

  function set(k: string, v: number) { setForm(prev => ({ ...prev, [k]: v })); setSaved(false); }

  function loadLatest() {
    if (latestVitals && latestVitals.length > 0) {
      const v = latestVitals[0];
      setForm({
        currentOdometer: v.current_odometer ?? DEFAULTS.currentOdometer,
        engineHours: v.engine_hours ?? DEFAULTS.engineHours,
        lastOilChangeMi: v.last_oil_change_mi ?? DEFAULTS.lastOilChangeMi,
        lastTireRotateMi: v.last_tire_rotate_mi ?? DEFAULTS.lastTireRotateMi,
        lastInjectorSvcMi: v.last_injector_svc_mi ?? DEFAULTS.lastInjectorSvcMi,
        lastDefFluidMi: v.last_def_fluid_mi ?? DEFAULTS.lastDefFluidMi,
        baselineCpm: v.baseline_cpm ?? DEFAULTS.baselineCpm,
        currentCpm: DEFAULTS.currentCpm,
      });
    }
  }

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

  // Next service timeline
  const serviceTimeline = MAINTENANCE_ITEMS.map(item => {
    const lastMi = (form as Record<string, number>)[item.key] ?? 0;
    const nextMi = lastMi + item.interval;
    const remaining = nextMi - form.currentOdometer;
    const pct = Math.max(0, Math.min(100, ((item.interval - Math.max(0, remaining)) / item.interval) * 100));
    return { ...item, lastMi, nextMi, remaining, pct };
  });

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Wrench className="h-5 w-5 text-warning" /> Mechanic&apos;s Eye
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Tahmine dayalı bakım uyarıları ve servis takibi.
          </p>
        </div>
        {latestVitals && latestVitals.length > 0 && (
          <Button variant="outline" size="sm" onClick={loadLatest}>
            <Clock className="h-3.5 w-3.5 mr-1.5" /> Son Kaydı Yükle
          </Button>
        )}
      </div>

      {/* Vehicle Vitals Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Gauge className="h-4 w-4 text-primary" /> Araç Verileri
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { key: 'currentOdometer',   label: 'Kilometre (mi)',      step: '100'  },
              { key: 'lastOilChangeMi',   label: 'Son Yağ Değişimi mi', step: '100'  },
              { key: 'lastTireRotateMi',  label: 'Son Lastik Rot. mi',  step: '100'  },
              { key: 'lastInjectorSvcMi', label: 'Son Enjektör Svc mi', step: '1000' },
              { key: 'lastDefFluidMi',    label: 'Son DEF Dolum mi',    step: '100'  },
              { key: 'baselineCpm',       label: 'Baz CPM ($)',         step: '0.01' },
              { key: 'currentCpm',        label: 'Güncel CPM ($)',      step: '0.01' },
              { key: 'engineHours',       label: 'Motor Saati',         step: '10'   },
            ].map(({ key, label, step }) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={key} className="text-xs">{label}</Label>
                <Input id={key} type="number" step={step}
                  value={(form as Record<string, number>)[key] ?? 0}
                  onChange={e => set(key, Number(e.target.value))}
                  className="font-mono h-8 text-sm"
                />
              </div>
            ))}
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button onClick={run}>
              <Wrench className="h-4 w-4 mr-2" /> Tanı Çalıştır
            </Button>
            {saved ? (
              <div className="flex items-center gap-1.5 text-sm text-profit font-semibold">
                <CheckCircle2 className="h-4 w-4" /> Kaydedildi
              </div>
            ) : (
              <Button variant="outline" onClick={() => saveVitals.mutate()} disabled={saveVitals.isPending}>
                {saveVitals.isPending
                  ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Kaydediliyor…</>
                  : <><Save className="h-4 w-4 mr-2" />Verileri Kaydet</>
                }
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Next Service Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" /> Sonraki Bakımlar
          </CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="pt-4 space-y-4">
          {serviceTimeline.map(item => (
            <div key={item.key} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{item.label}</span>
                <span className={cn('font-mono text-xs font-semibold',
                  item.remaining <= 0 ? 'text-danger' :
                  item.remaining <= item.interval * 0.2 ? 'text-warning' : 'text-profit'
                )}>
                  {item.remaining <= 0
                    ? `${fmt.miles(Math.abs(item.remaining))} gecikmiş`
                    : `${fmt.miles(item.remaining)} kaldı`
                  }
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all',
                    item.pct >= 100 ? 'bg-danger' :
                    item.pct >= 80  ? 'bg-warning' : 'bg-profit'
                  )}
                  style={{ width: `${Math.min(100, item.pct)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Son: {fmt.miles(item.lastMi)}</span>
                <span>Sonraki: {fmt.miles(item.nextMi)} · ~{fmt.currency(item.cost, 0)}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Alert Results */}
      {alerts && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <p className="text-sm font-semibold">Tanı Sonuçları</p>
            {criticalCount > 0 && <Badge variant="danger">{criticalCount} Kritik</Badge>}
            {warningCount  > 0 && <Badge variant="warning">{warningCount} Uyarı</Badge>}
            {alerts.length === 0 && (
              <div className="flex items-center gap-2 text-profit text-sm font-medium">
                <CheckCircle2 className="h-4 w-4" /> Tüm sistemler normal.
              </div>
            )}
          </div>
          {alerts.map((a, i) => <AlertCard key={i} alert={a} />)}
        </div>
      )}

      {/* History */}
      {latestVitals && latestVitals.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-muted-foreground" /> Kayıt Geçmişi
            </CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="pt-3 space-y-2">
            {latestVitals.slice(0, 5).map((v, i) => (
              <div key={i} className="flex items-center justify-between text-sm px-1 py-1.5 border-b border-border/30 last:border-0">
                <span className="text-muted-foreground text-xs">
                  {new Date(v.recorded_at).toLocaleDateString('tr-TR')}
                </span>
                <span className="font-mono font-semibold">{fmt.miles(v.current_odometer ?? 0)}</span>
                <span className="text-xs text-muted-foreground">CPM: ${v.baseline_cpm?.toFixed(2) ?? '—'}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
