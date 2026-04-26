// ============================================================
// LogiMargin — Shared Type Definitions v6
// ============================================================
export type UserRole = 'owner_op' | 'fleet_manager' | 'driver';
export type EquipmentType = 'dry_van' | 'flatbed' | 'reefer' | 'step_deck' | 'lowboy' | 'tanker' | 'car_hauler';
export type TripStatus = 'quoted' | 'booked' | 'in_transit' | 'delivered' | 'invoiced' | 'paid' | 'cancelled';
export type Verdict = 'green' | 'yellow' | 'red';
export type InvoiceStatus = 'pending' | 'submitted' | 'approved' | 'funded' | 'rejected' | 'disputed';

export interface TripInput {
  grossPay: number; loadedMiles: number; deadheadMiles: number;
  fuelCost: number; tollCost: number; driverPay: number; maintCost: number;
  factoringRate?: number; currentDieselPrice?: number;
}

export interface ThresholdFlag { type: 'red_flag' | 'warning' | 'info'; metric: string; value: number; threshold: number; message: string; }
export interface IFTAEstimate { totalMiles: number; txMiles: number; estimatedFuelGallons: number; estimatedTxTax: number; }
export interface ScoreBreakdown { netMarginScore: number; rpmScore: number; deadheadScore: number; brokerScore: number; distanceScore: number; total: number; }

export interface FinancialReport {
  grossPay: number; totalMiles: number; loadedMiles: number; deadheadMiles: number; deadheadPct: number;
  totalCost: number; netProfit: number; netMarginPct: number; rpmGross: number; rpmNet: number; cpm: number;
  logimarginScore: number; scoreBreakdown: ScoreBreakdown; verdict: Verdict; action: string; flags: ThresholdFlag[]; ifta: IFTAEstimate;
}

export interface AuditError { field: string; invoicedValue: string; expectedValue: string; difference: number; severity: 'critical' | 'warning' | 'info'; description: string; }
export interface FreightAuditResult { invoiceNumber: string; invoicedAmount: number; expectedAmount: number; discrepancyAmount: number; hasErrors: boolean; confidence: number; errors: AuditError[]; summary: string; recommendation: string; }
export interface DashboardKPIs { dailyNetProfit: number; dailyNetProfitDelta: number; activeCashFlow: number; pendingInvoiceCount: number; fleetHealthScore: number; activeTrips: number; redFlagCount: number; }

export interface TripRow {
  id: string; origin: string; destination: string;
  grossPay: number; netProfit: number | null;
  logimarginScore: number | null; verdict: Verdict | null;
  action: string | null; status: TripStatus;
  pickupDate: string | null; brokerName?: string | null;
}

export interface InvoiceRow {
  id: string; invoiceNumber: string; tripRoute: string;
  invoiceAmount: number; advanceAmount: number | null;
  status: InvoiceStatus; hasAiErrors: boolean;
  aiErrorAmount: number | null;
  paidAt?: string | null; paymentDays?: number | null;
}

// ── Module 1: Broker Integrity ────────────────────────────────
export type BrokerRiskLevel = 'low' | 'medium' | 'high' | 'blacklisted';
export interface BrokerProfile { id?: string; name: string; mcNumber?: string; riskScore: number; isBlacklisted: boolean; blacklistReason?: string; daysToPayAvg: number; disputeCount: number; creditRating?: string; }
export interface BrokerRiskAssessment { riskLevel: BrokerRiskLevel; riskScore: number; isBlacklisted: boolean; redAlert: boolean; recommendedSurchargePct: number; daysToPayAvg: number; message: string; action: string; }

// ── Module 2: Predictive Maintenance ─────────────────────────
export interface VehicleVitals { vehicleId?: string; currentOdometer: number; engineHours?: number; lastOilChangeMi?: number; lastTireRotateMi?: number; lastInjectorSvcMi?: number; lastDefFluidMi?: number; baselineCpm?: number; }
export type MaintenanceAlertType = 'oil_change' | 'tire_rotation' | 'fuel_injector' | 'def_fluid' | 'brake_check' | 'transmission' | 'coolant' | 'belt_check' | 'cpm_spike' | 'custom';
export interface MaintenanceAlert { alertType: MaintenanceAlertType; severity: 'info' | 'warning' | 'critical'; message: string; triggerMetric: string; milesUntilDue?: number; estimatedCost?: number; }

// ── Module 3: Detention Timer ─────────────────────────────────
export interface DetentionEntry { entryTimestamp: Date; exitTimestamp?: Date; facilityName?: string; detentionRatePerHour?: number; }
export interface DetentionClaimData { facilityName: string; entryTime: string; exitTime: string; detentionHours: string; billableHours: string; ratePerHour: number; totalClaim: number; legalStatement: string; }
export interface DetentionResult { detentionMinutes: number; freeMinutes: number; billableMinutes: number; billableAmount: number; isOverThreshold: boolean; hourlyRate: number; claimReady: boolean; claimData: DetentionClaimData | null; }

// ── Module 4: IFTA Smart Logger ───────────────────────────────
export interface IFTATripInput { totalMiles: number; fuelGallons: number; stateMiles: Partial<Record<string, number>>; }
export interface IFTAStateBreakdown { state: string; miles: number; milePct: number; fuelGallons: number; taxRate: number; taxOwed: number; }
export interface IFTAQuarterlySummary { quarter: string; totalMiles: number; totalFuelGallons: number; fleetMpg: number; states: IFTAStateBreakdown[]; totalTaxOwed: number; exportReady: boolean; }

// ── Module 5: Market Pulse ────────────────────────────────────
export type MarketTrend = 'rising' | 'stable' | 'falling';
export interface MarketRateData { laneOrigin: string; laneDest: string; equipmentType: string; avgRpm: number; highRpm: number; lowRpm: number; loadToTruck: number; trend: MarketTrend; }
export interface MarketComparison { yourRpm: number; marketAvgRpm: number; marketHighRpm: number; marketLowRpm: number; percentAboveMarket: number; percentile: 'top' | 'avg' | 'below'; trend: MarketTrend; loadToTruck: number; recommendation: string; }
export interface SafeStop { id: string; name: string; city: string; stateCode: string; lat: number; lng: number; stopType: string; hasSecurity: boolean; hasLighting: boolean; hasCameras: boolean; capacityTrucks?: number; upvotes: number; downvotes: number; score: number; }
