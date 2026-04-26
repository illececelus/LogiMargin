'use client';
import { useState, useEffect, useRef } from 'react';
import { Timer, Play, Square, FileText, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn, fmt } from '@/lib/utils';
import { calcDetention } from '@/lib/logimargin-engine';
import type { DetentionResult } from '@/types';

export function DetentionTimer() {
  const [facilityName, setFacilityName] = useState('');
  const [ratePerHour, setRatePerHour]   = useState(50);
  const [entryTime, setEntryTime]       = useState<Date | null>(null);
  const [now, setNow]                   = useState(new Date());
  const [result, setResult]             = useState<DetentionResult | null>(null);
  const [stopped, setStopped]           = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (entryTime && !stopped) {
      intervalRef.current = setInterval(() => setNow(new Date()), 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [entryTime, stopped]);

  function startTimer() {
    setStopped(false); setResult(null);
    setEntryTime(new Date()); setNow(new Date());
  }

  function stopTimer() {
    if (!entryTime) return;
    setStopped(true);
    if (intervalRef.current) clearInterval(intervalRef.current);
    setResult(calcDetention({ entryTimestamp: entryTime, exitTimestamp: new Date(), facilityName: facilityName || undefined, detentionRatePerHour: ratePerHour }));
  }

  const liveResult = entryTime && !stopped
    ? calcDetention({ entryTimestamp: entryTime, facilityName: facilityName || undefined, detentionRatePerHour: ratePerHour })
    : null;
  const display = result ?? liveResult;

  const elapsed = entryTime ? Math.floor((now.getTime() - entryTime.getTime()) / 1000) : 0;
  const hh = Math.floor(elapsed / 3600).toString().padStart(2, '0');
  const mm = Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0');
  const ss = (elapsed % 60).toString().padStart(2, '0');
  const isBillable = (display?.detentionMinutes ?? 0) > 120;

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2"><Timer className="h-5 w-5 text-blue-400" />Detention Stopwatch</h1>
        <p className="text-sm text-muted-foreground mt-1">Track facility wait time. Auto-generates dispute claim after 2 hours.</p>
      </div>

      <Card>
        <CardContent className="pt-5 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="facility">Facility Name</Label>
              <Input id="facility" value={facilityName} onChange={e => setFacilityName(e.target.value)}
                placeholder="e.g. Walmart DC Laredo" disabled={!!entryTime && !stopped} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rate">Rate ($/hr)</Label>
              <Input id="rate" type="number" value={ratePerHour}
                onChange={e => setRatePerHour(Number(e.target.value))} className="font-mono" disabled={!!entryTime && !stopped} />
            </div>
          </div>
          <div className="flex gap-3">
            {!entryTime || stopped
              ? <Button onClick={startTimer} className="flex-1"><Play className="h-4 w-4" />{stopped ? 'New Timer' : 'Start Timer'}</Button>
              : <Button onClick={stopTimer} variant="destructive" className="flex-1"><Square className="h-4 w-4" />Stop & Generate Claim</Button>
            }
          </div>
        </CardContent>
      </Card>

      {entryTime && (
        <Card className={cn('border-2 transition-colors', isBillable ? 'border-danger/60' : 'border-border')}>
          <CardContent className="pt-6 pb-6 text-center space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Elapsed Time</p>
            <p className={cn('font-mono text-5xl font-bold tracking-tight tabular-nums', isBillable ? 'text-danger' : 'text-foreground')}>
              {hh}:{mm}:{ss}
            </p>
            {isBillable
              ? <Badge variant="danger" pulse={true}>BILLABLE — {display?.billableMinutes} min over free window</Badge>
              : <Badge variant="muted"><Clock className="h-3 w-3" />{Math.max(0, 120 - (display?.detentionMinutes ?? 0))} min remaining in free window</Badge>
            }
            {display && display.billableAmount > 0 && (
              <p className="font-mono text-2xl font-bold text-danger">{fmt.currency(display.billableAmount)} owed</p>
            )}
          </CardContent>
        </Card>
      )}

      {result?.claimData && (
        <Card className="border-profit/30">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2 text-profit">
              <FileText className="h-4 w-4" />Detention Claim Ready
            </CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {[
                { label: 'Facility',      val: result.claimData.facilityName },
                { label: 'Entry Time',    val: result.claimData.entryTime },
                { label: 'Exit Time',     val: result.claimData.exitTime },
                { label: 'Total Hours',   val: `${result.claimData.detentionHours} hr` },
                { label: 'Billable Hrs',  val: `${result.claimData.billableHours} hr` },
                { label: 'Total Claim',   val: fmt.currency(result.claimData.totalClaim), highlight: true },
              ].map(({ label, val, highlight }) => (
                <div key={label}>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
                  <p className={cn('font-mono text-sm font-semibold mt-0.5', highlight ? 'text-profit' : 'text-foreground')}>{val}</p>
                </div>
              ))}
            </div>
            <Separator />
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Legal Statement</p>
              <p className="text-xs text-muted-foreground leading-relaxed bg-muted/30 rounded-lg p-3">{result.claimData.legalStatement}</p>
            </div>
            <Button variant="outline" className="w-full"
              onClick={() => { if (result.claimData) navigator.clipboard.writeText(result.claimData.legalStatement); }}>
              <FileText className="h-4 w-4" />Copy Claim to Clipboard
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
