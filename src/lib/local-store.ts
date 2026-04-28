'use client';
import type { InvoiceRow, TripRow, Verdict } from '@/types';
import type { BrokerScore } from '@/app/api/broker-scores/route';

export type LocalTripInput = {
  origin: string; destination: string; equipment_type: string;
  gross_pay: number; loaded_miles: number; deadhead_miles: number;
  fuel_cost: number; toll_cost: number; driver_pay: number; maint_cost: number;
  factoring_rate?: number; net_profit?: number; net_margin_pct?: number;
  logimargin_score?: number; verdict?: string; action?: string;
  pickup_date?: string; delivery_date?: string; broker_name?: string; broker_rating?: string;
};

export type LocalVehicleVitalsRow = {
  id: string;
  current_odometer: number;
  engine_hours: number;
  last_oil_change_mi: number;
  last_tire_rotate_mi: number;
  last_injector_svc_mi: number;
  last_def_fluid_mi: number;
  baseline_cpm: number;
  recorded_at: string;
};

export type LocalDetentionRecord = {
  id: string;
  facility_name: string | null;
  broker_name: string | null;
  facility_address: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  entry_time: string | null;
  exit_time: string | null;
  detention_minutes: number | null;
  billable_minutes: number | null;
  billable_amount: number | null;
  rate_per_hour: number | null;
};

const TRIPS_KEY = 'logimargin:offline:trips';
const INVOICES_KEY = 'logimargin:offline:invoices';
const VITALS_KEY = 'logimargin:offline:vehicle-vitals';
const DETENTION_KEY = 'logimargin:offline:detention-records';

function readList<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T[] : [];
  } catch {
    window.localStorage.removeItem(key);
    return [];
  }
}

function writeList<T>(key: string, rows: T[]) {
  window.localStorage.setItem(key, JSON.stringify(rows));
}

function createId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getLocalTrips(): TripRow[] {
  return readList<TripRow>(TRIPS_KEY);
}

export function insertLocalTrip(trip: LocalTripInput): TripRow {
  const row: TripRow = {
    id: createId('trip'),
    origin: trip.origin,
    destination: trip.destination,
    grossPay: trip.gross_pay,
    netProfit: trip.net_profit ?? null,
    logimarginScore: trip.logimargin_score ?? null,
    verdict: (trip.verdict as Verdict | undefined) ?? null,
    action: trip.action ?? null,
    status: 'booked',
    pickupDate: trip.pickup_date ?? null,
    brokerName: trip.broker_name ?? null,
  };
  writeList(TRIPS_KEY, [row, ...getLocalTrips()].slice(0, 50));
  return row;
}

export function getLocalInvoices(): InvoiceRow[] {
  return readList<InvoiceRow>(INVOICES_KEY);
}

export function getLocalVehicleVitals(): LocalVehicleVitalsRow[] {
  return readList<LocalVehicleVitalsRow>(VITALS_KEY);
}

export function insertLocalVehicleVitals(row: Omit<LocalVehicleVitalsRow, 'id' | 'recorded_at'>) {
  const saved: LocalVehicleVitalsRow = { id: createId('vitals'), recorded_at: new Date().toISOString(), ...row };
  writeList(VITALS_KEY, [saved, ...getLocalVehicleVitals()].slice(0, 20));
  return saved;
}

export function getLocalDetentionRecords(): LocalDetentionRecord[] {
  return readList<LocalDetentionRecord>(DETENTION_KEY);
}

export function insertLocalDetentionRecord(row: Omit<LocalDetentionRecord, 'id' | 'created_at'>) {
  const saved: LocalDetentionRecord = { id: createId('detention'), created_at: new Date().toISOString(), ...row };
  writeList(DETENTION_KEY, [saved, ...getLocalDetentionRecords()].slice(0, 20));
  return saved;
}

function normalizeMarginPct(value: number) {
  return Math.abs(value) <= 1 ? value * 100 : value;
}

export function getLocalBrokerScores(): BrokerScore[] {
  const brokers = new Map<string, { loads: number; gross: number; margin: number; last: string | null }>();
  for (const trip of getLocalTrips()) {
    const name = trip.brokerName?.trim();
    if (!name) continue;
    const existing = brokers.get(name) ?? { loads: 0, gross: 0, margin: 0, last: null };
    brokers.set(name, {
      loads: existing.loads + 1,
      gross: existing.gross + trip.grossPay,
      margin: existing.margin + (trip.netProfit != null && trip.grossPay > 0 ? trip.netProfit / trip.grossPay : 0),
      last: trip.pickupDate ?? existing.last,
    });
  }

  return Array.from(brokers.entries()).map(([brokerName, value]) => {
    const avgMarginPct = value.loads > 0 ? normalizeMarginPct(value.margin / value.loads) : 0;
    const marginScore = Math.min(40, (avgMarginPct / 25) * 40);
    const score = Math.round(marginScore + 20 + 20);
    const grade: BrokerScore['grade'] = score >= 75 ? 'A' : score >= 55 ? 'B' : score >= 35 ? 'C' : 'D';
    return {
      brokerName,
      totalLoads: value.loads,
      avgGrossPay: value.loads > 0 ? value.gross / value.loads : 0,
      avgMarginPct,
      avgPaymentDays: null,
      disputeCount: 0,
      invoiceCount: 0,
      lastLoadAt: value.last,
      grade,
      gradeColor: grade === 'A' ? 'profit' : grade === 'B' ? 'primary' : grade === 'C' ? 'warning' : 'danger',
      recommendation: grade === 'A' ? 'Offline kayıtlara göre güvenilir.' : 'Daha fazla kayıtla broker skorunu güçlendir.',
      score,
    };
  }).sort((a, b) => b.totalLoads - a.totalLoads);
}
