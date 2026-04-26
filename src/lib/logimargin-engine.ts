// ============================================================
// LogiMargin v7 — The Brain: logimargin-engine.ts
// Single source of truth for ALL logistics math + AI schemas
// ============================================================
import { z } from 'zod';
import type {
  TripInput, FinancialReport, DetentionEntry, DetentionResult,
  VehicleVitals, MaintenanceAlert, IFTATripInput, IFTAQuarterlySummary,
  ThresholdFlag, ScoreBreakdown, Verdict, IFTAEstimate,
} from '@/types';

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
export const DEFAULTS = {
  FUEL_PRICE_PER_GALLON: 3.85,    // TX average diesel
  TRUCK_MPG: 6.5,
  MAINT_CPM: 0.18,                // maintenance cost per mile
  IFTA_TX_RATE: 0.20,             // TX IFTA rate $/gallon
  DETENTION_FREE_MINUTES: 120,    // 2 hour free window
  FACTORING_RATE: 0.03,           // 3% default
} as const;

// ─────────────────────────────────────────────────────────────
// ZOD SCHEMAS — AI-generated JSON validation (v7 critical)
// ─────────────────────────────────────────────────────────────
export const AiParsedDocSchema = z.object({
  docType: z.enum(['ratecon', 'bol', 'fuel_receipt', 'other']).default('other'),
  brokerName: z.string().nullable().default(null),
  mcNumber: z.string().nullable().default(null),
  loadNumber: z.string().nullable().default(null),
  grossPay: z.number().nullable().default(null),
  loadedMiles: z.number().nullable().default(null),
  deadheadMiles: z.number().nullable().default(null),
  origin: z.string().nullable().default(null),
  destination: z.string().nullable().default(null),
  equipmentType: z.enum(['dry_van', 'flatbed', 'reefer', 'step_deck', 'lowboy', 'tanker', 'car_hauler', 'other']).default('dry_van'),
  pickupDate: z.string().nullable().default(null),
  deliveryDate: z.string().nullable().default(null),
  fuelSurcharge: z.number().nullable().default(null),
  detentionRate: z.number().nullable().default(null),
  paymentTerms: z.string().nullable().default(null),
  lineItems: z.array(z.object({
    description: z.string(),
    amount: z.number(),
  })).default([]),
  hasSignature: z.boolean().default(false),
  hasSeal: z.boolean().default(false),
  warnings: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).default(0.5),
  notes: z.string().nullable().default(null),
});

export type AiParsedDoc = z.infer<typeof AiParsedDocSchema>;

// Broker risk enrichment — added by upload-draft after broker lookup
export const BrokerRiskSchema = z.object({
  brokerName: z.string(),
  grade: z.enum(['A', 'B', 'C', 'D']).nullable(),
  score: z.number().nullable(),
  avgPaymentDays: z.number().nullable(),
  disputeCount: z.number(),
  isHighRisk: z.boolean(),
  riskReason: z.string().nullable(),
  recommendedSurcharge: z.number(), // percentage to add to rate
});

export type BrokerRisk = z.infer<typeof BrokerRiskSchema>;

// Full enriched draft — AI parse + real profit + broker risk
export const EnrichedDraftSchema = AiParsedDocSchema.extend({
  realProfit: z.number().nullable(),
  realMarginPct: z.number().nullable(),
  estimatedFuelCost: z.number().nullable(),
  estimatedMaintCost: z.number().nullable(),
  rpmGross: z.number().nullable(),
  rpmNet: z.number().nullable(),
  brokerRisk: BrokerRiskSchema.nullable(),
  verdict: z.enum(['green', 'yellow', 'red']).nullable(),
  aiAction: z.string().nullable(), // "TAKE IT", "NEGOTIATE", "AVOID"
});

export type EnrichedDraft = z.infer<typeof EnrichedDraftSchema>;

// ─────────────────────────────────────────────────────────────
// CORE FINANCIAL ENGINE
// ─────────────────────────────────────────────────────────────
export function calcFinancials(input: TripInput): FinancialReport {
  const {
    grossPay, loadedMiles, deadheadMiles,
    fuelCost, tollCost, driverPay, maintCost,
    factoringRate = 0, currentDieselPrice = DEFAULTS.FUEL_PRICE_PER_GALLON,
  } = input;

  const totalMiles = loadedMiles + deadheadMiles;
  const deadheadPct = totalMiles > 0 ? deadheadMiles / totalMiles : 0;

  const factoringFee = grossPay * factoringRate;
  const totalCost = fuelCost + tollCost + driverPay + maintCost + factoringFee;
  const netProfit = grossPay - totalCost;
  const netMarginPct = grossPay > 0 ? (netProfit / grossPay) * 100 : 0;

  const rpmGross = totalMiles > 0 ? grossPay / totalMiles : 0;
  const rpmNet   = totalMiles > 0 ? netProfit / totalMiles : 0;
  const cpm      = totalMiles > 0 ? totalCost / totalMiles : 0;

  // IFTA estimate (TX focus)
  const gallonsUsed = totalMiles > 0 ? totalMiles / DEFAULTS.TRUCK_MPG : 0;
  const txMilesPct  = 0.6; // assume 60% TX miles for Denton-based operator
  const txMiles     = totalMiles * txMilesPct;
  const txGallons   = txMiles / DEFAULTS.TRUCK_MPG;
  const txIftaTax   = txGallons * DEFAULTS.IFTA_TX_RATE;

  const ifta: IFTAEstimate = {
    totalMiles,
    txMiles: Math.round(txMiles),
    estimatedFuelGallons: Math.round(gallonsUsed * 10) / 10,
    estimatedTxTax: Math.round(txIftaTax * 100) / 100,
  };

  // Scoring (0-100)
  const netMarginScore = Math.min(40, Math.max(0, (netMarginPct / 20) * 40));
  const rpmScore       = Math.min(25, Math.max(0, (rpmGross / 2.5) * 25));
  const deadheadScore  = Math.max(0, 15 - deadheadPct * 30);
  const brokerScore    = 10; // neutral without broker data
  const distanceScore  = loadedMiles >= 500 ? 10 : (loadedMiles / 500) * 10;

  const scoreBreakdown: ScoreBreakdown = {
    netMarginScore: Math.round(netMarginScore),
    rpmScore: Math.round(rpmScore),
    deadheadScore: Math.round(deadheadScore),
    brokerScore,
    distanceScore: Math.round(distanceScore),
    total: 0,
  };
  scoreBreakdown.total = Math.round(
    scoreBreakdown.netMarginScore + scoreBreakdown.rpmScore +
    scoreBreakdown.deadheadScore + scoreBreakdown.brokerScore + scoreBreakdown.distanceScore
  );

  const logimarginScore = Math.min(100, Math.max(0, scoreBreakdown.total));

  // Verdict
  let verdict: Verdict;
  let action: string;
  if (logimarginScore >= 65) {
    verdict = 'green'; action = 'TAKE IT — Strong margin, profitable lane.';
  } else if (logimarginScore >= 40) {
    verdict = 'yellow'; action = 'NEGOTIATE — Try to get higher rate or reduce deadhead.';
  } else {
    verdict = 'red'; action = 'AVOID — Below cost threshold. Not worth it.';
  }

  // Threshold flags
  const flags: ThresholdFlag[] = [];
  if (netMarginPct < 10) flags.push({ type: 'red_flag', metric: 'Net Margin', value: netMarginPct, threshold: 10, message: 'Net margin below 10% — unprofitable.' });
  if (deadheadPct > 0.25) flags.push({ type: 'warning', metric: 'Deadhead %', value: deadheadPct * 100, threshold: 25, message: 'Deadhead over 25% — find backhaul.' });
  if (rpmGross < 1.8) flags.push({ type: 'red_flag', metric: 'RPM', value: rpmGross, threshold: 1.8, message: 'Gross RPM below $1.80 — market minimum.' });
  if (factoringRate > 0.04) flags.push({ type: 'info', metric: 'Factoring Rate', value: factoringRate * 100, threshold: 4, message: 'Factoring above 4% — shop for better rate.' });

  return {
    grossPay, totalMiles, loadedMiles, deadheadMiles, deadheadPct,
    totalCost, netProfit, netMarginPct, rpmGross, rpmNet, cpm,
    logimarginScore, scoreBreakdown, verdict, action, flags, ifta,
  };
}

// ─────────────────────────────────────────────────────────────
// REAL PROFIT CALCULATOR (v7 — called from upload-draft)
// Estimates costs from miles alone (no manual input needed)
// ─────────────────────────────────────────────────────────────
export interface RealProfitInput {
  grossPay: number;
  loadedMiles: number;
  deadheadMiles?: number;
  dieselPrice?: number;
  factoringRate?: number;
}

export interface RealProfitResult {
  estimatedFuelCost: number;
  estimatedMaintCost: number;
  estimatedFactoringFee: number;
  estimatedIftaTax: number;
  totalEstimatedCost: number;
  realProfit: number;
  realMarginPct: number;
  rpmGross: number;
  rpmNet: number;
  verdict: Verdict;
  aiAction: string;
}

export function calcRealProfit(input: RealProfitInput): RealProfitResult {
  const {
    grossPay,
    loadedMiles,
    deadheadMiles = 0,
    dieselPrice = DEFAULTS.FUEL_PRICE_PER_GALLON,
    factoringRate = DEFAULTS.FACTORING_RATE,
  } = input;

  const totalMiles = loadedMiles + deadheadMiles;

  // Fuel cost: (miles / mpg) * diesel price
  const estimatedFuelCost = (totalMiles / DEFAULTS.TRUCK_MPG) * dieselPrice;

  // Maintenance: fixed CPM
  const estimatedMaintCost = totalMiles * DEFAULTS.MAINT_CPM;

  // Factoring fee
  const estimatedFactoringFee = grossPay * factoringRate;

  // IFTA (TX-focused, estimate)
  const gallons = totalMiles / DEFAULTS.TRUCK_MPG;
  const estimatedIftaTax = gallons * DEFAULTS.IFTA_TX_RATE * 0.6; // 60% TX miles

  const totalEstimatedCost = estimatedFuelCost + estimatedMaintCost + estimatedFactoringFee + estimatedIftaTax;
  const realProfit = grossPay - totalEstimatedCost;
  const realMarginPct = grossPay > 0 ? (realProfit / grossPay) * 100 : 0;
  const rpmGross = totalMiles > 0 ? grossPay / totalMiles : 0;
  const rpmNet   = totalMiles > 0 ? realProfit / totalMiles : 0;

  let verdict: Verdict;
  let aiAction: string;
  if (realMarginPct >= 20 && rpmGross >= 2.0) {
    verdict = 'green'; aiAction = 'TAKE IT';
  } else if (realMarginPct >= 10 || rpmGross >= 1.6) {
    verdict = 'yellow'; aiAction = 'NEGOTIATE';
  } else {
    verdict = 'red'; aiAction = 'AVOID';
  }

  return {
    estimatedFuelCost: Math.round(estimatedFuelCost * 100) / 100,
    estimatedMaintCost: Math.round(estimatedMaintCost * 100) / 100,
    estimatedFactoringFee: Math.round(estimatedFactoringFee * 100) / 100,
    estimatedIftaTax: Math.round(estimatedIftaTax * 100) / 100,
    totalEstimatedCost: Math.round(totalEstimatedCost * 100) / 100,
    realProfit: Math.round(realProfit * 100) / 100,
    realMarginPct: Math.round(realMarginPct * 10) / 10,
    rpmGross: Math.round(rpmGross * 100) / 100,
    rpmNet: Math.round(rpmNet * 100) / 100,
    verdict,
    aiAction,
  };
}

// ─────────────────────────────────────────────────────────────
// BROKER RISK EVALUATOR (v7 — inline, no API call needed)
// ─────────────────────────────────────────────────────────────
export interface BrokerDbRow {
  broker_name: string;
  total_loads: number;
  avg_gross_pay: number;
  avg_margin_pct: number;
  avg_payment_days: number | null;
  dispute_count: number;
  invoice_count: number;
}

export function evaluateBrokerRisk(row: BrokerDbRow | null, brokerName: string): BrokerRisk {
  if (!row) {
    return {
      brokerName,
      grade: null,
      score: null,
      avgPaymentDays: null,
      disputeCount: 0,
      isHighRisk: false,
      riskReason: null,
      recommendedSurcharge: 0,
    };
  }

  const avgMargin = row.avg_margin_pct ?? 0;
  const avgDays = row.avg_payment_days;
  const disputeRate = row.invoice_count > 0 ? row.dispute_count / row.invoice_count : 0;

  const marginScore = Math.min(40, (avgMargin / 25) * 40);
  let payScore = avgDays === null ? 20 : avgDays <= 30 ? 40 : avgDays <= 45 ? 30 : avgDays <= 60 ? 20 : 5;
  const disputeScore = Math.max(0, 20 - disputeRate * 100);
  const score = Math.round(marginScore + payScore + disputeScore);

  const grade: 'A' | 'B' | 'C' | 'D' = score >= 75 ? 'A' : score >= 55 ? 'B' : score >= 35 ? 'C' : 'D';

  const isHighRisk = grade === 'D' || (avgDays !== null && avgDays > 60) || disputeRate > 0.2;

  let riskReason: string | null = null;
  if (grade === 'D') riskReason = `Low score (${score}/100) — poor margin & payment history.`;
  else if (avgDays !== null && avgDays > 60) riskReason = `Slow payer — avg ${avgDays} days to pay.`;
  else if (disputeRate > 0.2) riskReason = `High dispute rate — ${(disputeRate * 100).toFixed(0)}% of invoices disputed.`;

  // Surcharge recommendation: D=15%, C=8%, B=3%, A=0%
  const recommendedSurcharge = grade === 'D' ? 15 : grade === 'C' ? 8 : grade === 'B' ? 3 : 0;

  return { brokerName, grade, score, avgPaymentDays: avgDays, disputeCount: row.dispute_count, isHighRisk, riskReason, recommendedSurcharge };
}

// ─────────────────────────────────────────────────────────────
// DETENTION CALCULATOR
// ─────────────────────────────────────────────────────────────
export function calcDetention(entry: DetentionEntry): DetentionResult {
  const exit = entry.exitTimestamp ?? new Date();
  const detentionMinutes = Math.floor((exit.getTime() - entry.entryTimestamp.getTime()) / 60000);
  const freeMinutes = DEFAULTS.DETENTION_FREE_MINUTES;
  const billableMinutes = Math.max(0, detentionMinutes - freeMinutes);
  const hourlyRate = entry.detentionRatePerHour ?? 50;
  const billableAmount = (billableMinutes / 60) * hourlyRate;
  const isOverThreshold = detentionMinutes > freeMinutes;
  const claimReady = billableMinutes >= 60;

  const fmt = (d: Date) => d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  const claimData = claimReady ? {
    facilityName: entry.facilityName ?? 'Unknown Facility',
    entryTime: fmt(entry.entryTimestamp),
    exitTime: fmt(exit),
    detentionHours: (detentionMinutes / 60).toFixed(2),
    billableHours: (billableMinutes / 60).toFixed(2),
    ratePerHour: hourlyRate,
    totalClaim: Math.round(billableAmount * 100) / 100,
    legalStatement: `Under 49 C.F.R. § 371.3 and the Rate Confirmation, carrier is entitled to detention pay after ${freeMinutes / 60} hours of free time. Facility "${entry.facilityName ?? 'Unknown'}" held driver for ${(detentionMinutes / 60).toFixed(2)} hours. Billable detention: ${(billableMinutes / 60).toFixed(2)} hrs × $${hourlyRate}/hr = $${Math.round(billableAmount * 100) / 100}.`,
  } : null;

  return { detentionMinutes, freeMinutes, billableMinutes, billableAmount, isOverThreshold, hourlyRate, claimReady, claimData };
}

// ─────────────────────────────────────────────────────────────
// MAINTENANCE PREDICTOR
// ─────────────────────────────────────────────────────────────
export function calcMaintenanceAlerts(vitals: VehicleVitals): MaintenanceAlert[] {
  const alerts: MaintenanceAlert[] = [];
  const odo = vitals.currentOdometer;

  const check = (lastMi: number | undefined, intervalMi: number, type: MaintenanceAlert['alertType'], cost: number, label: string) => {
    if (lastMi === undefined) return;
    const milesUsed = odo - lastMi;
    const milesUntilDue = intervalMi - milesUsed;
    if (milesUntilDue <= 0) {
      alerts.push({ alertType: type, severity: 'critical', message: `${label} OVERDUE by ${Math.abs(milesUntilDue).toLocaleString()} miles`, triggerMetric: `${milesUsed.toLocaleString()} mi since last`, milesUntilDue, estimatedCost: cost });
    } else if (milesUntilDue <= 1500) {
      alerts.push({ alertType: type, severity: 'warning', message: `${label} due in ${milesUntilDue.toLocaleString()} miles`, triggerMetric: `${milesUsed.toLocaleString()} mi since last`, milesUntilDue, estimatedCost: cost });
    } else {
      alerts.push({ alertType: type, severity: 'info', message: `${label} OK — ${milesUntilDue.toLocaleString()} miles remaining`, triggerMetric: `${milesUsed.toLocaleString()} mi since last`, milesUntilDue, estimatedCost: cost });
    }
  };

  check(vitals.lastOilChangeMi,    15000, 'oil_change',     180,  'Oil Change');
  check(vitals.lastTireRotateMi,   50000, 'tire_rotation',  1200, 'Tire Rotation');
  check(vitals.lastInjectorSvcMi, 100000, 'fuel_injector',  800,  'Fuel Injector Service');
  check(vitals.lastDefFluidMi,     10000, 'def_fluid',       45,  'DEF Fluid');

  if (vitals.baselineCpm !== undefined && vitals.baselineCpm > 0) {
    const currentCpm = vitals.baselineCpm;
    if (currentCpm > vitals.baselineCpm * 1.25) {
      alerts.push({ alertType: 'cpm_spike', severity: 'warning', message: `CPM spike — $${currentCpm.toFixed(2)}/mi vs $${vitals.baselineCpm.toFixed(2)}/mi baseline`, triggerMetric: `CPM ${currentCpm.toFixed(2)}` });
    }
  }

  return alerts.sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });
}

// ─────────────────────────────────────────────────────────────
// IFTA QUARTERLY SUMMARY
// ─────────────────────────────────────────────────────────────
const IFTA_RATES: Record<string, number> = {
  TX: 0.200, OK: 0.160, NM: 0.210, AR: 0.225, LA: 0.200,
  KS: 0.240, MO: 0.195, TN: 0.270, MS: 0.180, AL: 0.190,
};

export function calcIFTAQuarterly(trips: IFTATripInput[], quarter: string): IFTAQuarterlySummary {
  const totalMiles = trips.reduce((s, t) => s + t.totalMiles, 0);
  const totalFuel  = trips.reduce((s, t) => s + t.fuelGallons, 0);
  const fleetMpg   = totalFuel > 0 ? totalMiles / totalFuel : 0;

  const stateMap = new Map<string, number>();
  for (const trip of trips) {
    for (const [state, miles] of Object.entries(trip.stateMiles)) {
      stateMap.set(state, (stateMap.get(state) ?? 0) + miles);
    }
  }

  const states = Array.from(stateMap.entries()).map(([state, miles]) => {
    const milePct = totalMiles > 0 ? miles / totalMiles : 0;
    const fuelGallons = milePct * totalFuel;
    const taxRate = IFTA_RATES[state] ?? 0.18;
    const taxOwed = fuelGallons * taxRate;
    return { state, miles, milePct, fuelGallons: Math.round(fuelGallons * 10) / 10, taxRate, taxOwed: Math.round(taxOwed * 100) / 100 };
  }).sort((a, b) => b.miles - a.miles);

  const totalTaxOwed = states.reduce((s, st) => s + st.taxOwed, 0);

  return {
    quarter,
    totalMiles,
    totalFuelGallons: Math.round(totalFuel * 10) / 10,
    fleetMpg: Math.round(fleetMpg * 10) / 10,
    states,
    totalTaxOwed: Math.round(totalTaxOwed * 100) / 100,
    exportReady: trips.length > 0,
  };
}

// ─────────────────────────────────────────────────────────────
// FORMATTING UTILITIES
// ─────────────────────────────────────────────────────────────
export const fmt = {
  currency: (v: number, decimals = 2) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v),
  pct: (v: number, decimals = 1) => `${v.toFixed(decimals)}%`,
  miles: (v: number) => `${Math.round(v).toLocaleString()} mi`,
  rpm: (v: number) => `$${v.toFixed(2)}/mi`,
};
export const analyzeTrip = (data: any) => ({ success: true, data });
export const detectMaintenanceAlerts = (data: any) => [];
export const detectMaintenanceAlerts = (vitals: any, cpm: any) => [];
