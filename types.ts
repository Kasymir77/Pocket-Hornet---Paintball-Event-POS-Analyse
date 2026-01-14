
export interface Product {
  id: string;
  name: string;
  price: number;
  active: boolean;
  category?: string;
}

export interface Team {
  id: string;
  name: string;
  active: boolean;
}

export interface PaymentMethod {
  id: string;
  name: string;
  active: boolean;
  requiresTeam: boolean; // true erzwingt Team-Auswahl (z.B. für offene Posten)
  initialStatus: 'paid' | 'open'; // 'paid' = Geld da, 'open' = Schulden
}

export interface CartItem extends Product {
  count: number;
}

export interface Transaction {
  id: number;
  items: CartItem[];
  total: number;
  type: string; // Refers to PaymentMethod.id
  teamId: string;
  teamName: string;
  status: 'paid' | 'open' | 'settled';
  timestamp: number;
  dateStr: string;
  timeStr: string;
}

export type CashLogType = 'expense' | 'deposit' | 'withdraw';

export interface Expense {
  id: string;
  amount: number;
  description: string;
  timestamp: number;
  dateStr: string;
  type: CashLogType; // 'expense' = Ausgabe/Verlust, 'deposit' = Einlage, 'withdraw' = Einlage zurück
}

export interface LootConfig {
  active: boolean;
  paintCostPerBox: number;
  rentCost: number;
  foodCost: number;
  rentPaid: boolean; // Status ob Miete für dieses Event schon entnommen wurde
  // NEW CUSTOM FIELD
  customCostName?: string;
  customCostAmount?: number;
}

export type ViewType = 'pos' | 'settle' | 'stats' | 'admin';
