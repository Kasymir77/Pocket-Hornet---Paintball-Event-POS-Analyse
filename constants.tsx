
import React from 'react';
import { Product, Team, PaymentMethod } from './types';

/**
 * Absolut robuster Preis-Formatter
 * Garantiert 2 Nachkommastellen und Komma-Trennung.
 */
export const formatPrice = (price: number): string => {
  if (price === undefined || price === null) return "0,00 €";
  const fixed = price.toFixed(2).replace('.', ',');
  return `${fixed} €`;
};

// COMMANDER CONFIGURATION SNAPSHOT
export const DEFAULT_PRODUCTS: Product[] = [
  { id: "p1", name: "Paint, Kiste", price: 45, active: true, category: "PAINT" },
  { id: "p2", name: "Softdrinks, flasche", price: 2.5, active: true, category: "GETRÄNKE ALKOHLOFREI" },
  { id: "p3", name: "Bier, flasche", price: 2.5, active: true, category: "ALKOHOLISCHE GETRÄNKE" },
  { id: "p4", name: "Kaffee, becher", price: 1, active: true, category: "GETRÄNKE ALKOHLOFREI" },
  { id: "p5", name: "Kuchen hausgemacht", price: 1.5, active: true, category: "ESSEN" },
  { id: "p6", name: "gegrilltes + Semmel", price: 4.5, active: true, category: "ESSEN" },
  { id: "p7", name: "Wiener, paar + Semmel", price: 2.5, active: true, category: "ESSEN" },
  { id: "p8", name: "Debreziner, paar + Semmel", price: 3.5, active: true, category: "ESSEN" },
  { id: "p9", name: "Semmel, einzeln", price: 0.5, active: true, category: "ESSEN" },
  { id: "p1768211136110", name: "Eventkosten", price: 0, active: false, category: "EVENTKOSTEN" },
  { id: "p1768212018321", name: "Glühwein, Becher", price: 2, active: true, category: "ALKOHOLISCHE GETRÄNKE" },
  { id: "p1768213889639", name: "Wasser, Flasche", price: 1, active: true, category: "GETRÄNKE ALKOHLOFREI" }
];

export const DEFAULT_TEAMS: Team[] = [
  { id: "t1", name: "Green Hornets Landshut + Friends", active: true },
  { id: "t2", name: "Referee Team / Fotograf / Josef", active: true },
  { id: "t3", name: "EP Brothers Dornbirn", active: true },
  { id: "t4", name: "Rock Bottom Regensburg", active: true },
  { id: "t5", name: "Raptors Landshut", active: true },
  { id: "t6", name: "Scopes Bad Tölz", active: true },
  { id: "t7", name: "Hydras Hauzenberg", active: true },
  { id: "t1768211339073", name: "paintball fichtheim", active: true }
];

export const DEFAULT_CATEGORIES: string[] = [
  "ALKOHOLISCHE GETRÄNKE",
  "ESSEN",
  "EVENTKOSTEN",
  "GETRÄNKE ALKOHLOFREI",
  "PAINT"
];

// Standard Zahlungsmethoden
export const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = [
  { id: 'cash', name: 'BAR', active: true, requiresTeam: false, initialStatus: 'paid' },
  { id: 'acc', name: 'RECHNUNG', active: true, requiresTeam: true, initialStatus: 'open' },
];

export const Icons = {
  Shop: ({ className = "w-6 h-6" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
    </svg>
  ),
  Wallet: ({ className = "w-6 h-6" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  Chart: ({ className = "w-6 h-6" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  Settings: ({ className = "w-6 h-6" }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0L2.5 5.5V18.5L12 24L21.5 18.5V5.5L12 0ZM19.5 17.3L12 21.7L4.5 17.3V6.7L12 2.3L19.5 6.7V17.3ZM12 5.5L17.6 8.7V15.3L12 18.5L6.4 15.3V8.7L12 5.5ZM12 8.2L9.1 9.9V14.1L12 15.8L14.9 14.1V9.9L12 8.2Z" />
    </svg>
  ),
  Trash: ({ className = "w-6 h-6" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
  DragHandle: ({ className = "w-6 h-6" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  ),
};
