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
