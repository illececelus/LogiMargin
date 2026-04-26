'use client';
import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { DollarSign, Upload, FileText, AlertTriangle, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn, fmt } from '@/lib/utils';
import type { FreightAuditResult } from '@/types';

type AuditMode = 'invoice' | 'ratecon';

export function FactoringPortal() {
  const [mode, setMode] = useState<AuditMode>('invoice');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FreightAuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) { setFile(accepted[0]); setResult(null); setError(null); }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'text/plain': ['.txt'], 'application/pdf': ['.pdf'], 'image/*': ['.png', '.jpg', '.jpeg'] }, maxFiles: 1,
  });

  async function runAudit() {
    if (!file) return;
    setLoading(true); setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('mode', mode);
      const res = await fetch('/api/freight-audit', { method: 'POST', body: fd });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Audit failed'); }
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  const severityBadge = { critical: 'danger', warning: 'warning', info: 'muted' } as const;

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2"><DollarSign className="h-5 w-5 text-primary" />Factoring Portal</h1>
        <p className="text-sm text-muted-foreground mt-1">AI-powered freight invoice auditing. Catch billing errors before you factor.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Select Audit Mode</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            {(['invoice', 'ratecon'] as AuditMode[]).map(m => (
              <Button key={m} variant={mode === m ? 'default' : 'outline'} size="sm" onClick={() => setMode(m)}>
                {m === 'invoice' ? 'Audit Invoice' : 'Parse Rate Con'}
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
                <p className="text-sm font-medium">Drop your file here</p>
                <p className="text-xs text-muted-foreground mt-1">PDF, image, or text — max 10MB</p>
              </div>
            )}
          </div>

          {file && (
            <Button onClick={runAudit} disabled={loading} className="w-full sm:w-auto">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Running AI Audit…</> : <><FileText className="h-4 w-4" />Run Audit</>}
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

      {result && (
        <Card className={cn('border-2', result.hasErrors ? 'border-danger/40' : 'border-profit/40')}>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              {result.hasErrors ? <XCircle className="h-4 w-4 text-danger" /> : <CheckCircle2 className="h-4 w-4 text-profit" />}
              Audit Result — Invoice #{result.invoiceNumber}
              <Badge variant={result.hasErrors ? 'danger' : 'profit'} className="ml-auto">
                {result.hasErrors ? `${result.errors.length} Error${result.errors.length > 1 ? 's' : ''}` : 'Clean'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {[
                { label: 'Invoiced Amount', val: fmt.currency(result.invoicedAmount) },
                { label: 'Expected Amount', val: fmt.currency(result.expectedAmount) },
                { label: 'Discrepancy',     val: fmt.currency(result.discrepancyAmount), highlight: result.discrepancyAmount > 0 ? 'danger' : 'profit' },
                { label: 'Confidence',      val: fmt.percent(result.confidence) },
              ].map(({ label, val, highlight }) => (
                <div key={label}>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
                  <p className={cn('font-mono text-sm font-semibold mt-0.5', highlight === 'danger' ? 'text-danger' : highlight === 'profit' ? 'text-profit' : 'text-foreground')}>{val}</p>
                </div>
              ))}
            </div>

            <div className="rounded-lg bg-muted/30 p-3 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Summary</p>
              <p className="text-sm">{result.summary}</p>
            </div>

            {result.errors.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Errors Found</p>
                {result.errors.map((e, i) => (
                  <div key={i} className={cn('rounded-lg border p-3 space-y-1',
                    e.severity === 'critical' ? 'border-danger/30 bg-danger/5' :
                    e.severity === 'warning' ? 'border-warning/30 bg-warning/5' : 'border-border bg-muted/10'
                  )}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide">{e.field}</span>
                      <Badge variant={severityBadge[e.severity]} className="text-[10px]">{e.severity}</Badge>
                    </div>
                    <p className="text-sm">{e.description}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      Invoiced: {e.invoicedValue} → Expected: {e.expectedValue}
                      {e.difference !== 0 && ` (${e.difference > 0 ? '+' : ''}${fmt.currency(e.difference)})`}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Recommendation</p>
              <p className="text-sm">{result.recommendation}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
