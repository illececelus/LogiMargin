import { z } from 'zod';
import type {
  DetentionResult,
  FinancialReport,
  MaintenanceAlert,
  VehicleVitals,
  Verdict,
} from '@/types';

const DIESEL_PRICE_PER_GALLON = 3.5;
const MPG = 6.5;
const MAINTENANCE_CPM = 0.15;
const FIXED_TRIP_EXPENSE = 200;
const DEFAULT_FACTORING_RATE = 0.03;
const IFTA_TAX_PER_GALLON = 0.20;
const ESTIMATED_TEXAS_MILE_SHARE = 0.6;
const FREE_DETENTION_MINUTES = 120;

const nullableNumber = z.preprocess(
  value => (value === '' || value === undefined ? null : value),
  z.coerce.number().nullable()
);

export const AiParsedDocSchema = z.object({
  docType: z.enum(['ratecon', 'bol', 'fuel_receipt', 'other']).default('other'),
  brokerName: z.string().nullable().default(null),
  mcNumber: z.string().nullable().default(null),
  loadNumber: z.string().nullable().default(null),
  grossPay: nullableNumber.default(null),
  loadedMiles: nullableNumber.default(null),
  deadheadMiles: nullableNumber.default(null),
  origin: z.string().nullable().default(null),
  destination: z.string().nullable().default(null),
  equipmentType: z.enum(['dry_van', 'flatbed', 'reefer', 'step_deck', 'lowboy', 'tanker', 'car_hauler', 'other']).default('other'),
  pickupDate: z.string().nullable().default(null),
  deliveryDate: z.string().nullable().default(null),
  fuelSurcharge: nullableNumber.default(null),
  detentionRate: nullableNumber.default(null),
  paymentTerms: z.string().nullable().default(null),
  lineItems: z.array(z.object({
    description: z.string().default('Line item'),
    amount: z.coerce.number().default(0),
  })).default([]),
  hasSignature: z.boolean().default(false),
  hasSeal: z.boolean().default(false),
  warnings: z.array(z.string()).default([]),
  confidence: z.coerce.number().min(0).max(1).default(0.3),
  notes: z.string().nullable().default(null),
});

export type AiParsedDoc = z.infer<typeof AiParsedDocSchema>;

export interface RealProfitInput {
  grossPay: number;
  loadedMiles: number;
  deadheadMiles?: number | null;
  fuelCost?: number | null;
  maintCost?: number | null;
  factoringRate?: number | null;
  currentDieselPrice?: number | null;
}

export interface RealProfitResult {
  totalMiles: number;
  estimatedFuelCost: number;
  estimatedMaintCost: number;
  estimatedFactoringCost: number;
  estimatedIftaTax: number;
  totalEstimatedCost: number;
  realProfit: number;
  realMarginPct: number;
  rpmGross: number;
  rpmNet: number;
  verdict: Verdict;
  aiAction: string;
}

export type BrokerDbRow = {
  id?: string;
  name?: string | null;
  broker_name?: string | null;
  grade?: string | null;
  rating?: string | null;
  risk_score?: number | null;
  score?: number | null;
  is_blacklisted?: boolean | null;
  blacklist_reason?: string | null;
  avg_payment_days?: number | null;
  avg_days_to_pay?: number | null;
  days_to_pay_avg?: number | null;
  dispute_rate?: number | null;
  dispute_count?: number | null;
};

export interface BrokerRiskResult {
  brokerName: string;
  grade: string | null;
  score: number;
  isHighRisk: boolean;
  riskReason: string | null;
  recommendedSurcharge: number;
  avgPaymentDays: number | null;
  disputeRate: number;
}

export interface EnrichedDraft extends AiParsedDoc {
  realProfit: number | null;
  realMarginPct: number | null;
  estimatedFuelCost: number | null;
  estimatedMaintCost: number | null;
  rpmGross: number | null;
  rpmNet: number | null;
  brokerRisk: BrokerRiskResult | null;
  verdict: Verdict | null;
  aiAction: string | null;
}

export const loadSchema = z.object({
  id: z.string().optional(),
  origin: z.string(),
  destination: z.string(),
  rate: z.coerce.number(),
  miles: z.coerce.number(),
  broker: z.string(),
  status: z.string().default('draft'),
});

export function calcRealProfit(input: RealProfitInput): RealProfitResult {
  const grossPay = safeNumber(input.grossPay);
  const loadedMiles = safeNumber(input.loadedMiles);
  const deadheadMiles = safeNumber(input.deadheadMiles);
  const totalMiles = Math.max(loadedMiles + deadheadMiles, 1);
  const dieselPrice = positiveOrDefault(input.currentDieselPrice, DIESEL_PRICE_PER_GALLON);
  const factoringRate = input.factoringRate ?? DEFAULT_FACTORING_RATE;

  const estimatedFuelCost = input.fuelCost ?? (totalMiles / MPG) * dieselPrice;
  const estimatedMaintCost = input.maintCost ?? totalMiles * MAINTENANCE_CPM;
  const estimatedFactoringCost = grossPay * factoringRate;
  const estimatedIftaTax = (loadedMiles / MPG) * IFTA_TAX_PER_GALLON * ESTIMATED_TEXAS_MILE_SHARE;
  const totalEstimatedCost = estimatedFuelCost + estimatedMaintCost + estimatedFactoringCost + estimatedIftaTax + FIXED_TRIP_EXPENSE;
  const realProfit = grossPay - totalEstimatedCost;
  const realMarginPct = grossPay > 0 ? (realProfit / grossPay) * 100 : 0;
  const rpmGross = grossPay / totalMiles;
  const rpmNet = realProfit / totalMiles;
  const verdict = verdictFor(realMarginPct, rpmNet);

  return {
    totalMiles,
    estimatedFuelCost: roundCurrency(estimatedFuelCost),
    estimatedMaintCost: roundCurrency(estimatedMaintCost),
    estimatedFactoringCost: roundCurrency(estimatedFactoringCost),
    estimatedIftaTax: roundCurrency(estimatedIftaTax),
    totalEstimatedCost: roundCurrency(totalEstimatedCost),
    realProfit: roundCurrency(realProfit),
    realMarginPct: round(realMarginPct, 1),
    rpmGross: round(rpmGross, 2),
    rpmNet: round(rpmNet, 2),
    verdict,
    aiAction: actionFor(verdict),
  };
}

export function evaluateBrokerRisk(row: BrokerDbRow | null, brokerName: string): BrokerRiskResult {
  if (!row) {
    return {
      brokerName,
      grade: null,
      score: 50,
      isHighRisk: false,
      riskReason: null,
      recommendedSurcharge: 0,
      avgPaymentDays: null,
      disputeRate: 0,
    };
  }

  const score = clamp(Math.round(row.score ?? row.risk_score ?? gradeToScore(row.grade ?? row.rating)), 0, 100);
  const avgPaymentDays = row.avg_payment_days ?? row.avg_days_to_pay ?? row.days_to_pay_avg ?? null;
  const disputeRate = row.dispute_rate ?? ((row.dispute_count ?? 0) > 0 ? Math.min(1, (row.dispute_count ?? 0) / 10) : 0);
  const grade = row.grade ?? row.rating ?? scoreToGrade(score);
  const isFailingCreditGrade = grade?.toUpperCase() === 'F';
  const isSlowPay = avgPaymentDays !== null && avgPaymentDays > 45;
  const isHighDispute = disputeRate >= 0.15;
  const isHighRisk = Boolean(row.is_blacklisted) || isFailingCreditGrade || score < 45 || isSlowPay || isHighDispute;
  const riskReason = (isFailingCreditGrade ? 'Kötü kredi skoru' : null)
    ?? row.blacklist_reason
    ?? (score < 45 ? `Low broker score (${score}/100)` : null)
    ?? (isSlowPay ? `Slow payment history (${avgPaymentDays} days average)` : null)
    ?? (isHighDispute ? `High dispute rate (${Math.round(disputeRate * 100)}%)` : null);

  return {
    brokerName: row.broker_name ?? row.name ?? brokerName,
    grade,
    score,
    isHighRisk,
    riskReason,
    recommendedSurcharge: isHighRisk ? 5 : score < 65 ? 2 : 0,
    avgPaymentDays,
    disputeRate,
  };
}

export function analyzeTrip(input: {
  grossPay: number;
  loadedMiles: number;
  deadheadMiles?: number;
  fuelCost?: number;
  tollCost?: number;
  driverPay?: number;
  maintCost?: number;
  factoringRate?: number;
  currentDieselPrice?: number;
}): FinancialReport {
  const grossPay = safeNumber(input.grossPay);
  const loadedMiles = safeNumber(input.loadedMiles);
  const deadheadMiles = safeNumber(input.deadheadMiles);
  const totalMiles = Math.max(loadedMiles + deadheadMiles, 1);
  const fuelCost = safeNumber(input.fuelCost);
  const tollCost = safeNumber(input.tollCost);
  const driverPay = safeNumber(input.driverPay);
  const maintCost = safeNumber(input.maintCost);
  const factoringRate = input.factoringRate ?? DEFAULT_FACTORING_RATE;
  const factoringCost = grossPay * factoringRate;
  const totalCost = fuelCost + tollCost + driverPay + maintCost + factoringCost;
  const netProfit = grossPay - totalCost;
  const netMarginPct = grossPay > 0 ? netProfit / grossPay : 0;
  const rpmGross = grossPay / totalMiles;
  const rpmNet = netProfit / totalMiles;
  const cpm = totalCost / totalMiles;
  const deadheadPct = totalMiles > 0 ? deadheadMiles / totalMiles : 0;
  const verdict = verdictFor(netMarginPct * 100, rpmNet);
  const logimarginScore = scoreTrip({ netMarginPct, rpmNet, deadheadPct });
  const flags = buildTripFlags({ rpmGross, rpmNet, netMarginPct, deadheadPct });

  return {
    grossPay: roundCurrency(grossPay),
    loadedMiles,
    deadheadMiles,
    totalMiles,
    fuelCost: roundCurrency(fuelCost),
    tollCost: roundCurrency(tollCost),
    driverPay: roundCurrency(driverPay),
    maintCost: roundCurrency(maintCost),
    factoringCost: roundCurrency(factoringCost),
    totalCost: roundCurrency(totalCost),
    netProfit: roundCurrency(netProfit),
    netMarginPct: round(netMarginPct, 4),
    rpmGross: round(rpmGross, 2),
    rpmNet: round(rpmNet, 2),
    cpm: round(cpm, 2),
    deadheadPct: round(deadheadPct, 4),
    logimarginScore,
    verdict,
    action: actionFor(verdict),
    flags,
    ifta: {
      totalMiles,
      txMiles: Math.round(totalMiles * ESTIMATED_TEXAS_MILE_SHARE),
      estimatedFuelGallons: round(totalMiles / MPG, 1),
      estimatedTxTax: roundCurrency((totalMiles * ESTIMATED_TEXAS_MILE_SHARE / MPG) * IFTA_TAX_PER_GALLON),
    },
  };
}

export function calcDetention(input: {
  entryTimestamp: Date | string;
  exitTimestamp?: Date | string;
  facilityName?: string;
  detentionRatePerHour?: number;
}): DetentionResult {
  const entry = toDate(input.entryTimestamp);
  const exit = input.exitTimestamp ? toDate(input.exitTimestamp) : new Date();
  const detentionMinutes = Math.max(0, Math.floor((exit.getTime() - entry.getTime()) / 60_000));
  const billableMinutes = Math.max(0, detentionMinutes - FREE_DETENTION_MINUTES);
  const rate = positiveOrDefault(input.detentionRatePerHour, 50);
  const billableAmount = roundCurrency((billableMinutes / 60) * rate);
  const hasClaim = billableMinutes > 0;

  return {
    detentionMinutes,
    billableMinutes,
    billableAmount,
    claimData: hasClaim ? {
      facilityName: input.facilityName ?? 'Unknown facility',
      entryTime: formatDateTime(entry),
      exitTime: formatDateTime(exit),
      detentionHours: round(detentionMinutes / 60, 2),
      billableHours: round(billableMinutes / 60, 2),
      totalClaim: billableAmount,
      legalStatement: `Detention is requested for time beyond the ${FREE_DETENTION_MINUTES / 60}-hour free period at $${rate.toFixed(2)} per hour.`,
    } : null,
  };
}

export function detectMaintenanceAlerts(vitals: VehicleVitals, currentCpm: number): MaintenanceAlert[] {
  const alerts: MaintenanceAlert[] = [];
  const serviceRules = [
    { key: 'lastOilChangeMi', label: 'Oil change', interval: 15_000, cost: 350, type: 'oil_change' },
    { key: 'lastTireRotateMi', label: 'Tire rotation', interval: 25_000, cost: 200, type: 'tire_rotation' },
    { key: 'lastInjectorSvcMi', label: 'Injector service', interval: 100_000, cost: 1_200, type: 'injector_service' },
    { key: 'lastDefFluidMi', label: 'DEF service', interval: 10_000, cost: 80, type: 'def_service' },
  ] as const;

  for (const rule of serviceRules) {
    const lastMileage = vitals[rule.key] ?? vitals.currentOdometer;
    const milesSince = vitals.currentOdometer - lastMileage;
    const milesUntilDue = rule.interval - milesSince;
    if (milesUntilDue <= 0) {
      alerts.push({
        severity: 'critical',
        alertType: rule.type,
        message: `${rule.label} is overdue by ${Math.abs(milesUntilDue).toLocaleString()} miles.`,
        triggerMetric: `${milesSince.toLocaleString()} miles since last service`,
        estimatedCost: rule.cost,
        milesUntilDue: 0,
      });
    } else if (milesUntilDue <= rule.interval * 0.2) {
      alerts.push({
        severity: 'warning',
        alertType: rule.type,
        message: `${rule.label} is due soon.`,
        triggerMetric: `${milesUntilDue.toLocaleString()} miles remaining`,
        estimatedCost: rule.cost,
        milesUntilDue,
      });
    }
  }

  if (vitals.baselineCpm > 0) {
    const cpmIncreasePct = ((currentCpm - vitals.baselineCpm) / vitals.baselineCpm) * 100;
    if (cpmIncreasePct >= 20) {
      alerts.push({
        severity: 'critical',
        alertType: 'cpm_spike',
        message: 'Operating cost per mile has spiked above baseline.',
        triggerMetric: `${round(cpmIncreasePct, 1)}% CPM increase`,
        estimatedCost: Math.round((currentCpm - vitals.baselineCpm) * 1_000),
      });
    } else if (cpmIncreasePct >= 10) {
      alerts.push({
        severity: 'warning',
        alertType: 'cpm_spike',
        message: 'Operating cost per mile is trending above baseline.',
        triggerMetric: `${round(cpmIncreasePct, 1)}% CPM increase`,
      });
    }
  }

  if (alerts.length === 0) {
    alerts.push({
      severity: 'info',
      alertType: 'healthy',
      message: 'No immediate maintenance risks detected.',
      triggerMetric: `Odometer ${vitals.currentOdometer.toLocaleString()} mi`,
    });
  }

  return alerts;
}

function verdictFor(marginPct: number, rpmNet: number): Verdict {
  if (marginPct >= 20 && rpmNet >= 1.25) return 'green';
  if (marginPct >= 15 && rpmNet >= 0.9) return 'yellow';
  return 'red';
}

function actionFor(verdict: Verdict): string {
  if (verdict === 'green') return 'Book it - margin and RPM clear target thresholds.';
  if (verdict === 'yellow') return 'Negotiate before booking - margin is workable but thin.';
  return 'Reject or re-rate - projected economics are below minimum thresholds.';
}

function buildTripFlags(input: {
  rpmGross: number;
  rpmNet: number;
  netMarginPct: number;
  deadheadPct: number;
}) {
  const flags: FinancialReport['flags'] = [];
  if (input.rpmGross < 1.8) {
    flags.push({ type: 'red_flag', message: `Gross RPM is below minimum target ($${input.rpmGross.toFixed(2)}/mi).` });
  }
  if (input.rpmNet < 0.9) {
    flags.push({ type: 'red_flag', message: `Net RPM is too low after costs ($${input.rpmNet.toFixed(2)}/mi).` });
  }
  if (input.netMarginPct < 0.15) {
    flags.push({ type: 'warning', message: `Net margin is below 15% (${(input.netMarginPct * 100).toFixed(1)}%).` });
  }
  if (input.deadheadPct > 0.12) {
    flags.push({ type: 'warning', message: `Deadhead is high at ${(input.deadheadPct * 100).toFixed(1)}% of total miles.` });
  }
  return flags;
}

function scoreTrip(input: { netMarginPct: number; rpmNet: number; deadheadPct: number }) {
  const marginScore = clamp((input.netMarginPct / 0.25) * 45, 0, 45);
  const rpmScore = clamp((input.rpmNet / 1.5) * 35, 0, 35);
  const deadheadScore = clamp(20 - input.deadheadPct * 100, 0, 20);
  return Math.round(marginScore + rpmScore + deadheadScore);
}

function gradeToScore(grade?: string | null) {
  return ({ A: 90, B: 75, C: 60, D: 40, F: 20 } as Record<string, number>)[grade ?? ''] ?? 50;
}

function scoreToGrade(score: number) {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

function toDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

function formatDateTime(date: Date) {
  return date.toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' });
}

function positiveOrDefault(value: number | null | undefined, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

function safeNumber(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function roundCurrency(value: number) {
  return round(value, 2);
}

function round(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
