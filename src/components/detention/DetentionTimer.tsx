'use client';
import { useState, useEffect, useRef } from 'react';
import {
  Timer, Play, Square, FileText, Clock,
  Mail, History, AlertTriangle, Save, CheckCircle2, Loader2,
  MapPin,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn, fmt } from '@/lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { isSupabaseClientConfigured, supabase } from '@/lib/supabase';
import { getLocalDetentionRecords, insertLocalDetentionRecord, type LocalDetentionRecord } from '@/lib/local-store';
import { calcDetention } from '@/lib/logimargin-engine';
import type { DetentionResult } from '@/types';

type DetentionHistoryRow = {
  id: string;
  facility_name: string | null;
  broker_name?: string | null;
  facility_address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  created_at: string;
  billable_amount: number | null;
  billable_minutes: number | null;
};

type PersistedDetentionState = {
  facilityName: string;
  brokerName: string;
  ratePerHour: number;
  facilityAddress: string;
  latitude: number | null;
  longitude: number | null;
  entryTimeIso: string | null;
  exitTimeIso: string | null;
  stopped: boolean;
};

const DETENTION_STORAGE_KEY = 'logimargin:detention-timer:v1';

export function DetentionTimer() {
  const qc = useQueryClient();
  const [facilityName, setFacilityName] = useState('');
  const [brokerName, setBrokerName]     = useState('');
  const [facilityAddress, setFacilityAddress] = useState('');
  const [latitude, setLatitude]         = useState<number | null>(null);
  const [longitude, setLongitude]       = useState<number | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [ratePerHour, setRatePerHour]   = useState(50);
  const [entryTime, setEntryTime]       = useState<Date | null>(null);
  const [exitTime, setExitTime]         = useState<Date | null>(null);
  const [now, setNow]                   = useState(new Date());
  const [result, setResult]             = useState<DetentionResult | null>(null);
  const [stopped, setStopped]           = useState(false);
  const [showEmail, setShowEmail]       = useState(false);
  const [saved, setSaved]               = useState(false);
  const [hydrated, setHydrated]         = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DETENTION_STORAGE_KEY);
      if (!raw) {
        setHydrated(true);
        return;
      }

      const parsed = JSON.parse(raw) as PersistedDetentionState;
      const hydratedEntry = parsed.entryTimeIso ? new Date(parsed.entryTimeIso) : null;
      const hydratedExit = parsed.exitTimeIso ? new Date(parsed.exitTimeIso) : null;

      setFacilityName(parsed.facilityName ?? '');
      setBrokerName(parsed.brokerName ?? '');
      setFacilityAddress(parsed.facilityAddress ?? '');
      setLatitude(parsed.latitude ?? null);
      setLongitude(parsed.longitude ?? null);
      setRatePerHour(Number.isFinite(parsed.ratePerHour) ? parsed.ratePerHour : 50);
      setEntryTime(hydratedEntry);
      setExitTime(hydratedExit);
      setStopped(parsed.stopped);
      setNow(parsed.stopped && hydratedExit ? hydratedExit : new Date());

      if (parsed.stopped && hydratedEntry && hydratedExit) {
        setResult(calcDetention({
          entryTimestamp: hydratedEntry,
          exitTimestamp: hydratedExit,
          facilityName: parsed.facilityName || undefined,
          detentionRatePerHour: parsed.ratePerHour,
        }));
      }
    } catch {
      window.localStorage.removeItem(DETENTION_STORAGE_KEY);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const payload: PersistedDetentionState = {
      facilityName,
      brokerName,
      ratePerHour,
      facilityAddress,
      latitude,
      longitude,
      entryTimeIso: entryTime?.toISOString() ?? null,
      exitTimeIso: exitTime?.toISOString() ?? null,
      stopped,
    };
    window.localStorage.setItem(DETENTION_STORAGE_KEY, JSON.stringify(payload));
  }, [brokerName, entryTime, exitTime, facilityAddress, facilityName, hydrated, latitude, longitude, ratePerHour, stopped]);

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
      if (!isSupabaseClientConfigured) return getLocalDetentionRecords();
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
      const payload: Omit<LocalDetentionRecord, 'id' | 'created_at'> = {
        facility_name: facilityName,
        broker_name: brokerName || null,
        facility_address: facilityAddress || null,
        latitude,
        longitude,
        entry_time: entryTime?.toISOString() ?? null,
        exit_time: exitTime?.toISOString() ?? new Date().toISOString(),
        detention_minutes: result.detentionMinutes,
        billable_minutes: result.billableMinutes,
        billable_amount: result.billableAmount,
        rate_per_hour: ratePerHour,
      };

      if (!isSupabaseClientConfigured) {
        insertLocalDetentionRecord(payload);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase.from('detention_records').insert({
        user_id: user.id,
        ...payload,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setSaved(true);
      qc.invalidateQueries({ queryKey: ['detention-history'] });
    },
  });

  function startTimer() {
    const startedAt = new Date();
    setStopped(false);
    setResult(null);
    setSaved(false);
    setShowEmail(false);
    setExitTime(null);
    setEntryTime(startedAt);
    setNow(startedAt);
  }

  function captureLocation() {
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError('Tarayıcı lokasyon desteği vermiyor.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLatitude(Number(pos.coords.latitude.toFixed(6)));
        setLongitude(Number(pos.coords.longitude.toFixed(6)));
      },
      err => setLocationError(err.message || 'Lokasyon alınamadı.'),
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }

  function stopTimer() {
    if (!entryTime) return;
    const stoppedAt = new Date();
    setStopped(true);
    setExitTime(stoppedAt);
    setNow(stoppedAt);
    if (intervalRef.current) clearInterval(intervalRef.current);
    setResult(calcDetention({
      entryTimestamp: entryTime, exitTimestamp: stoppedAt,
      facilityName: facilityName || undefined, detentionRatePerHour: ratePerHour,
    }));
  }

  function resetTimer() {
    setFacilityName('');
    setBrokerName('');
    setFacilityAddress('');
    setLatitude(null);
    setLongitude(null);
    setLocationError(null);
    setRatePerHour(50);
    setEntryTime(null);
    setExitTime(null);
    setResult(null);
    setStopped(false);
    setShowEmail(false);
    setSaved(false);
    window.localStorage.removeItem(DETENTION_STORAGE_KEY);
  }

  const liveResult = entryTime && !stopped
    ? calcDetention({ entryTimestamp: entryTime, facilityName: facilityName || undefined, detentionRatePerHour: ratePerHour })
    : null;
  const display = result ?? liveResult;

  const elapsedUntil = stopped && exitTime ? exitTime : now;
  const elapsed = entryTime ? Math.floor((elapsedUntil.getTime() - entryTime.getTime()) / 1000) : 0;
  const hh = Math.floor(elapsed / 3600).toString().padStart(2, '0');
  const mm = Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0');
  const ss = (elapsed % 60).toString().padStart(2, '0');
  const isBillable = (display?.detentionMinutes ?? 0) > 120;
  const mapUrl = latitude != null && longitude != null
    ? `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
    : facilityAddress
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(facilityAddress)}`
      : null;

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-300/80">Detention Control</p>
          <h1 className="mt-2 flex items-center gap-2 text-3xl font-black tracking-tight text-slate-50">
            <Timer className="h-6 w-6 text-emerald-300" /> Detention Timer
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Tesis bekleme süresini takip et; aktif timer yenilemede localStorage ile devam eder.
          </p>
        </div>
        {entryTime && (
          <Badge variant={stopped ? 'warning' : 'profit'} className="w-fit font-mono">
            <span className={cn('h-1.5 w-1.5 rounded-full', stopped ? 'bg-warning' : 'bg-emerald-400 animate-pulse')} />
            {stopped ? 'STOPPED' : 'RUNNING'}
          </Badge>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Setup Card */}
        <Card className="lg:col-span-5 bg-white/[0.04] backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-sm">Bekleme Kaydı</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
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
                <Label htmlFor="facilityAddress">Lokasyon / Adres</Label>
                <Input id="facilityAddress" value={facilityAddress}
                  onChange={e => setFacilityAddress(e.target.value)}
                  placeholder="ör. 123 Border Rd, Laredo, TX"
                  disabled={!!entryTime && !stopped}
                />
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-300">Konum Kaydı</p>
                    <p className="mt-1 truncate font-mono text-[11px] text-slate-500">
                      {latitude != null && longitude != null ? `${latitude}, ${longitude}` : 'GPS veya adres ile harita linki oluşturulur'}
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={captureLocation} disabled={!!entryTime && !stopped}>
                    GPS Al
                  </Button>
                </div>
                {mapUrl && (
                  <a href={mapUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs font-semibold text-emerald-300 hover:text-emerald-200">
                    Haritada Aç
                  </a>
                )}
                {locationError && <p className="mt-2 text-xs text-danger">{locationError}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rate">Detention Ücreti ($/saat)</Label>
                <Input id="rate" type="number" value={ratePerHour}
                  onChange={e => setRatePerHour(Number(e.target.value))}
                  className="font-mono" disabled={!!entryTime && !stopped}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              {!entryTime || stopped ? (
                <Button onClick={startTimer} className="flex-1 bg-emerald-400 text-slate-950 hover:bg-emerald-300">
                  <Play className="h-4 w-4 mr-2" />
                  {stopped ? 'Yeni Timer Başlat' : 'Timer Başlat'}
                </Button>
              ) : (
                <Button onClick={stopTimer} variant="destructive" className="flex-1">
                  <Square className="h-4 w-4 mr-2" /> Durdur & Talep Oluştur
                </Button>
              )}
              {entryTime && (
                <Button onClick={resetTimer} variant="outline" className="flex-1 border-white/10 bg-slate-950/50">
                  Kaydı Sıfırla
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Live Timer */}
        <Card className={cn('lg:col-span-7 bg-slate-950/70 transition-colors', isBillable ? 'border-danger/60' : 'border-emerald-400/20')}>
          <CardContent className="flex min-h-80 flex-col items-center justify-center space-y-4 py-8 text-center">
            {entryTime ? (
              <>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Geçen Süre</p>
                <p className={cn('font-mono text-6xl font-black tracking-tight tabular-nums sm:text-7xl',
                  isBillable ? 'text-danger' : 'text-slate-50'
                )}>
                  {hh}:{mm}:{ss}
                </p>
                {isBillable ? (
                  <Badge variant="danger">
                    FATURALANABILIR - {display?.billableMinutes} dk ücretsiz süre aşıldı
                  </Badge>
                ) : (
                  <Badge variant="muted" className="bg-white/5 text-slate-300">
                    <Clock className="h-3 w-3 mr-1" />
                    Ücretsiz süreden {Math.max(0, 120 - (display?.detentionMinutes ?? 0))} dk kaldı
                  </Badge>
                )}
                {display && display.billableAmount > 0 && (
                  <p className="font-mono text-2xl font-bold text-danger">{fmt.currency(display.billableAmount)} talep edilecek</p>
                )}
              </>
            ) : (
              <>
                <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 p-4">
                  <Timer className="h-8 w-8 text-emerald-300" />
                </div>
                <div>
                  <p className="font-semibold text-slate-100">Timer hazır</p>
                  <p className="mt-1 text-sm text-slate-400">Tesis ve broker bilgisini girip beklemeyi başlat.</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

      {/* Claim + Email */}
      {result?.claimData && (
        <Card className="lg:col-span-12 border-profit/30 bg-white/[0.04] backdrop-blur-md">
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
              {mapUrl && (
                <Button variant="outline" size="sm" asChild>
                  <a href={mapUrl} target="_blank" rel="noreferrer">
                    <MapPin className="h-3.5 w-3.5 mr-1.5" /> Haritada Aç
                  </a>
                </Button>
              )}
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
        <Card className="lg:col-span-6 bg-white/[0.04] backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" /> Detention Geçmişi
            </CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="pt-3 space-y-2">
            {history.map(rec => {
              const recMapUrl = rec.latitude != null && rec.longitude != null
                ? `https://www.google.com/maps/search/?api=1&query=${rec.latitude},${rec.longitude}`
                : rec.facility_address
                  ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(rec.facility_address)}`
                  : null;
              return (
                <div key={rec.id} className="flex items-center justify-between gap-3 px-1 py-2 border-b border-border/30 last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{rec.facility_name || '-'}</p>
                    <p className="text-xs text-muted-foreground">{new Date(rec.created_at).toLocaleDateString('tr-TR')}</p>
                    {recMapUrl && (
                      <a href={recMapUrl} target="_blank" rel="noreferrer" className="text-[10px] text-emerald-300 hover:underline">
                        Lokasyonu aç
                      </a>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono text-sm font-bold text-danger">{fmt.currency(rec.billable_amount ?? 0, 0)}</p>
                    <p className="text-[10px] text-muted-foreground">{rec.billable_minutes ?? 0} dk</p>
                  </div>
                </div>
              );
            })}
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
          <Card className="lg:col-span-6 border-danger/20 bg-white/[0.04] backdrop-blur-md">
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
    </div>
  );
}
