// ============================================================
// LogiMargin Analysis Engine v3
// Core · Broker Risk · Predictive Maintenance ·
// Detention Timer · IFTA Smart Logger · Market Pulse
// ============================================================
import type {
  TripInput, FinancialReport, ThresholdFlag, ScoreBreakdown, IFTAEstimate, Verdict,
  BrokerProfile, BrokerRiskAssessment, BrokerRiskLevel,
  VehicleVitals, MaintenanceAlert, MaintenanceAlertType,
  DetentionEntry, DetentionResult, DetentionClaimData,
  IFTATripInput, IFTAQuarterlySummary, IFTAStateBreakdown,
  MarketRateData, MarketComparison,
} from '@/types';

// ── Constants ─────────────────────────────────────────────────
export const THRESHOLDS = {
  MIN_MARGIN:              0.15,
  WARN_MARGIN:             0.20,
  MAX_DEADHEAD:            0.12,
  WARN_DEADHEAD:           0.08,
  MIN_RPM_NET:             1.25,
  TX_DIESEL_AVG:           3.89,
  TRUCK_MPG:               6.5,
  TX_IFTA_RATE:            0.20,
  DETENTION_FREE_HOURS:    2,
  DETENTION_DEFAULT_RATE:  50,
  CPM_SPIKE_THRESHOLD:     0.15,
} as const;

export const MARKET_RPM: Record<string, number> = {
  dry_van: 2.45, flatbed: 2.85, reefer: 2.95,
  step_deck: 3.10, lowboy: 3.50, tanker: 3.20, car_hauler: 2.75,
};

const SERVICE_INTERVALS = {
  oil_change:    15_000,
  tire_rotation: 25_000,
  fuel_injector: 100_000,
  def_fluid:     10_000,
} as const;

const IFTA_RATES: Record<string, number> = {
  TX: 0.20, NM: 0.21, OK: 0.19, LA: 0.20,
  AR: 0.225, CO: 0.205, KS: 0.240, MO: 0.17,
};

// ── Core Metrics ──────────────────────────────────────────────
export interface CoreMetrics {
  rpmGross: number; rpmNet: number; cpm: number;
  totalCost: number; netProfit: number; netMarginPct: number; factoringFee: number;
}

export function computeMetrics(input: TripInput): CoreMetrics {
  if (input.loadedMiles <= 0) throw new Error('loadedMiles must be > 0');
  const factoringFee = input.factoringRate ? input.grossPay * input.factoringRate : 0;
  const totalCost = input.fuelCost + input.tollCost + input.driverPay + input.maintCost + factoringFee;
  const netProfit = input.grossPay - totalCost;
  return {
    rpmGross: input.grossPay / input.loadedMiles,
    rpmNet: netProfit / input.loadedMiles,
    cpm: totalCost / input.loadedMiles,
    totalCost, netProfit,
    netMarginPct: input.grossPay > 0 ? netProfit / input.grossPay : 0,
    factoringFee,
  };
}

export function checkThresholds(input: TripInput, m: CoreMetrics): ThresholdFlag[] {
  const flags: ThresholdFlag[] = [];
  const total = input.loadedMiles + input.deadheadMiles;
  const deadheadPct = total > 0 ? input.deadheadMiles / total : 0;

  if (m.netMarginPct < THRESHOLDS.MIN_MARGIN)
    flags.push({ type: 'red_flag', metric: 'net_margin', value: m.netMarginPct, threshold: THRESHOLDS.MIN_MARGIN, message: `Net margin ${pct(m.netMarginPct)} is below the 15% minimum. This load loses money.` });
  else if (m.netMarginPct < THRESHOLDS.WARN_MARGIN)
    flags.push({ type: 'warning', metric: 'net_margin', value: m.netMarginPct, threshold: THRESHOLDS.WARN_MARGIN, message: `Net margin ${pct(m.netMarginPct)} is thin. Negotiate the rate.` });

  if (deadheadPct > THRESHOLDS.MAX_DEADHEAD)
    flags.push({ type: 'red_flag', metric: 'deadhead_pct', value: deadheadPct, threshold: THRESHOLDS.MAX_DEADHEAD, message: `Deadhead ${pct(deadheadPct)} exceeds 12% limit. Find a backhaul or reject.` });
  else if (deadheadPct > THRESHOLDS.WARN_DEADHEAD)
    flags.push({ type: 'warning', metric: 'deadhead_pct', value: deadheadPct, threshold: THRESHOLDS.WARN_DEADHEAD, message: `Deadhead at ${pct(deadheadPct)}. Look for a partial backhaul.` });

  if (m.rpmNet < THRESHOLDS.MIN_RPM_NET)
    flags.push({ type: 'warning', metric: 'rpm_net', value: m.rpmNet, threshold: THRESHOLDS.MIN_RPM_NET, message: `Net RPM $${m.rpmNet.toFixed(2)} is below the $1.25 floor.` });

  const diesel = input.currentDieselPrice ?? THRESHOLDS.TX_DIESEL_AVG;
  const expectedFuel = (input.loadedMiles / THRESHOLDS.TRUCK_MPG) * diesel;
  if (input.fuelCost < expectedFuel * 0.5)
    flags.push({ type: 'warning', metric: 'fuel_cost_low', value: input.fuelCost, threshold: expectedFuel, message: `Fuel $${input.fuelCost.toFixed(0)} looks too low for ${input.loadedMiles} mi. Double-check.` });

  return flags;
}

export function computeScore(input: TripInput, m: CoreMetrics, equipmentType = 'dry_van', brokerRating?: string): ScoreBreakdown {
  const total = input.loadedMiles + input.deadheadMiles;
  const deadheadPct = total > 0 ? input.deadheadMiles / total : 0;
  const marketRPM = MARKET_RPM[equipmentType] ?? MARKET_RPM.dry_van;
  const mar = m.netMarginPct;

  const netMarginScore = mar >= 0.30 ? 35 : mar >= 0.25 ? 30 : mar >= 0.20 ? 24 : mar >= 0.15 ? 16 : mar >= 0.10 ? 8 : Math.max(0, Math.round(mar * 50));
  const ratio = m.rpmGross / marketRPM;
  const rpmScore = ratio >= 1.20 ? 25 : ratio >= 1.10 ? 21 : ratio >= 1.00 ? 17 : ratio >= 0.90 ? 11 : ratio >= 0.80 ? 5 : 0;
  const deadheadScore = deadheadPct <= 0.03 ? 20 : deadheadPct <= 0.06 ? 16 : deadheadPct <= 0.08 ? 12 : deadheadPct <= 0.10 ? 7 : deadheadPct <= 0.12 ? 3 : 0;
  const brokerMap: Record<string, number> = { A: 10, B: 8, C: 5, D: 2, F: 0 };
  const brokerScore = brokerRating ? (brokerMap[brokerRating] ?? 5) : 5;
  const distanceScore = input.loadedMiles >= 700 ? 10 : input.loadedMiles >= 500 ? 8 : input.loadedMiles >= 300 ? 6 : input.loadedMiles >= 150 ? 4 : 2;

  return {
    netMarginScore, rpmScore, deadheadScore, brokerScore, distanceScore,
    total: Math.min(100, Math.max(0, netMarginScore + rpmScore + deadheadScore + brokerScore + distanceScore)),
  };
}

export function estimateIFTA(input: TripInput): IFTAEstimate {
  const totalMiles = input.loadedMiles + input.deadheadMiles;
  const estimatedFuelGallons = totalMiles / THRESHOLDS.TRUCK_MPG;
  const txMiles = totalMiles * 0.70;
  return { totalMiles, txMiles, estimatedFuelGallons, estimatedTxTax: (txMiles / THRESHOLDS.TRUCK_MPG) * THRESHOLDS.TX_IFTA_RATE };
}

export function analyzeTrip(input: TripInput, equipmentType = 'dry_van', brokerRating?: string): FinancialReport {
  const totalMiles = input.loadedMiles + input.deadheadMiles;
  const deadheadPct = totalMiles > 0 ? input.deadheadMiles / totalMiles : 0;
  const m = computeMetrics(input);
  const flags = checkThresholds(input, m);
  const scoreBreakdown = computeScore(input, m, equipmentType, brokerRating);
  const ifta = estimateIFTA(input);

  const verdict: Verdict = flags.some(f => f.type === 'red_flag') || scoreBreakdown.total < 40 ? 'red' : scoreBreakdown.total < 65 ? 'yellow' : 'green';

  let action: string;
  if (verdict === 'red') {
    const worst = flags.find(f => f.type === 'red_flag');
    action = worst?.metric === 'deadhead_pct' ? 'Reject — deadhead kills margin. Find a backhaul first.' :
             worst?.metric === 'net_margin'   ? `Reject or counter at $${(m.cpm * 1.20).toFixed(2)}/mi.` :
             `Do not accept. Score ${scoreBreakdown.total}/100.`;
  } else if (verdict === 'yellow') {
    action = m.netMarginPct < 0.20 ? `Push for $${(m.rpmGross * 1.08).toFixed(2)}/mi to break 20% margin.` : 'Acceptable — book it, watch fuel.';
  } else {
    action = `Book it. Score ${scoreBreakdown.total}/100. Margin ${pct(m.netMarginPct)} is solid.`;
  }

  return {
    grossPay: input.grossPay, totalMiles, loadedMiles: input.loadedMiles,
    deadheadMiles: input.deadheadMiles, deadheadPct,
    totalCost: m.totalCost, netProfit: m.netProfit, netMarginPct: m.netMarginPct,
    rpmGross: m.rpmGross, rpmNet: m.rpmNet, cpm: m.cpm,
    logimarginScore: scoreBreakdown.total, scoreBreakdown, verdict, action, flags, ifta,
  };
}

// ============================================================
// MODULE 1 — BROKER INTEGRITY & BLACKLIST
// ============================================================
export function evaluateBrokerRisk(broker: BrokerProfile): BrokerRiskAssessment {
  if (broker.isBlacklisted) {
    return {
      riskLevel: 'blacklisted', riskScore: 100, isBlacklisted: true, redAlert: true,
      recommendedSurchargePct: 0, daysToPayAvg: broker.daysToPayAvg,
      message: `BLACKLISTED: ${broker.blacklistReason ?? 'This broker is on the no-haul list.'}`,
      action: 'Do NOT haul. Contact your dispatcher immediately.',
    };
  }
  const s = broker.riskScore;
  const riskLevel: BrokerRiskLevel = s >= 70 ? 'high' : s >= 40 ? 'medium' : 'low';
  const surcharge = s >= 70 ? 0.05 : s >= 40 ? 0.02 : 0;
  const message = s >= 70
    ? `High-risk broker (${s}/100). ${broker.disputeCount} disputes. Avg pay: ${broker.daysToPayAvg} days.`
    : s >= 40
    ? `Moderate risk (${s}/100). Watch payment — avg ${broker.daysToPayAvg} days.`
    : `Low-risk broker (${s}/100). Good payment history.`;
  const action = s >= 70
    ? 'Require QuickPay or factor with +5% surcharge.'
    : s >= 40
    ? 'Get signed RateCon before dispatch. Consider factoring +2%.'
    : 'Standard terms. Get RateCon and proceed.';
  return { riskLevel, riskScore: s, isBlacklisted: false, redAlert: s >= 70, recommendedSurchargePct: surcharge, daysToPayAvg: broker.daysToPayAvg, message, action };
}

// ============================================================
// MODULE 2 — MECHANIC'S EYE: PREDICTIVE MAINTENANCE
// ============================================================
export function detectMaintenanceAlerts(vitals: VehicleVitals, currentCpm: number): MaintenanceAlert[] {
  const alerts: MaintenanceAlert[] = [];
  const odo = vitals.currentOdometer;

  function checkInterval(lastMi: number | undefined, interval: number, type: MaintenanceAlertType, cost: number, critMsg: string, warnMsg: string) {
    if (lastMi === undefined) return;
    const since = odo - lastMi;
    const until = interval - since;
    if (until <= 0)
      alerts.push({ alertType: type, severity: 'critical', triggerMetric: `${since.toFixed(0)} mi since last service`, message: critMsg, milesUntilDue: 0, estimatedCost: cost });
    else if (until <= interval * 0.10)
      alerts.push({ alertType: type, severity: 'warning', triggerMetric: `${since.toFixed(0)} mi since last service`, message: warnMsg, milesUntilDue: until, estimatedCost: cost });
  }

  checkInterval(vitals.lastOilChangeMi, SERVICE_INTERVALS.oil_change, 'oil_change', 180,
    'Oil change OVERDUE. Engine damage risk rising.',
    `Oil change due in ${Math.max(0, SERVICE_INTERVALS.oil_change - (odo - (vitals.lastOilChangeMi ?? 0))).toFixed(0)} miles.`);

  checkInterval(vitals.lastTireRotateMi, SERVICE_INTERVALS.tire_rotation, 'tire_rotation', 250,
    'Tire rotation OVERDUE. Blowout and fuel cost risk.',
    `Tire rotation due in ${Math.max(0, SERVICE_INTERVALS.tire_rotation - (odo - (vitals.lastTireRotateMi ?? 0))).toFixed(0)} miles.`);

  checkInterval(vitals.lastInjectorSvcMi, SERVICE_INTERVALS.fuel_injector, 'fuel_injector', 600,
    'Fuel injector service overdue. Losing 8–12% fuel efficiency.',
    'Injector service coming up. Schedule during next maintenance window.');

  checkInterval(vitals.lastDefFluidMi, SERVICE_INTERVALS.def_fluid, 'def_fluid', 30,
    'DEF fluid check needed. Low DEF triggers 5 mph speed limiter.',
    'DEF fluid check due soon.');

  if (vitals.baselineCpm !== undefined && vitals.baselineCpm > 0) {
    const spike = (currentCpm - vitals.baselineCpm) / vitals.baselineCpm;
    if (spike >= 0.25) {
      alerts.push({ alertType: 'cpm_spike', severity: 'critical', triggerMetric: `+${pct(spike)} above baseline`,
        message: `COST SPIKE: CPM $${currentCpm.toFixed(3)} vs baseline $${vitals.baselineCpm.toFixed(3)} (+${pct(spike)}). Check injectors, tire pressure, air filter immediately.` });
    } else if (spike >= THRESHOLDS.CPM_SPIKE_THRESHOLD) {
      const cause = spike < 0.18 ? 'low tire pressure or dirty air filter' : spike < 0.22 ? 'clogged fuel filter or injector fouling' : 'possible transmission slip or turbo issue';
      alerts.push({ alertType: 'cpm_spike', severity: 'warning', triggerMetric: `+${pct(spike)} above 30-day baseline`,
        message: `CPM up ${pct(spike)}. Likely: ${cause}. Inspect before next trip.` });
    }
  }

  const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

// ============================================================
// MODULE 3 — DETENTION STOPWATCH & AUTO-DISPUTE
// ============================================================
export function calcDetention(entry: DetentionEntry): DetentionResult {
  const exit = entry.exitTimestamp ?? new Date();
  const detentionMinutes = Math.floor((exit.getTime() - entry.entryTimestamp.getTime()) / 60_000);
  const freeMinutes = THRESHOLDS.DETENTION_FREE_HOURS * 60;
  const billableMinutes = Math.max(0, detentionMinutes - freeMinutes);
  const hourlyRate = entry.detentionRatePerHour ?? THRESHOLDS.DETENTION_DEFAULT_RATE;
  const billableAmount = parseFloat(((billableMinutes / 60) * hourlyRate).toFixed(2));
  const isOverThreshold = detentionMinutes > freeMinutes;
  const claimReady = billableMinutes > 0 && !!entry.exitTimestamp;
  const fmt = (d: Date) => d.toLocaleString('en-US', { timeZone: 'America/Chicago', hour12: true });
  const facility = entry.facilityName ?? 'the above-named facility';

  const claimData: DetentionClaimData | null = claimReady ? {
    facilityName: facility,
    entryTime: fmt(entry.entryTimestamp),
    exitTime: fmt(exit),
    detentionHours: (detentionMinutes / 60).toFixed(2),
    billableHours: (billableMinutes / 60).toFixed(2),
    ratePerHour: hourlyRate,
    totalClaim: billableAmount,
    legalStatement:
      `This detention claim is submitted pursuant to the Rate Confirmation Agreement. ` +
      `The driver was confined at ${facility} for ${(detentionMinutes / 60).toFixed(2)} hours total. ` +
      `The first 2 hours are provided free of charge per industry standard. ` +
      `The remaining ${(billableMinutes / 60).toFixed(2)} billable hours at $${hourlyRate}/hr ` +
      `results in a detention charge of $${billableAmount.toFixed(2)}. ` +
      `Payment is due per the terms on the original Rate Confirmation. ` +
      `Non-payment may result in forwarding to collections.`,
  } : null;

  return { detentionMinutes, freeMinutes, billableMinutes, billableAmount, isOverThreshold, hourlyRate, claimReady, claimData };
}

// ============================================================
// MODULE 4 — IFTA SMART LOGGER
// ============================================================
export function aggregateIFTA(trips: IFTATripInput[], quarter: string): IFTAQuarterlySummary {
  const stateTotals: Record<string, { miles: number; gallons: number }> = {};
  let totalMiles = 0;
  let totalFuelGallons = 0;

  for (const trip of trips) {
    totalMiles += trip.totalMiles;
    totalFuelGallons += trip.fuelGallons;
    for (const [state, miles] of Object.entries(trip.stateMiles)) {
      if (!miles) continue;
      if (!stateTotals[state]) stateTotals[state] = { miles: 0, gallons: 0 };
      stateTotals[state].miles += miles;
      stateTotals[state].gallons += trip.totalMiles > 0 ? (miles / trip.totalMiles) * trip.fuelGallons : 0;
    }
  }

  const fleetMpg = totalFuelGallons > 0 ? totalMiles / totalFuelGallons : THRESHOLDS.TRUCK_MPG;
  const states: IFTAStateBreakdown[] = Object.entries(stateTotals)
    .map(([state, { miles, gallons }]) => {
      const taxRate = IFTA_RATES[state] ?? 0.20;
      return {
        state, miles: +miles.toFixed(2),
        milePct: totalMiles > 0 ? +(miles / totalMiles * 100).toFixed(1) : 0,
        fuelGallons: +gallons.toFixed(2),
        taxRate, taxOwed: +(gallons * taxRate).toFixed(2),
      };
    })
    .sort((a, b) => b.miles - a.miles);

  return {
    quarter, totalMiles, totalFuelGallons, fleetMpg,
    states, totalTaxOwed: +states.reduce((s, x) => s + x.taxOwed, 0).toFixed(2),
    exportReady: states.length > 0,
  };
}

// ============================================================
// MODULE 5 — MARKET PULSE
// ============================================================
export function compareToMarket(yourRpm: number, market: MarketRateData): MarketComparison {
  const percentAboveMarket = market.avgRpm > 0
    ? +((yourRpm - market.avgRpm) / market.avgRpm * 100).toFixed(1) : 0;
  const percentile: 'top' | 'avg' | 'below' =
    yourRpm >= market.highRpm * 0.95 ? 'top' : yourRpm >= market.avgRpm ? 'avg' : 'below';
  const recommendation =
    percentile === 'top'           ? 'Top of market on this lane. Lock it in.' :
    percentile === 'avg'           ? `Market-average rate. Push for $${(market.highRpm * 0.95).toFixed(2)}/mi.` :
    market.trend === 'rising'      ? `Rates rising — hold for $${market.avgRpm.toFixed(2)}/mi.` :
    `Below market ${Math.abs(percentAboveMarket).toFixed(1)}%. Counter or find a better lane.`;
  return {
    yourRpm, marketAvgRpm: market.avgRpm, marketHighRpm: market.highRpm, marketLowRpm: market.lowRpm,
    percentAboveMarket, percentile, trend: market.trend, loadToTruck: market.loadToTruck, recommendation,
  };
}

// ── Helpers ───────────────────────────────────────────────────
function pct(v: number) { return `${(v * 100).toFixed(1)}%`; }
