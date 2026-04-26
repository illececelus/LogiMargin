'use client';
import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  DollarSign, Upload, FileText, AlertTriangle,
  CheckCircle2, Loader2, XCircle, Wrench, TrendingUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn, fmt } from '@/lib/utils';
import type { FreightAuditResult } from '@/types';

type AuditMode = 'invoice' | 'ratecon';

interface GoNoGoResult {
  goNoGo: { decision: string; emoji: string; color: string };
  verdict: string;
  logimarginScore: number;
  action: string;
  netProfit: number;
  netMarginPct: number;
  rpmNet: number;
  flags: Array<{ type: string; message: string }>;
  auditResult: FreightAuditResult;
  rateConData: Record<string, unknown>;
  maintenanceAlertActive: boolean;
  maintenanceReserveCpm: number;
  dieselPrice: number;
  requiresManualReview: boolean;
  reason?: string;
}

export function FactoringPortal() {
  const [mode, setMode] = useState<AuditMode>('ratecon');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [goNoGo, setGoNoGo] = useState<GoNoGoResult | null>(null);
  const [auditOnly, setAuditOnly] = useState<FreightAuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    setLoading(true); setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('mode', mode);

      // For RateCon: use the full /api/audit (Go/No-Go decision)
      // For invoice-only: use /api/freight-audit
      const endpoint = mode === 'ratecon' ? '/api/audit' : '/api/freight-audit';
      const res = await fetch(endpoint, { method: 'POST', body: fd });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Audit failed'); }

      const data = await res.json();
      if (mode === 'ratecon') {
        setGoNoGo(data as GoNoGoResult);
      } else {
        setAuditOnly(data as FreightAuditResult);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  const verdictBorderClass = (v?: string) =>
    v === 'green' ? 'border-profit/50 bg-profit/5' :
    v === 'red'   ? 'border-danger/50 bg-danger/5' :
                   'border-warning/50 bg-warning/5';

  const scoreColor = (s: number) =>
    s >= 65 ? 'text-profit' : s >= 40 ? 'text-warning' : 'text-danger';

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-primary" />Factoring Portal
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload a RateCon for a Go/No-Go decision, or audit an invoice for billing errors.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Select Mode</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            {(['ratecon', 'invoice'] as AuditMode[]).map(m => (
              <Button key={m} variant={mode === m ? 'default' : 'outline'} size="sm" onClick={() => setMode(m)}>
                {m === 'ratecon' ? '🚦 RateCon → Go/No-Go' : '📄 Audit Invoice'}
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
                <p className="text-sm font-medium">Drop your {mode === 'ratecon' ? 'Rate Confirmation' : 'Invoice'} here</p>
                <p className="text-xs text-muted-foreground mt-1">PDF, image, or text file</p>
              </div>
            )}
          </div>

          {file && (
            <Button onClick={runAudit} disabled={loading} className="w-full sm:w-auto">
              {loading
                ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Analyzing with AI…</>
                : <><FileText className="h-4 w-4 mr-2" />{mode === 'ratecon' ? 'Get Go/No-Go Decision' : 'Run Audit'}</>
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

      {/* ── Go/No-Go Result ───────────────────────────────────── */}
      {goNoGo && (
        <div className="space-y-4">
          {/* Manual review gate */}
          {goNoGo.requiresManualReview && (
            <Card className="border-warning/50 bg-warning/5">
              <CardContent className="pt-4 flex items-center gap-3">
                <AlertTriangle className="h-6 w-6 text-warning shrink-0" />
                <div>
                  <p className="font-semibold text-warning">Manual Review Required</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{goNoGo.reason}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Main verdict card */}
          {!goNoGo.requiresManualReview && (
            <Card className={cn('border-2', verdictBorderClass(goNoGo.verdict))}>
              <CardContent className="pt-6 pb-6 text-center space-y-2">
                <p className="text-5xl">{goNoGo.goNoGo.emoji}</p>
                <p className={cn('text-3xl font-black tracking-tight',
                  goNoGo.verdict === 'green' ? 'text-profit' :
                  goNoGo.verdict === 'red'   ? 'text-danger' : 'text-warning'
                )}>
                  {goNoGo.goNoGo.decision}
                </p>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">{goNoGo.action}</p>
                <div className="flex justify-center gap-4 pt-2">
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Score</p>
                    <p className={cn('font-mono text-xl font-bold', scoreColor(goNoGo.logimarginScore))}>
                      {goNoGo.logimarginScore}/100
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Net Profit</p>
                    <p className={cn('font-mono text-xl font-bold', goNoGo.netProfit >= 0 ? 'text-profit' : 'text-danger')}>
                      {fmt.currency(goNoGo.netProfit, 0)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Margin</p>
                    <p className={cn('font-mono text-xl font-bold', goNoGo.netMarginPct >= 0.20 ? 'text-profit' : goNoGo.netMarginPct >= 0.15 ? 'text-warning' : 'text-danger')}>
                      {(goNoGo.netMarginPct * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Maintenance reserve alert */}
          {goNoGo.maintenanceAlertActive && (
            <Card className="border-warning/40 bg-warning/5">
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <Wrench className="h-5 w-5 text-warning shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-warning">Maintenance Reserve Active</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Oil change overdue. $0.12/mi reserve applied to this analysis.
                    Net profit reflects real cost.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Flags */}
          {goNoGo.flags && goNoGo.flags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  Flags ({goNoGo.flags.length})
                </CardTitle>
              </CardHeader>
              <Separator />
              <CardContent className="pt-3 space-y-2">
                {goNoGo.flags.map((f, i) => (
                  <div key={i} className={cn('rounded-lg border p-3 text-sm',
                    f.type === 'red_flag' ? 'border-danger/30 bg-danger/5 text-danger' : 'border-warning/30 bg-warning/5 text-warning'
                  )}>
                    {f.message}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* AI Audit detail */}
          {goNoGo.auditResult && goNoGo.auditResult.hasErrors && (
            <Card className="border-danger/30">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-danger" />
                  Invoice Errors Found
                  <Badge variant="danger" className="ml-auto">{goNoGo.auditResult.errors.length}</Badge>
                </CardTitle>
              </CardHeader>
              <Separator />
              <CardContent className="pt-3 space-y-2">
                {goNoGo.auditResult.errors.map((e, i) => (
                  <div key={i} className={cn('rounded-lg border p-3 space-y-1',
                    e.severity === 'critical' ? 'border-danger/30 bg-danger/5' : 'border-warning/30 bg-warning/5'
                  )}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase">{e.field}</span>
                      <Badge variant={e.severity === 'critical' ? 'danger' : 'warning'} className="text-[10px]">{e.severity}</Badge>
                    </div>
                    <p className="text-sm">{e.description}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Diesel price used */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
            <TrendingUp className="h-3 w-3" />
            North Texas diesel used: ${goNoGo.dieselPrice?.toFixed(2)}/gal
          </div>
        </div>
      )}

      {/* ── Invoice-only audit result ─────────────────────────── */}
      {auditOnly && (
        <Card className={cn('border-2', auditOnly.hasErrors ? 'border-danger/40' : 'border-profit/40')}>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              {auditOnly.hasErrors
                ? <XCircle className="h-4 w-4 text-danger" />
                : <CheckCircle2 className="h-4 w-4 text-profit" />}
              Invoice #{auditOnly.invoiceNumber}
              <Badge variant={auditOnly.hasErrors ? 'danger' : 'profit'} className="ml-auto">
                {auditOnly.hasErrors ? `${auditOnly.errors.length} Error${auditOnly.errors.length > 1 ? 's' : ''}` : 'Clean'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {[
                { label: 'Invoiced', val: fmt.currency(auditOnly.invoicedAmount) },
                { label: 'Expected', val: fmt.currency(auditOnly.expectedAmount) },
                { label: 'Discrepancy', val: fmt.currency(auditOnly.discrepancyAmount), hl: auditOnly.discrepancyAmount > 0 ? 'danger' : 'profit' },
                { label: 'Confidence', val: fmt.percent(auditOnly.confidence) },
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
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Recommendation</p>
              <p className="text-sm">{auditOnly.recommendation}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
