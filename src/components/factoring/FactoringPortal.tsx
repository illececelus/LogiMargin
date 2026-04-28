'use client';
import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import {
  DollarSign, Upload, FileText, AlertTriangle,
  CheckCircle2, Loader2, XCircle, Wrench, TrendingUp, ArrowRight,
  Clock, Activity, CreditCard, ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn, fmt } from '@/lib/utils';
import { useInvoices, useUpdateInvoiceStatus } from '@/hooks/use-logistics';
import type { FreightAuditResult, InvoiceStatus } from '@/types';

type AuditMode = 'invoice' | 'ratecon';
type PortalTab = 'upload' | 'invoices';

interface GoNoGoResult {
  goNoGo: { decision: string; emoji: string; color: string };
  verdict: string; logimarginScore: number; action: string;
  netProfit: number; netMarginPct: number; rpmNet: number;
  flags: Array<{ type: string; message: string }>;
  auditResult: FreightAuditResult; rateConData: Record<string, unknown>;
  maintenanceAlertActive: boolean; maintenanceReserveCpm: number;
  dieselPrice: number; requiresManualReview: boolean; reason?: string;
}

const STATUS_ORDER: InvoiceStatus[] = ['pending', 'submitted', 'approved', 'funded', 'rejected', 'disputed'];
const STATUS_LABELS: Record<InvoiceStatus, string> = {
  pending: 'Bekliyor', submitted: 'Gönderildi', approved: 'Onaylandı',
  funded: 'Ödendi', rejected: 'Reddedildi', disputed: 'İtiraz',
};
const STATUS_VARIANTS: Record<InvoiceStatus, 'outline' | 'warning' | 'profit' | 'danger' | 'muted'> = {
  pending: 'outline', submitted: 'warning', approved: 'muted',
  funded: 'profit', rejected: 'danger', disputed: 'danger',
};
const NEXT_STATUS: Partial<Record<InvoiceStatus, InvoiceStatus>> = {
  pending: 'submitted', submitted: 'approved', approved: 'funded',
};

export function FactoringPortal() {
  const router = useRouter();
  const [tab, setTab] = useState<PortalTab>('upload');
  const [mode, setMode] = useState<AuditMode>('ratecon');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [goNoGo, setGoNoGo] = useState<GoNoGoResult | null>(null);
  const [auditOnly, setAuditOnly] = useState<FreightAuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draftRedirect, setDraftRedirect] = useState<string | null>(null);

  const { data: invoices } = useInvoices();
  const updateStatus = useUpdateInvoiceStatus();

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) { setFile(accepted[0]); setGoNoGo(null); setAuditOnly(null); setError(null); }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/plain': ['.txt'], 'application/pdf': ['.pdf'], 'image/*': ['.png', '.jpg', '.jpeg'] },
    maxFiles: 1,
  });

  async function runAudit() {
    if (!file) return;
    setLoading(true); setError(null); setDraftRedirect(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('mode', mode);
      if (mode === 'ratecon') {
        const res = await fetch('/api/upload-draft', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Upload failed');
        setDraftRedirect(data.redirectTo);
        setTimeout(() => router.push(data.redirectTo), 1500);
      } else {
        const res = await fetch('/api/freight-audit', { method: 'POST', body: fd });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Audit failed'); }
        setAuditOnly(await res.json() as FreightAuditResult);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  // Invoice KPIs
  const totalPending   = invoices?.filter(i => i.status === 'pending' || i.status === 'submitted').reduce((s, i) => s + i.invoiceAmount, 0) ?? 0;
  const totalFunded    = invoices?.filter(i => i.status === 'funded').reduce((s, i) => s + i.invoiceAmount, 0) ?? 0;
  const totalInPipeline = invoices?.filter(i => i.status === 'approved').reduce((s, i) => s + i.invoiceAmount, 0) ?? 0;
  const pendingCount   = invoices?.filter(i => i.status === 'pending').length ?? 0;

  const verdictBorderClass = (v?: string) =>
    v === 'green' ? 'border-profit/50 bg-profit/5' :
    v === 'red'   ? 'border-danger/50 bg-danger/5' : 'border-warning/50 bg-warning/5';

  const scoreColor = (s: number) => s >= 65 ? 'text-profit' : s >= 40 ? 'text-warning' : 'text-danger';

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" /> Factoring Portal
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            RateCon yükle, fatura takip et, nakit akışını yönet.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant={tab === 'upload' ? 'default' : 'outline'} size="sm" onClick={() => setTab('upload')}>
            <Upload className="h-3.5 w-3.5 mr-1" /> Yükle
          </Button>
          <Button variant={tab === 'invoices' ? 'default' : 'outline'} size="sm" onClick={() => setTab('invoices')}>
            <FileText className="h-3.5 w-3.5 mr-1" /> Faturalar ({invoices?.length ?? 0})
          </Button>
        </div>
      </div>

      {/* Invoice KPI Cards */}
      {tab === 'invoices' && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-warning/20">
            <CardContent className="pt-4 pb-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> Bekleyen
              </p>
              <p className="font-mono text-xl font-bold mt-1">{fmt.currency(totalPending, 0)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{pendingCount} fatura</p>
            </CardContent>
          </Card>
          <Card className="border-primary/20">
            <CardContent className="pt-4 pb-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                <Activity className="h-3 w-3" /> Onaylandı
              </p>
              <p className="font-mono text-xl font-bold mt-1">{fmt.currency(totalInPipeline, 0)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Ödeme yolda</p>
            </CardContent>
          </Card>
          <Card className="border-profit/20">
            <CardContent className="pt-4 pb-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                <CreditCard className="h-3 w-3" /> Ödendi
              </p>
              <p className="font-mono text-xl font-bold mt-1 text-profit">{fmt.currency(totalFunded, 0)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Toplam alınan</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Invoice List Tab */}
      {tab === 'invoices' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" /> Fatura Listesi
            </CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="pt-3">
            {!invoices || invoices.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="mx-auto h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">Henüz fatura yok. RateCon yükleyip yük onayla.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {invoices.map(inv => {
                  const nextSt = NEXT_STATUS[inv.status];
                  return (
                    <div key={inv.id} className="rounded-lg border border-border/50 px-3 py-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold truncate">#{inv.invoiceNumber}</p>
                          <p className="text-xs text-muted-foreground truncate">{inv.tripRoute}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-mono text-sm font-bold">{fmt.currency(inv.invoiceAmount, 0)}</p>
                          {inv.paymentDays != null && (
                            <p className="text-[10px] text-muted-foreground">{inv.paymentDays} gün</p>
                          )}
                        </div>
                        <Badge variant={STATUS_VARIANTS[inv.status]} className="shrink-0 text-[10px]">
                          {STATUS_LABELS[inv.status]}
                        </Badge>
                      </div>
                      {/* Status progression */}
                      <div className="flex items-center gap-1.5">
                        {STATUS_ORDER.slice(0, 4).map((st, idx) => (
                          <div key={st} className="flex items-center gap-1">
                            <div className={cn(
                              'h-1.5 w-6 rounded-full transition-colors',
                              STATUS_ORDER.indexOf(inv.status) >= idx ? 'bg-primary' : 'bg-muted'
                            )} />
                          </div>
                        ))}
                        <span className="text-[10px] text-muted-foreground ml-1">{STATUS_LABELS[inv.status]}</span>
                        {nextSt && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="ml-auto h-6 text-[10px] px-2"
                            disabled={updateStatus.isPending}
                            onClick={() => updateStatus.mutate({ id: inv.id, status: nextSt })}
                          >
                            {STATUS_LABELS[nextSt]} <ChevronRight className="h-3 w-3 ml-0.5" />
                          </Button>
                        )}
                        {inv.status === 'funded' && (
                          <span className="ml-auto flex items-center gap-1 text-[10px] text-profit font-semibold">
                            <CheckCircle2 className="h-3 w-3" /> Ödendi
                          </span>
                        )}
                      </div>
                      {inv.hasAiErrors && (
                        <p className="text-[10px] text-danger flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          AI fatura hatası tespit etti — {fmt.currency(inv.aiErrorAmount ?? 0)} fark
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Upload Tab */}
      {tab === 'upload' && (
        <>
          {draftRedirect && (
            <div className="flex items-center gap-3 rounded-xl border border-profit/40 bg-profit/10 px-4 py-3">
              <CheckCircle2 className="h-5 w-5 text-profit shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-profit">Belge yüklendi ve işlendi!</p>
                <p className="text-xs text-muted-foreground">İnceleme ekranına yönlendiriliyorsunuz…</p>
              </div>
              <button onClick={() => router.push(draftRedirect)} className="flex items-center gap-1 text-xs text-profit font-medium">
                Şimdi git <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Mod Seç</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                {(['ratecon', 'invoice'] as AuditMode[]).map(m => (
                  <Button key={m} variant={mode === m ? 'default' : 'outline'} size="sm" onClick={() => setMode(m)}>
                    {m === 'ratecon' ? '🚦 RateCon → Go/No-Go' : '📄 Fatura Denetle'}
                  </Button>
                ))}
              </div>

              <div
                {...getRootProps()}
                className={cn(
                  'rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors',
                  isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-secondary/30'
                )}
              >
                <input {...getInputProps()} />
                <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
                {file ? (
                  <div>
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-medium">
                      {mode === 'ratecon' ? 'Rate Confirmation belgeni buraya bırak' : 'Faturanı buraya bırak'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">PDF, resim veya metin dosyası</p>
                  </div>
                )}
              </div>

              {file && (
                <Button onClick={runAudit} disabled={loading} className="w-full sm:w-auto">
                  {loading
                    ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />AI ile analiz ediliyor…</>
                    : <><FileText className="h-4 w-4 mr-2" />{mode === 'ratecon' ? 'Go/No-Go Kararı Al' : 'Faturayı Denetle'}</>
                  }
                </Button>
              )}

              {error && (
                <div className="rounded-lg border border-danger/30 bg-danger/5 p-3 flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-danger shrink-0" />
                  <p className="text-sm text-danger">{error}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Go/No-Go Result */}
          {goNoGo && (
            <div className="space-y-4">
              {goNoGo.requiresManualReview && (
                <Card className="border-warning/50 bg-warning/5">
                  <CardContent className="pt-4 flex items-center gap-3">
                    <AlertTriangle className="h-6 w-6 text-warning shrink-0" />
                    <div>
                      <p className="font-semibold text-warning">Manuel İnceleme Gerekli</p>
                      <p className="text-sm text-muted-foreground mt-0.5">{goNoGo.reason}</p>
                    </div>
                  </CardContent>
                </Card>
              )}
              {!goNoGo.requiresManualReview && (
                <Card className={cn('border-2', verdictBorderClass(goNoGo.verdict))}>
                  <CardContent className="pt-6 pb-6 text-center space-y-2">
                    <p className="text-5xl">{goNoGo.goNoGo.emoji}</p>
                    <p className={cn('text-3xl font-black tracking-tight',
                      goNoGo.verdict === 'green' ? 'text-profit' :
                      goNoGo.verdict === 'red' ? 'text-danger' : 'text-warning'
                    )}>{goNoGo.goNoGo.decision}</p>
                    <p className="text-sm text-muted-foreground max-w-xs mx-auto">{goNoGo.action}</p>
                    <div className="flex justify-center gap-6 pt-2">
                      {[
                        { label: 'Skor', val: `${goNoGo.logimarginScore}/100`, cls: scoreColor(goNoGo.logimarginScore) },
                        { label: 'Net Kar', val: fmt.currency(goNoGo.netProfit, 0), cls: goNoGo.netProfit >= 0 ? 'text-profit' : 'text-danger' },
                        { label: 'Margin', val: `${(goNoGo.netMarginPct * 100).toFixed(1)}%`, cls: goNoGo.netMarginPct >= 0.20 ? 'text-profit' : goNoGo.netMarginPct >= 0.15 ? 'text-warning' : 'text-danger' },
                      ].map(({ label, val, cls }) => (
                        <div key={label} className="text-center">
                          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
                          <p className={cn('font-mono text-xl font-bold', cls)}>{val}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
              {goNoGo.maintenanceAlertActive && (
                <Card className="border-warning/40 bg-warning/5">
                  <CardContent className="pt-4 pb-4 flex items-center gap-3">
                    <Wrench className="h-5 w-5 text-warning shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-warning">Bakım Rezervi Aktif</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Yağ değişimi gecikmiş. $0.12/mil rezerv uygulandı.</p>
                    </div>
                  </CardContent>
                </Card>
              )}
              {goNoGo.flags?.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-warning" />Uyarılar ({goNoGo.flags.length})</CardTitle></CardHeader>
                  <Separator />
                  <CardContent className="pt-3 space-y-2">
                    {goNoGo.flags.map((f, i) => (
                      <div key={i} className={cn('rounded-lg border p-3 text-sm',
                        f.type === 'red_flag' ? 'border-danger/30 bg-danger/5 text-danger' : 'border-warning/30 bg-warning/5 text-warning'
                      )}>{f.message}</div>
                    ))}
                  </CardContent>
                </Card>
              )}
              <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
                <TrendingUp className="h-3 w-3" />
                Kuzey Texas motorin fiyatı: ${goNoGo.dieselPrice?.toFixed(2)}/gal
              </div>
            </div>
          )}

          {/* Invoice Audit Result */}
          {auditOnly && (
            <Card className={cn('border-2', auditOnly.hasErrors ? 'border-danger/40' : 'border-profit/40')}>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  {auditOnly.hasErrors ? <XCircle className="h-4 w-4 text-danger" /> : <CheckCircle2 className="h-4 w-4 text-profit" />}
                  Fatura #{auditOnly.invoiceNumber}
                  <Badge variant={auditOnly.hasErrors ? 'danger' : 'profit'} className="ml-auto">
                    {auditOnly.hasErrors ? `${auditOnly.errors.length} Hata` : 'Temiz'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <Separator />
              <CardContent className="pt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {[
                    { label: 'Faturalanan',   val: fmt.currency(auditOnly.invoicedAmount) },
                    { label: 'Beklenen',      val: fmt.currency(auditOnly.expectedAmount) },
                    { label: 'Fark',          val: fmt.currency(auditOnly.discrepancyAmount), hl: auditOnly.discrepancyAmount > 0 ? 'danger' : 'profit' },
                    { label: 'Güven',         val: fmt.percent(auditOnly.confidence) },
                  ].map(({ label, val, hl }) => (
                    <div key={label}>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
                      <p className={cn('font-mono text-sm font-semibold mt-0.5',
                        hl === 'danger' ? 'text-danger' : hl === 'profit' ? 'text-profit' : ''
                      )}>{val}</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg bg-muted/30 p-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Tavsiye</p>
                  <p className="text-sm">{auditOnly.recommendation}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
