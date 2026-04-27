export type BrokerRating = 'A' | 'B' | 'C' | 'D' | 'F';

export interface Load {
  id: string;
  created_at: string;
  origin: string;
  destination: string;
  rate: number;
  miles: number;
  broker_id: string;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  real_profit?: number;
  margin?: number;
}

export interface Broker {
  id: string;
  name: string;
  mc_number: string;
  rating: BrokerRating;
  avg_days_to_pay: number;
  is_factorable: boolean;
}

export interface MaintenanceVitals {
  last_oil_change: number;
  current_mileage: number;
  tire_health: 'good' | 'warning' | 'critical';
}

export type Verdict = 'green' | 'yellow' | 'red';

export interface TripFlag {
  type: 'warning' | 'red_flag';
  message: string;
}

export interface FinancialReport {
  grossPay: number;
  loadedMiles: number;
  deadheadMiles: number;
  totalMiles: number;
  fuelCost: number;
  tollCost: number;
  driverPay: number;
  maintCost: number;
  factoringCost: number;
  totalCost: number;
  netProfit: number;
  netMarginPct: number;
  rpmGross: number;
  rpmNet: number;
  cpm: number;
  deadheadPct: number;
  logimarginScore: number;
  verdict: Verdict;
  action: string;
  flags: TripFlag[];
  ifta: {
    totalMiles: number;
    txMiles: number;
    estimatedFuelGallons: number;
    estimatedTxTax: number;
  };
}

export interface DashboardKPIs {
  dailyNetProfit: number;
  dailyNetProfitDelta: number;
  activeCashFlow: number;
  pendingInvoiceCount: number;
  fleetHealthScore: number;
  activeTrips: number;
  redFlagCount: number;
}

export interface TripRow {
  id: string;
  origin: string;
  destination: string;
  grossPay: number;
  netProfit: number | null;
  logimarginScore: number | null;
  verdict: Verdict | null;
  action: string | null;
  status: string;
  pickupDate: string | null;
  brokerName: string | null;
}

export type InvoiceStatus = 'pending' | 'submitted' | 'approved' | 'funded' | 'rejected' | 'disputed';

export interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  tripRoute: string;
  invoiceAmount: number;
  advanceAmount: number | null;
  status: InvoiceStatus;
  hasAiErrors: boolean;
  aiErrorAmount: number | null;
  paidAt: string | null;
  paymentDays: number | null;
}

export interface AuditError {
  field: string;
  invoicedValue: string;
  expectedValue: string;
  difference: number;
  severity: 'critical' | 'warning' | 'info';
  description: string;
}

export interface FreightAuditResult {
  invoiceNumber: string;
  invoicedAmount: number;
  expectedAmount: number;
  discrepancyAmount: number;
  hasErrors: boolean;
  confidence: number;
  errors: AuditError[];
  summary: string;
  recommendation: string;
}

export interface VehicleVitals {
  currentOdometer: number;
  engineHours: number;
  lastOilChangeMi: number;
  lastTireRotateMi: number;
  lastInjectorSvcMi: number;
  lastDefFluidMi: number;
  baselineCpm: number;
}

export interface MaintenanceAlert {
  severity: 'critical' | 'warning' | 'info';
  alertType: string;
  message: string;
  triggerMetric: string;
  estimatedCost?: number;
  milesUntilDue?: number;
}

export interface DetentionClaimData {
  facilityName: string;
  entryTime: string;
  exitTime: string;
  detentionHours: number;
  billableHours: number;
  totalClaim: number;
  legalStatement: string;
}

export interface DetentionResult {
  detentionMinutes: number;
  billableMinutes: number;
  billableAmount: number;
  claimData: DetentionClaimData | null;
}
