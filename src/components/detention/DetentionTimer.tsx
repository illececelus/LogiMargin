'use client';
import { useState, useEffect, useRef } from 'react';
import {
  Timer, Play, Square, FileText, Clock,
  Mail, History, AlertTriangle, Save, CheckCircle2, Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn, fmt } from '@/lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { calcDetention } from '@/lib/logimargin-engine';
import type { DetentionResult } from '@/types';

type DetentionHistoryRow = {
  id: string;
  facility_name: string | null;
  created_at: string;
  billable_amount: number | null;
  billable_minutes: number | null;
};

export function DetentionTimer() {
  const qc = useQueryClient();
  const [facilityName, setFacilityName] = useState('');
  const [brokerName, setBrokerName]     = useState('');
  const [ratePerHour, setRatePerHour]   = useState(50);
  const [entryTime, setEntryTime]       = useState<Date | null>(null);
  const [now, setNow]                   = useState(new Date());
  const [result, setResult]             = useState<DetentionResult | null>(null);
  const [stopped, setStopped]           = useState(false);
  const [showEmail, setShowEmail]       = useState(false);
  const [saved, setSaved]               = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (entryTime && !stopped) {
      intervalRef.current = setInterval(() => setNow(new Date()), 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [entryTime, stopped]);

  // Load detention history
  const { data: history } = useQuery<DetentionHistoryRow[]>({
    queryKey: ['detention-history'],
    queryFn: async () => {
      const { data } = await supabase
        .from('detention_records')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  // Save detention record
  const saveRecord = useMutation({
    mutationFn: async () => {
      if (!result?.claimData) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase.from('detention_records').insert({
        user_id: user.id,
        facility_name: facilityName,
        broker_name: brokerName || null,
        entry_time: entryTime?.toISOString(),
        exit_time: new Date().toISOString(),
        detention_minutes: result.detentionMinutes,
        billable_minutes: result.billableMinutes,
        billable_amount: result.billableAmount,
        rate_per_hour: ratePerHour,
      });
      if (error) {
        // Table may not exist yet — silently succeed
        console.warn('detention_records table not found, skipping save');
      }
    },
    onSuccess: () => {
      setSaved(true);
      qc.invalidateQueries({ queryKey: ['detention-history'] });
    },
  });

  function startTimer() {
    setStopped(false); setResult(null); setSaved(false); setShowEmail(false);
    setEntryTime(new Date()); setNow(new Date());
  }

  function stopTimer() {
    if (!entryTime) return;
    setStopped(true);
    if (intervalRef.current) clearInterval(intervalRef.current);
    setResult(calcDetention({
      entryTimestamp: entryTime, exitTimestamp: new Date(),
      facilityName: facilityName || undefined, detentionRatePerHour: ratePerHour,
    }));
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

  // Email draft generator
  const emailDraft = result?.claimData ? `Konu: Detention Ücreti Talebi — ${facilityName || 'Tesis'}

Merhaba ${brokerName || 'İlgili Kişi'},

${new Date().toLocaleDateString('tr-TR')} tarihinde ${facilityName || 'belirtilen tesiste'} gerçekleştirilen yükleme/boşaltma operasyonu sırasında aşağıdaki detention süresi oluşmuştur:

• Giriş Saati: ${result.claimData.entryTime}
• Çıkış Saati: ${result.claimData.exitTime}
• Toplam Bekleme: ${result.claimData.detentionHours} saat
• Ücretsiz Süre (2 saat) sonrası faturalanabilir: ${result.claimData.billableHours} saat
• Saatlik Detention Ücreti: ${fmt.currency(ratePerHour)}/saat
• TOPLAM TALEP: ${fmt.currency(result.claimData.totalClaim)}

${result.claimData.legalStatement}

Tarafınızdan ${fmt.currency(result.claimData.totalClaim)} tutarında detention ücreti talep edilmektedir. Ödeme için lütfen en kısa sürede iletişime geçin.

Saygılarımızla` : '';

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Timer className="h-5 w-5 text-primary" /> Detention Kronometre
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Tesis bekleme süresini takip et. 2 saat sonra otomatik talep belgesi oluştur.
        </p>
      </div>

      {/* Setup Card */}
      <Card>
        <CardContent className="pt-5 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="facility">Tesis Adı</Label>
              <Input id="facility" value={facilityName}
                onChange={e => setFacilityName(e.target.value)}
                placeholder="ör. Walmart DC Laredo"
                disabled={!!entryTime && !stopped}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="broker">Broker Adı</Label>
              <Input id="broker" value={brokerName}
                onChange={e => setBrokerName(e.target.value)}
                placeholder="ör. Coyote Logistics"
                disabled={!!entryTime && !stopped}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rate">Detention Ücreti ($/saat)</Label>
              <Input id="rate" type="number" value={ratePerHour}
                onChange={e => setRatePerHour(Number(e.target.value))}
                className="font-mono" disabled={!!entryTime && !stopped}
              />
            </div>
          </div>
          <div className="flex gap-3">
            {!entryTime || stopped ? (
              <Button onClick={startTimer} className="flex-1">
                <Play className="h-4 w-4 mr-2" />
                {stopped ? 'Yeni Timer Başlat' : 'Timer Başlat'}
              </Button>
            ) : (
              <Button onClick={stopTimer} variant="destructive" className="flex-1">
                <Square className="h-4 w-4 mr-2" /> Durdur & Talep Oluştur
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Live Timer */}
      {entryTime && (
        <Card className={cn('border-2 transition-colors', isBillable ? 'border-danger/60' : 'border-border')}>
          <CardContent className="pt-6 pb-6 text-center space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Geçen Süre</p>
            <p className={cn('font-mono text-5xl font-bold tracking-tight tabular-nums',
              isBillable ? 'text-danger' : 'text-foreground'
            )}>
              {hh}:{mm}:{ss}
            </p>
            {isBillable ? (
              <Badge variant="danger">
                FATURALANAB İLİR — {display?.billableMinutes} dk ücretsiz süre aşıldı
              </Badge>
            ) : (
              <Badge variant="muted">
                <Clock className="h-3 w-3 mr-1" />
                Ücretsiz süreden {Math.max(0, 120 - (display?.detentionMinutes ?? 0))} dk kaldı
              </Badge>
            )}
            {display && display.billableAmount > 0 && (
              <p className="font-mono text-2xl font-bold text-danger">{fmt.currency(display.billableAmount)} talep edilecek</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Claim + Email */}
      {result?.claimData && (
        <Card className="border-profit/30">
          <CardHeader>
            <CardTitle className="text-sm flex items-center justify-between text-profit">
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4" /> Detention Talebi Hazır
              </span>
              <span className="font-mono text-lg">{fmt.currency(result.claimData.totalClaim)}</span>
            </CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {[
                { label: 'Tesis',         val: result.claimData.facilityName },
                { label: 'Giriş',         val: result.claimData.entryTime },
                { label: 'Çıkış',         val: result.claimData.exitTime },
                { label: 'Toplam Süre',   val: `${result.claimData.detentionHours} saat` },
                { label: 'Faturalanabilir', val: `${result.claimData.billableHours} saat` },
                { label: 'Talep Tutarı',  val: fmt.currency(result.claimData.totalClaim), hl: true },
              ].map(({ label, val, hl }) => (
                <div key={label}>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
                  <p className={cn('font-mono text-sm font-semibold mt-0.5', hl ? 'text-profit' : '')}>{val}</p>
                </div>
              ))}
            </div>

            <Separator />

            <div className="rounded-lg bg-muted/30 p-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Hukuki Beyan</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{result.claimData.legalStatement}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm"
                onClick={() => navigator.clipboard.writeText(result.claimData!.legalStatement)}>
                <FileText className="h-3.5 w-3.5 mr-1.5" /> Beyanı Kopyala
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowEmail(e => !e)}>
                <Mail className="h-3.5 w-3.5 mr-1.5" /> {showEmail ? 'E-postayı Gizle' : 'E-posta Taslağı'}
              </Button>
              {saved ? (
                <span className="flex items-center gap-1.5 text-xs text-profit font-semibold">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Kaydedildi
                </span>
              ) : (
                <Button variant="outline" size="sm"
                  onClick={() => saveRecord.mutate()}
                  disabled={saveRecord.isPending}>
                  {saveRecord.isPending
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Kaydediliyor…</>
                    : <><Save className="h-3.5 w-3.5 mr-1.5" />Geçmişe Kaydet</>
                  }
                </Button>
              )}
            </div>

            {/* Email Draft */}
            {showEmail && (
              <div className="space-y-2">
                <Separator />
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Broker E-posta Taslağı
                </p>
                <div className="rounded-lg bg-muted/20 border p-3">
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed font-sans">
                    {emailDraft}
                  </pre>
                </div>
                <Button variant="outline" size="sm" className="w-full"
                  onClick={() => navigator.clipboard.writeText(emailDraft)}>
                  <Mail className="h-3.5 w-3.5 mr-1.5" /> E-postayı Panoya Kopyala
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* History */}
      {history && history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" /> Detention Geçmişi
            </CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="pt-3 space-y-2">
            {history.map(rec => (
              <div key={rec.id} className="flex items-center justify-between gap-3 px-1 py-2 border-b border-border/30 last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{rec.facility_name || '—'}</p>
                  <p className="text-xs text-muted-foreground">{new Date(rec.created_at).toLocaleDateString('tr-TR')}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono text-sm font-bold text-danger">{fmt.currency(rec.billable_amount ?? 0, 0)}</p>
                  <p className="text-[10px] text-muted-foreground">{rec.billable_minutes ?? 0} dk</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Worst facilities */}
      {history && history.length >= 3 && (() => {
        const facilityMap = new Map<string, { total: number; count: number }>();
        for (const rec of history) {
          const name = rec.facility_name || 'Bilinmeyen';
          const existing = facilityMap.get(name) ?? { total: 0, count: 0 };
          facilityMap.set(name, { total: existing.total + (rec.billable_amount ?? 0), count: existing.count + 1 });
        }
        const sorted = Array.from(facilityMap.entries())
          .filter(([, v]) => v.total > 0)
          .sort(([, a], [, b]) => b.total - a.total)
          .slice(0, 3);
        if (sorted.length === 0) return null;
        return (
          <Card className="border-danger/20">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2 text-danger">
                <AlertTriangle className="h-4 w-4" /> En Çok Bekleyen Tesisler
              </CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="pt-3 space-y-2">
              {sorted.map(([name, v], i) => (
                <div key={name} className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{i + 1}. {name}</span>
                  <div className="text-right">
                    <span className="font-mono text-sm font-bold text-danger">{fmt.currency(v.total, 0)}</span>
                    <span className="text-xs text-muted-foreground ml-2">({v.count}x)</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
}
