'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2, AlertTriangle, Loader2, FileText,
  MapPin, DollarSign, Truck, Calendar, XCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/lib/supabase';
import { cn, fmt } from '@/lib/utils';

interface DraftData {
  id: string;
  file_url: string;
  file_name: string;
  raw_ai_data: Record<string, unknown>;
  status: string;
  confidence: number;
  has_warnings: boolean;
  warnings: string[];
  created_at: string;
}

interface FormState {
  origin: string;
  destination: string;
  grossPay: string;
  loadedMiles: string;
  equipmentType: string;
  brokerName: string;
  pickupDate: string;
  deliveryDate: string;
  fuelCost: string;
  driverPay: string;
  tollCost: string;
}

export function DraftReviewView({ draftId }: { draftId: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState<DraftData | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({
    origin: '', destination: '', grossPay: '', loadedMiles: '',
    equipmentType: 'dry_van', brokerName: '', pickupDate: '',
    deliveryDate: '', fuelCost: '', driverPay: '', tollCost: '',
  });

  const loadDraft = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('load_drafts')
      .select('*')
      .eq('id', draftId)
      .single();
    if (err || !data) {
      setError('Draft not found');
    } else {
      setDraft(data as DraftData);
      const ai = data.raw_ai_data as Record<string, unknown>;
      setForm({
        origin: (ai.origin as string) ?? '',
        destination: (ai.destination as string) ?? '',
        grossPay: ai.grossPay != null ? String(ai.grossPay) : '',
        loadedMiles: ai.loadedMiles != null ? String(ai.loadedMiles) : '',
        equipmentType: (ai.equipmentType as string) ?? 'dry_van',
        brokerName: (ai.brokerName as string) ?? '',
        pickupDate: (ai.pickupDate as string) ?? '',
        deliveryDate: (ai.deliveryDate as string) ?? '',
        fuelCost: '',
        driverPay: '',
        tollCost: '',
      });
    }
    setLoading(false);
  }, [draftId]);

  useEffect(() => { loadDraft(); }, [loadDraft]);

  async function confirmDraft() {
    setConfirming(true);
    setError(null);
    try {
      const res = await fetch('/api/confirm-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId,
          overrides: {
            origin: form.origin || undefined,
            destination: form.destination || undefined,
            grossPay: form.grossPay ? parseFloat(form.grossPay) : undefined,
            loadedMiles: form.loadedMiles ? parseInt(form.loadedMiles) : undefined,
            equipmentType: form.equipmentType || undefined,
            brokerName: form.brokerName || undefined,
            pickupDate: form.pickupDate || undefined,
            deliveryDate: form.deliveryDate || undefined,
            fuelCost: form.fuelCost ? parseFloat(form.fuelCost) : 0,
            driverPay: form.driverPay ? parseFloat(form.driverPay) : 0,
            tollCost: form.tollCost ? parseFloat(form.tollCost) : 0,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Confirm failed');
      router.push('/loads');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setConfirming(false);
    }
  }

  const confidenceColor = (c: number) =>
    c >= 0.85 ? 'text-profit' : c >= 0.5 ? 'text-warning' : 'text-danger';

  const confidenceLabel = (c: number) =>
    c >= 0.85 ? 'High Confidence' : c >= 0.5 ? 'Medium — Review fields' : 'Low — Manual entry needed';

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  if (error && !draft) return (
    <div className="rounded-xl border border-danger/30 bg-danger/5 p-8 text-center">
      <XCircle className="mx-auto h-8 w-8 text-danger mb-2" />
      <p className="text-danger font-medium">{error}</p>
    </div>
  );

  if (!draft) return null;

  const isConfirmed = draft.status === 'confirmed';
  const netProfit = (parseFloat(form.grossPay) || 0)
    - (parseFloat(form.fuelCost) || 0)
    - (parseFloat(form.driverPay) || 0)
    - (parseFloat(form.tollCost) || 0);

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Draft Review
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{draft.file_name}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('text-sm font-semibold', confidenceColor(draft.confidence))}>
            {confidenceLabel(draft.confidence)}
          </span>
          <Badge variant={draft.confidence >= 0.85 ? 'profit' : draft.confidence >= 0.5 ? 'warning' : 'danger'}>
            {(draft.confidence * 100).toFixed(0)}%
          </Badge>
        </div>
      </div>

      {/* Warnings */}
      {draft.has_warnings && draft.warnings.length > 0 && (
        <div className="space-y-2">
          {draft.warnings.map((w, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
              <p className="text-sm text-warning font-medium">{w}</p>
            </div>
          ))}
        </div>
      )}

      {isConfirmed && (
        <div className="flex items-center gap-2 rounded-lg border border-profit/30 bg-profit/5 px-3 py-2">
          <CheckCircle2 className="h-4 w-4 text-profit" />
          <p className="text-sm text-profit font-medium">This draft has been confirmed and added to Active Loads.</p>
        </div>
      )}

      {/* Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Document preview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" /> Document Preview
            </CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="pt-4">
            {draft.file_url ? (
              <div className="rounded-lg border bg-muted/20 overflow-hidden">
                {draft.file_name?.toLowerCase().endsWith('.pdf') ? (
                  <iframe
                    src={draft.file_url}
                    className="w-full h-[500px]"
                    title="Document preview"
                  />
                ) : draft.file_name?.match(/\.(png|jpg|jpeg|webp)$/i) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={draft.file_url} alt="Document" className="w-full object-contain max-h-[500px]" />
                ) : (
                  <div className="p-8 text-center text-muted-foreground space-y-2">
                    <FileText className="mx-auto h-12 w-12" />
                    <p className="text-sm">{draft.file_name}</p>
                    <a
                      href={draft.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary underline"
                    >
                      Open document →
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                <FileText className="mx-auto h-8 w-8 mb-2" />
                <p className="text-sm">No preview available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Editable form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> AI-Extracted Data — Review & Edit
            </CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="pt-4 space-y-4">
            {/* Route */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" /> Route
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Origin</Label>
                  <Input
                    value={form.origin}
                    onChange={e => setForm(f => ({ ...f, origin: e.target.value }))}
                    placeholder="Dallas, TX"
                    disabled={isConfirmed}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Destination</Label>
                  <Input
                    value={form.destination}
                    onChange={e => setForm(f => ({ ...f, destination: e.target.value }))}
                    placeholder="Denver, CO"
                    disabled={isConfirmed}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Pickup Date</Label>
                  <Input
                    type="date"
                    value={form.pickupDate}
                    onChange={e => setForm(f => ({ ...f, pickupDate: e.target.value }))}
                    disabled={isConfirmed}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Delivery Date</Label>
                  <Input
                    type="date"
                    value={form.deliveryDate}
                    onChange={e => setForm(f => ({ ...f, deliveryDate: e.target.value }))}
                    disabled={isConfirmed}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Financials */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                <DollarSign className="h-3 w-3" /> Financials
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Gross Pay ($)</Label>
                  <Input
                    type="number"
                    value={form.grossPay}
                    onChange={e => setForm(f => ({ ...f, grossPay: e.target.value }))}
                    placeholder="3200"
                    disabled={isConfirmed}
                    className="h-8 text-sm font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Loaded Miles</Label>
                  <Input
                    type="number"
                    value={form.loadedMiles}
                    onChange={e => setForm(f => ({ ...f, loadedMiles: e.target.value }))}
                    placeholder="1050"
                    disabled={isConfirmed}
                    className="h-8 text-sm font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Fuel Cost ($)</Label>
                  <Input
                    type="number"
                    value={form.fuelCost}
                    onChange={e => setForm(f => ({ ...f, fuelCost: e.target.value }))}
                    placeholder="0"
                    disabled={isConfirmed}
                    className="h-8 text-sm font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Driver Pay ($)</Label>
                  <Input
                    type="number"
                    value={form.driverPay}
                    onChange={e => setForm(f => ({ ...f, driverPay: e.target.value }))}
                    placeholder="0"
                    disabled={isConfirmed}
                    className="h-8 text-sm font-mono"
                  />
                </div>
              </div>

              {/* Live net profit preview */}
              <div className={cn(
                'rounded-lg border p-3 flex items-center justify-between',
                netProfit >= 0 ? 'border-profit/30 bg-profit/5' : 'border-danger/30 bg-danger/5'
              )}>
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Est. Net Profit</span>
                <span className={cn('font-mono text-lg font-bold', netProfit >= 0 ? 'text-profit' : 'text-danger')}>
                  {fmt.currency(netProfit, 0)}
                </span>
              </div>
            </div>

            <Separator />

            {/* Equipment & Broker */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                <Truck className="h-3 w-3" /> Load Details
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Broker</Label>
                  <Input
                    value={form.brokerName}
                    onChange={e => setForm(f => ({ ...f, brokerName: e.target.value }))}
                    placeholder="Broker name"
                    disabled={isConfirmed}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Equipment</Label>
                  <Input
                    value={form.equipmentType}
                    onChange={e => setForm(f => ({ ...f, equipmentType: e.target.value }))}
                    placeholder="dry_van"
                    disabled={isConfirmed}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-danger/30 bg-danger/5 p-3 flex items-center gap-2">
                <XCircle className="h-4 w-4 text-danger shrink-0" />
                <p className="text-sm text-danger">{error}</p>
              </div>
            )}

            {!isConfirmed && (
              <Button
                onClick={confirmDraft}
                disabled={confirming}
                className="w-full bg-profit hover:bg-profit/90 text-white font-bold"
                size="lg"
              >
                {confirming
                  ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Confirming…</>
                  : <><CheckCircle2 className="h-4 w-4 mr-2" />Confirm & Add to Active Loads</>
                }
              </Button>
            )}

            {isConfirmed && (
              <Button variant="outline" className="w-full" onClick={() => router.push('/loads')}>
                View Active Loads →
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
