import { z } from 'zod';
import type { DetentionResult, MaintenanceAlert, VehicleVitals } from '@/types';

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
  equipmentType: z.string().nullable().default(null),
  pickupDate: z.string().nullable().default(null),
  deliveryDate: z.string().nullable().default(null),
  fuelSurcharge: z.number().nullable().default(null),
  detentionRate: z.number().nullable().default(null),
  paymentTerms: z.string().nullable().default(null),
  lineItems: z.array(z.object({ description: z.string(), amount: z.number() })).default([]),
  hasSignature: z.boolean().default(false),
  hasSeal: z.boolean().default(false),
  warnings: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).default(0.5),
  notes: z.string().nullable().default(null),
});

export const loadSchema = z.object({
  id: z.string().optional(),
  origin: z.string(),
  destination: z.string(),
  rate: z.number(),
  miles: z.number(),
  broker: z.string(),
  status: z.string().default('draft'),
});

export type AiParsedDoc = z.infer<typeof AiParsedDocSchema>;

export interface RealProfitInput {
  grossPay: number;
  loadedMiles: number;
  deadheadMiles?: number;
}

export interface RealProfitResult {
  realProfit: number;
  realMarginPct: number;
  estimatedFuelCost: number;
  estimatedMaintCost: number;
  rpmGross: number;
  rpmNet: number;
  verdict: 'green' | 'yellow' | 'red';
  aiAction: string;
}

export type BrokerDbRow = {
  broker_name?: string | null;
  grade?: string | null;
  avg_payment_days?: number | string | null;
  dispute_count?: number | null;
  invoice_count?: number | null;
};

export interface BrokerRisk {
  brokerName: string;
  grade: string | null;
  avgPaymentDays: number | null;
  isHighRisk: boolean;
  riskReason: string | null;
  recommendedSurcharge: number;
}

export type EnrichedDraft = AiParsedDoc & Partial<RealProfitResult> & {
  brokerRisk?: BrokerRisk | null;
};

export function calcRealProfit(input: RealProfitInput): RealProfitResult {
  const loadedMiles = Math.max(input.loadedMiles, 1);
  const totalMiles = loadedMiles + Math.max(input.deadheadMiles ?? 0, 0);
  const estimatedFuelCost = (totalMiles / 6.5) * 3.9;
  const estimatedMaintCost = totalMiles * 0.18;
  const factoringCost = input.grossPay * 0.03;
  const realProfit = input.grossPay - estimatedFuelCost - estimatedMaintCost - factoringCost;
  const realMarginPct = input.grossPay > 0 ? (realProfit / input.grossPay) * 100 : 0;
  const rpmGross = input.grossPay / loadedMiles;
  const rpmNet = realProfit / totalMiles;
  const verdict = realMarginPct >= 18 ? 'green' : realMarginPct >= 10 ? 'yellow' : 'red';

  return {
    realProfit,
    realMarginPct,
    estimatedFuelCost,
    estimatedMaintCost,
    rpmGross,
    rpmNet,
    verdict,
    aiAction: verdict === 'green' ? 'Book It' : verdict === 'yellow' ? 'Negotiate' : 'Reject',
  };
}

export function evaluateBrokerRisk(row: BrokerDbRow | null, brokerName: string): BrokerRisk {
  const avgPaymentDays = row?.avg_payment_days == null ? null : Number(row.avg_payment_days);
  const grade = row?.grade ?? null;
  const disputeCount = row?.dispute_count ?? 0;
  const isHighRisk = grade === 'D' || (avgPaymentDays ?? 0) > 60 || disputeCount > 0;
  const reasons = [
    grade === 'D' ? 'low broker grade' : null,
    (avgPaymentDays ?? 0) > 60 ? `slow payment average (${avgPaymentDays} days)` : null,
    disputeCount > 0 ? `${disputeCount} invoice dispute(s)` : null,
  ].filter(Boolean);

  return {
    brokerName,
    grade,
    avgPaymentDays,
    isHighRisk,
    riskReason: reasons.length > 0 ? reasons.join(', ') : null,
    recommendedSurcharge: isHighRisk ? 5 : 0,
  };
}

export function calcDetention({
  entryTimestamp,
  exitTimestamp = new Date(),
  facilityName,
  detentionRatePerHour,
}: {
  entryTimestamp: Date;
  exitTimestamp?: Date;
  facilityName?: string;
  detentionRatePerHour: number;
}): DetentionResult {
  const detentionMinutes = Math.max(0, Math.floor((exitTimestamp.getTime() - entryTimestamp.getTime()) / 60_000));
  const billableMinutes = Math.max(0, detentionMinutes - 120);
  const billableAmount = (billableMinutes / 60) * detentionRatePerHour;

  return {
    detentionMinutes,
    billableMinutes,
    billableAmount,
    claimData: {
      facilityName: facilityName ?? 'Belirtilmedi',
      entryTime: entryTimestamp.toLocaleString('tr-TR'),
      exitTime: exitTimestamp.toLocaleString('tr-TR'),
      detentionHours: Number((detentionMinutes / 60).toFixed(2)),
      billableHours: Number((billableMinutes / 60).toFixed(2)),
      totalClaim: billableAmount,
      legalStatement: 'FMCSA guidance supports detention billing after the agreed free-time window.',
    },
  };
}

export const analyzeTrip = (data: unknown) => ({ success: true, data });

export function detectMaintenanceAlerts(vitals: VehicleVitals, currentCpm: number): MaintenanceAlert[] {
  const alerts: MaintenanceAlert[] = [];
  const checks = [
    { type: 'oil_change', label: 'Yağ değişimi', delta: vitals.currentOdometer - vitals.lastOilChangeMi, interval: 15_000, cost: 350 },
    { type: 'tire_rotation', label: 'Lastik rotasyonu', delta: vitals.currentOdometer - vitals.lastTireRotateMi, interval: 25_000, cost: 200 },
    { type: 'injector_service', label: 'Enjektör servisi', delta: vitals.currentOdometer - vitals.lastInjectorSvcMi, interval: 100_000, cost: 1200 },
    { type: 'def_fluid', label: 'DEF dolum', delta: vitals.currentOdometer - vitals.lastDefFluidMi, interval: 10_000, cost: 80 },
  ];

  for (const check of checks) {
    const milesUntilDue = check.interval - check.delta;
    if (milesUntilDue <= 0 || milesUntilDue <= check.interval * 0.2) {
      alerts.push({
        alertType: check.type,
        severity: milesUntilDue <= 0 ? 'critical' : 'warning',
        message: milesUntilDue <= 0
          ? `${check.label} gecikti. Servis planla.`
          : `${check.label} yaklaşıyor. Önceden planla.`,
        triggerMetric: `${check.delta.toLocaleString()} / ${check.interval.toLocaleString()} mi`,
        estimatedCost: check.cost,
        milesUntilDue,
      });
    }
  }

  if (currentCpm > vitals.baselineCpm * 1.15) {
    alerts.push({
      alertType: 'cpm_spike',
      severity: 'warning',
      message: 'Güncel CPM baz değerin %15 üzerinde.',
      triggerMetric: `$${currentCpm.toFixed(2)} vs $${vitals.baselineCpm.toFixed(2)} baseline`,
    });
  }

  return alerts;
}
