// ============================================================
// LogiMargin — TanStack Query Hooks (Supabase)
// ============================================================
'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { TripRow, InvoiceRow, InvoiceStatus } from '@/types';

type InvoiceQueryRow = {
  id: string;
  invoice_number: string;
  invoice_amount: number;
  advance_amount: number | null;
  status: string;
  has_ai_errors: boolean;
  ai_error_amount: number | null;
  paid_at: string | null;
  payment_days: number | null;
  trips: { origin: string; destination: string } | { origin: string; destination: string }[] | null;
};

function invoiceTripRoute(trips: InvoiceQueryRow['trips']) {
  const trip = Array.isArray(trips) ? trips[0] : trips;
  return trip ? `${trip.origin} → ${trip.destination}` : 'No trip linked';
}

// ── useTrips ──────────────────────────────────────────────────
export function useTrips() {
  return useQuery({
    queryKey: ['trips'],
    queryFn: async (): Promise<TripRow[]> => {
      const { data, error } = await supabase
        .from('trips')
        .select('id, origin, destination, gross_pay, net_profit, logimargin_score, verdict, action, status, pickup_date, broker_name')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message);
      return (data ?? []).map(r => ({
        id: r.id,
        origin: r.origin,
        destination: r.destination,
        grossPay: r.gross_pay,
        netProfit: r.net_profit,
        logimarginScore: r.logimargin_score,
        verdict: r.verdict,
        action: r.action,
        status: r.status,
        pickupDate: r.pickup_date,
        brokerName: r.broker_name,
      }));
    },
    staleTime: 30_000,
  });
}

export function useInsertTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (trip: {
      origin: string; destination: string; equipment_type: string;
      gross_pay: number; loaded_miles: number; deadhead_miles: number;
      fuel_cost: number; toll_cost: number; driver_pay: number; maint_cost: number;
      factoring_rate?: number; net_profit?: number; net_margin_pct?: number;
      logimargin_score?: number; verdict?: string; action?: string;
      pickup_date?: string; delivery_date?: string; broker_name?: string; broker_rating?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('trips')
        .insert({ ...trip, user_id: user.id })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trips'] }),
  });
}

// ── useInvoices ───────────────────────────────────────────────
export function useInvoices() {
  return useQuery({
    queryKey: ['invoices'],
    queryFn: async (): Promise<InvoiceRow[]> => {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          id, invoice_number, invoice_amount, advance_amount,
          status, has_ai_errors, ai_error_amount, paid_at, payment_days,
          trips(origin, destination)
        `)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message);
      return ((data ?? []) as InvoiceQueryRow[]).map(r => ({
        id: r.id,
        invoiceNumber: r.invoice_number,
        tripRoute: invoiceTripRoute(r.trips),
        invoiceAmount: r.invoice_amount,
        advanceAmount: r.advance_amount,
        status: r.status as InvoiceStatus,
        hasAiErrors: r.has_ai_errors,
        aiErrorAmount: r.ai_error_amount,
        paidAt: r.paid_at ?? null,
        paymentDays: r.payment_days ?? null,
      }));
    },
    staleTime: 30_000,
  });
}

export function useUpdateInvoiceStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: InvoiceStatus }) => {
      const { error } = await supabase.from('invoices').update({ status }).eq('id', id);
      if (error) throw new Error(error.message);
    },
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ['invoices'] });
      const prev = qc.getQueryData<InvoiceRow[]>(['invoices']);
      qc.setQueryData<InvoiceRow[]>(['invoices'], old =>
        old?.map(inv => inv.id === id ? { ...inv, status } : inv) ?? []
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(['invoices'], ctx?.prev),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      // Broker skorlarını da güncelle (payment_days değişmiş olabilir)
      qc.invalidateQueries({ queryKey: ['broker-scores'] });
    },
  });
}

// ── useMaintenance ────────────────────────────────────────────
export function useMaintenance() {
  return useQuery({
    queryKey: ['vehicle-vitals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicle_vitals')
        .select('*')
        .order('recorded_at', { ascending: false })
        .limit(20);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

// ── useMaintenanceAlert (global: oil >15k miles delta) ────────
export function useMaintenanceAlert() {
  const { data: vitals } = useMaintenance();
  if (!vitals || vitals.length === 0) return { hasAlert: false, reserveCpm: 0, alertMessage: '' };

  const latest = vitals[0];
  const delta = latest.current_odometer - (latest.last_oil_change_mi ?? latest.current_odometer);
  const hasAlert = delta > 15_000;
  const reserveCpm = hasAlert ? 0.12 : 0;
  const alertMessage = hasAlert
    ? `⚠️ Oil change overdue by ${(delta - 15_000).toLocaleString()} miles. $0.12/mi Maintenance Reserve active.`
    : '';

  return { hasAlert, reserveCpm, alertMessage, delta };
}
