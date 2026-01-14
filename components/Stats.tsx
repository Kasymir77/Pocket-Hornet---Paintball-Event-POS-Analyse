
import React, { useMemo, useState, useEffect } from 'react';
import { Transaction, Team, PaymentMethod, Expense, Product, LootConfig } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { formatPrice, Icons } from '../constants';

interface StatsProps {
  transactions: Transaction[];
  teams: Team[];
  paymentMethods: PaymentMethod[];
  expenses: Expense[];
  products: Product[];
  categories: string[];
  lootConfig: LootConfig;
}

type DetailViewType = 'REVENUE' | 'EXPENSES' | 'PROFIT' | 'WARCHEST' | 'REPORT' | null;

const Stats: React.FC<StatsProps> = ({ transactions, teams, paymentMethods, expenses, products, categories, lootConfig }) => {
  const [subView, setSubView] = useState<'overview' | 'teams'>('overview');
  const [detailView, setDetailView] = useState<DetailViewType>(null);
  const [chartReady, setChartReady] = useState(false);
  
  // Filter States für Team Statistik
  const [filterCategory, setFilterCategory] = useState<string>('ALLE');
  const [filterProduct, setFilterProduct] = useState<string>('ALLE');

  useEffect(() => {
    const timer = setTimeout(() => setChartReady(true), 300);
    return () => clearTimeout(timer);
  }, []);

  // MATH HELPER: Safe Rounding
  const safeRound = (num: number) => Math.round(num * 100) / 100;

  // --- CORE FINANCIAL CALCULATIONS ---
  const manualExpenses = expenses.filter(e => e.type === 'expense' || !e.type); 
  const deposits = expenses.filter(e => e.type === 'deposit');
  const withdrawals = expenses.filter(e => e.type === 'withdraw');

  // 1. UMSATZ
  const rawTotalRevenue = transactions.reduce((sum, tx) => sum + tx.total, 0);
  const totalRevenue = safeRound(rawTotalRevenue);

  // 2. AUSGABEN / INTERN
  const totalManualExpenses = safeRound(manualExpenses.reduce((sum, ex) => sum + ex.amount, 0));
  
  const internalConsumptionTxs = transactions.filter(tx => tx.type === 'internal' || tx.teamId === 't1' || tx.teamId === 't2');
  const internalConsumption = safeRound(internalConsumptionTxs.reduce((sum, tx) => sum + tx.total, 0));

  // 3. LOOT ANALYSIS (PROFIT)
  // IMPERIAL UPDATE: Calculation is ALWAYS active now.
  let totalPaintCost = 0;
  let totalPaintBoxesSold = 0;
  
  transactions.forEach(tx => {
    tx.items.forEach(item => {
      if (item.category === 'PAINT') {
        totalPaintBoxesSold += item.count;
      }
    });
  });
  totalPaintCost = safeRound(totalPaintBoxesSold * lootConfig.paintCostPerBox);
  
  const rentCostForBalance = lootConfig.rentPaid ? 0 : lootConfig.rentCost; 
  
  // PROFIT FORMULA: Umsatz - Ausgaben(Bar) - InternerVerbrauch(Verkaufswert) - Wareneinsatz(Paint) - Wareneinsatz(Essen) - Miete - Custom
  const rawProfit = totalRevenue 
    - totalManualExpenses 
    - internalConsumption 
    - totalPaintCost 
    - lootConfig.foodCost 
    - rentCostForBalance
    - (lootConfig.customCostAmount || 0); // SUBTRACT CUSTOM COST
    
  const totalNetProfit = safeRound(rawProfit);

  // 4. KRIEGSKASSE
  const cashTransactions = transactions.filter(tx => (tx.status === 'paid' && tx.type === 'cash') || tx.status === 'settled');
  const cashRevenue = safeRound(cashTransactions.reduce((sum, tx) => sum + tx.total, 0));
  const totalDeposits = safeRound(deposits.reduce((sum, ex) => sum + ex.amount, 0));
  const totalWithdrawals = safeRound(withdrawals.reduce((sum, ex) => sum + ex.amount, 0));
  
  const warChest = safeRound(cashRevenue + totalDeposits - totalManualExpenses - totalWithdrawals);

  // --- TEAM STATS LOGIC ---
  const teamStats = useMemo(() => {
    const data: Record<string, { name: string; value: number; count: number }> = {};
    transactions.forEach(tx => {
      let txTotal = 0;
      if (filterCategory !== 'ALLE' || filterProduct !== 'ALLE') {
        tx.items.forEach(item => {
           const matchesCategory = filterCategory === 'ALLE' || (item.category && item.category.toUpperCase() === filterCategory);
           const matchesProduct = filterProduct === 'ALLE' || item.id === filterProduct;
           if (matchesCategory && matchesProduct) txTotal += item.price * item.count;
        });
      } else {
        txTotal = tx.total;
      }
      
      const safeTxTotal = Math.round(txTotal * 100) / 100;

      if (safeTxTotal > 0) {
        if (!data[tx.teamId]) {
          const team = teams.find(t => t.id === tx.teamId);
          let name = team?.name || (tx.teamId === 'bar' ? 'Direktverkauf (Bar)' : 'Unbekannt');
          data[tx.teamId] = { name, value: 0, count: 0 };
        }
        data[tx.teamId].value += safeTxTotal;
        data[tx.teamId].count += 1;
      }
    });
    
    // Round final aggregated values for display
    const result = Object.values(data).map(item => ({
        ...item,
        value: Math.round(item.value * 100) / 100
    }));

    return result.sort((a, b) => b.value - a.value);
  }, [transactions, teams, filterCategory, filterProduct]);

  // --- PRINT / SHARE HELPERS ---
  const handlePrint = (title: string, contentHTML: string) => {
    const win = window.open('', '', 'width=800,height=900');
    if (!win) return;
    win.document.write(`
      <html><head><title>${title}</title>
      <style>
        body { font-family: 'Helvetica', sans-serif; padding: 20px; color: #000; font-size: 12px; }
        h1 { font-size: 18px; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; text-transform: uppercase; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th { background: #eee; text-align: left; padding: 5px; border-bottom: 1px solid #000; font-size: 10px; text-transform: uppercase; }
        td { padding: 5px; border-bottom: 1px solid #ddd; vertical-align: top; }
        .amount { text-align: right; font-family: monospace; font-weight: bold; }
        .positive { color: #000; }
        .negative { color: #d00; }
        .summary-box { border: 2px solid #000; padding: 10px; margin-bottom: 20px; display: flex; justify-content: space-between; }
        .footer { margin-top: 50px; font-size: 10px; text-align: center; color: #666; }
      </style>
      </head><body>
      <h1>${title}</h1>
      ${contentHTML}
      <div class="footer">IMPERIAL FINANCIAL SYSTEM - GENERATED REPORT</div>
      </body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };

  const handleShare = async (title: string, text: string) => {
     if (navigator.share) {
       try { await navigator.share({ title, text }); } catch (e) {}
     } else {
       alert("Teilen nicht verfügbar");
     }
  };

  const handleShareCSV = () => {
    // CSV Logic remains available inside the stats view or could be added here
    // For now we focus on the new REPORT view structure
  };

  // --- DETAIL MODALS ---

  const renderDetailModal = () => {
    if (!detailView) return null;

    let title = "";
    let content = null;
    let exportTitle = "";
    
    // BACK BUTTON
    const CloseBtn = () => (
      <button onClick={() => setDetailView(null)} className="absolute top-4 right-4 w-10 h-10 bg-neutral-800 rounded-full flex items-center justify-center text-white active:scale-90 z-50">✕</button>
    );

    // GENERIC ACTIONS (Used by simple cards, overridden in REPORT)
    const Actions = ({ onPrint, onShareText }: { onPrint: () => void, onShareText: string }) => (
      <div className="shrink-0 p-4 border-t border-neutral-800 bg-neutral-900 flex gap-3 pb-safe">
        <button onClick={onPrint} className="flex-1 bg-white text-black py-4 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 shadow-lg">Drucken / PDF</button>
        <button onClick={() => handleShare(exportTitle, onShareText)} className="flex-1 bg-[#0098d4] text-white py-4 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 shadow-lg">Teilen</button>
      </div>
    );

    // --- 1. REVENUE ---
    if (detailView === 'REVENUE') {
      title = "Brutto Umsatz Detail";
      exportTitle = "UMSATZ_BERICHT";
      content = (
        <>
          <div className="bg-neutral-900/50 p-6 rounded-2xl mb-6 border border-green-500/20">
            <div className="text-[10px] uppercase text-neutral-500 font-bold tracking-widest mb-2">Gesamtvolumen</div>
            <div className="text-4xl font-sci-fi font-black text-white">{formatPrice(totalRevenue)}</div>
            <div className="text-xs text-green-500 mt-1 font-bold">{transactions.length} Transaktionen</div>
          </div>
          <div className="space-y-2">
            <div className="flex text-[9px] uppercase text-neutral-500 font-black px-2 pb-1">
              <div className="w-16">Zeit</div>
              <div className="flex-1">Kunde / Items</div>
              <div className="text-right w-20">Summe</div>
            </div>
            {transactions.map(tx => (
              <div key={tx.id} className="bg-neutral-900/30 border border-neutral-800 p-3 rounded-xl flex items-center">
                <div className="w-16 text-[10px] text-neutral-400 font-mono">{tx.timeStr}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-bold text-white truncate">{tx.teamName}</div>
                  <div className="text-[9px] text-neutral-500 truncate">{tx.items.map(i => `${i.count}x ${i.name}`).join(', ')}</div>
                </div>
                <div className="w-20 text-right font-mono font-bold text-green-400">{formatPrice(tx.total)}</div>
              </div>
            ))}
          </div>
          <Actions 
             onPrint={() => handlePrint("UMSATZ BERICHT", `
               <table><thead><tr><th>Zeit</th><th>Kunde</th><th>Summe</th></tr></thead><tbody>
               ${transactions.map(tx => `<tr><td>${tx.timeStr}</td><td>${tx.teamName} (${tx.items.length} items)</td><td class="amount">${formatPrice(tx.total)}</td></tr>`).join('')}
               </tbody></table><div style="margin-top:20px; font-weight:bold; text-align:right">GESAMT: ${formatPrice(totalRevenue)}</div>
             `)}
             onShareText={`Umsatz Report: ${formatPrice(totalRevenue)}`}
          />
        </>
      );
    }

    // --- 2. EXPENSES ---
    if (detailView === 'EXPENSES') {
      title = "Ausgaben & Intern Detail";
      exportTitle = "AUSGABEN_BERICHT";
      const timeline = [
        ...manualExpenses.map(e => ({ ...e, sortTime: e.timestamp, label: 'Ausgabe (Bar)', color: 'text-red-500' })),
        ...internalConsumptionTxs.map(tx => ({ ...tx, amount: tx.total, sortTime: tx.timestamp, label: 'Intern/Team', color: 'text-purple-400' })),
        ...deposits.map(d => ({ ...d, sortTime: d.timestamp, label: 'Einlage (IN)', color: 'text-green-500' })),
        ...withdrawals.map(w => ({ ...w, sortTime: w.timestamp, label: 'Entnahme (OUT)', color: 'text-red-500' }))
      ].sort((a, b) => b.sortTime - a.sortTime);

      content = (
        <>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-red-950/20 p-4 rounded-2xl border border-red-500/20">
              <div className="text-[9px] uppercase text-red-400 font-bold tracking-widest mb-1">Total Abfluss</div>
              <div className="text-2xl font-sci-fi font-black text-white">-{formatPrice(totalManualExpenses + internalConsumption)}</div>
            </div>
            <div className="bg-purple-950/20 p-4 rounded-2xl border border-purple-500/20">
               <div className="text-[9px] uppercase text-purple-400 font-bold tracking-widest mb-1">Davon Intern</div>
               <div className="text-xl font-sci-fi font-black text-white">{formatPrice(internalConsumption)}</div>
            </div>
          </div>
          <div className="space-y-2">
            {timeline.map((item: any) => (
              <div key={item.id} className="bg-neutral-900/30 border border-neutral-800 p-3 rounded-xl flex items-center">
                 <div className="w-16 text-[10px] text-neutral-400 font-mono">{item.timeStr || new Date(item.timestamp).toLocaleTimeString('de-DE', {hour:'2-digit', minute:'2-digit'})}</div>
                 <div className="flex-1 min-w-0">
                    <div className={`text-[10px] font-black uppercase tracking-wider mb-0.5 ${item.color}`}>{item.label}</div>
                    <div className="text-[11px] text-white truncate">{item.description || item.teamName || '---'}</div>
                 </div>
                 <div className={`w-20 text-right font-mono font-bold ${item.color}`}>
                    {item.label.includes('Einlage') ? '+' : '-'}{formatPrice(item.amount || item.total)}
                 </div>
              </div>
            ))}
          </div>
          <Actions 
             onPrint={() => handlePrint("AUSGABEN LOG", `
               <table><thead><tr><th>Zeit</th><th>Typ</th><th>Beschreibung</th><th>Betrag</th></tr></thead><tbody>
               ${timeline.map((item: any) => `<tr><td>${new Date(item.timestamp).toLocaleTimeString()}</td><td>${item.label}</td><td>${item.description || item.teamName}</td><td class="amount">${formatPrice(item.amount || item.total)}</td></tr>`).join('')}
               </tbody></table>
             `)}
             onShareText={`Ausgaben Report: Total -${formatPrice(totalManualExpenses + internalConsumption)}`}
          />
        </>
      );
    }

    // --- 3. PROFIT ---
    if (detailView === 'PROFIT') {
      title = "Gewinnrechnung";
      exportTitle = "GEWINN_BERICHT";
      content = (
        <>
          <div className="bg-yellow-950/10 border border-yellow-500/30 p-6 rounded-[32px] mb-8 text-center">
             <div className="text-[10px] uppercase text-yellow-500 font-black tracking-[0.3em] mb-2">Reingewinn (Kalkuliert)</div>
             <div className={`text-5xl font-sci-fi font-black ${totalNetProfit >= 0 ? 'text-yellow-400' : 'text-red-500'}`}>
                {formatPrice(totalNetProfit)}
             </div>
          </div>
          <div className="bg-neutral-900/50 rounded-2xl p-6 border border-neutral-800 space-y-4 font-mono text-sm">
             <div className="flex justify-between text-green-400"><span>(+) Brutto Umsatz</span><span className="font-bold">{formatPrice(totalRevenue)}</span></div>
             <div className="h-[1px] bg-neutral-800" />
             <div className="flex justify-between text-red-400"><span>(-) Ausgaben (Bar)</span><span>-{formatPrice(totalManualExpenses)}</span></div>
             <div className="flex justify-between text-purple-400"><span>(-) Interner Verbrauch</span><span>-{formatPrice(internalConsumption)}</span></div>
             <div className="h-[1px] bg-neutral-800" />
             <div className="flex justify-between text-neutral-400 italic"><span>(-) Wareneinsatz Paint</span><span>-{formatPrice(totalPaintCost)}</span></div>
             <div className="flex justify-between text-neutral-400 italic"><span>(-) Wareneinsatz Essen</span><span>-{formatPrice(lootConfig.foodCost)}</span></div>
             <div className="flex justify-between text-neutral-400 italic"><span>(-) {lootConfig.customCostName || 'Sonstiges'}</span><span>-{formatPrice(lootConfig.customCostAmount || 0)}</span></div>
             <div className="flex justify-between text-neutral-400 italic"><span>(-) Pacht/Event (Kalk.)</span><span>-{formatPrice(rentCostForBalance)}</span></div>
             <div className="h-[2px] bg-white my-2" />
             <div className={`flex justify-between font-black text-lg ${totalNetProfit >= 0 ? 'text-yellow-400' : 'text-red-500'}`}><span>= REINGEWINN</span><span>{formatPrice(totalNetProfit)}</span></div>
          </div>
          <Actions 
             onPrint={() => handlePrint("GEWINN RECHNUNG", `
               <div style="font-size:16px; font-weight:bold; margin-bottom:20px;">REINGEWINN: ${formatPrice(totalNetProfit)}</div>
               <table style="width:100%">
                 <tr><td>Umsatz</td><td class="amount">${formatPrice(totalRevenue)}</td></tr>
                 <tr><td>Ausgaben (Bar)</td><td class="amount">-${formatPrice(totalManualExpenses)}</td></tr>
                 <tr><td>Intern</td><td class="amount">-${formatPrice(internalConsumption)}</td></tr>
                 <tr><td>Paint EK</td><td class="amount">-${formatPrice(totalPaintCost)}</td></tr>
                 <tr><td>Essen EK</td><td class="amount">-${formatPrice(lootConfig.foodCost)}</td></tr>
                 <tr><td>${lootConfig.customCostName || 'Sonstiges'}</td><td class="amount">-${formatPrice(lootConfig.customCostAmount || 0)}</td></tr>
                 <tr><td>Pacht/Event</td><td class="amount">-${formatPrice(rentCostForBalance)}</td></tr>
               </table>
             `)}
             onShareText={`Gewinn Report: ${formatPrice(totalNetProfit)}`}
          />
        </>
      );
    }

    // --- 4. WARCHEST ---
    if (detailView === 'WARCHEST') {
      title = "Kriegskasse";
      exportTitle = "KASSE_BERICHT";
      content = (
        <>
          <div className="bg-gradient-to-r from-[#0098d4] to-[#22c55e] p-[1px] rounded-[32px] mb-8">
             <div className="bg-black rounded-[31px] p-6 text-center">
                <div className="text-[10px] uppercase text-white font-black tracking-[0.3em] mb-2">Aktueller Barbestand</div>
                <div className="text-5xl font-sci-fi font-black text-white">{formatPrice(warChest)}</div>
             </div>
          </div>
          <div className="bg-neutral-900/50 rounded-2xl p-6 border border-neutral-800 space-y-4 font-mono text-sm">
             <div className="flex justify-between text-green-400"><span>(+) Bar Umsätze</span><span className="font-bold">{formatPrice(cashRevenue)}</span></div>
             <div className="flex justify-between text-green-500"><span>(+) Einlagen</span><span>{formatPrice(totalDeposits)}</span></div>
             <div className="h-[1px] bg-neutral-800" />
             <div className="flex justify-between text-red-400"><span>(-) Ausgaben (Bar)</span><span>-{formatPrice(totalManualExpenses)}</span></div>
             <div className="flex justify-between text-red-500"><span>(-) Entnahmen</span><span>-{formatPrice(totalWithdrawals)}</span></div>
             <div className="h-[2px] bg-white my-2" />
             <div className="flex justify-between font-black text-lg text-[#0098d4]"><span>= SOLL BESTAND</span><span>{formatPrice(warChest)}</span></div>
          </div>
          <Actions 
             onPrint={() => handlePrint("KASSEN BERICHT", `
               <div style="font-size:16px; font-weight:bold; margin-bottom:20px;">KASSENSTAND: ${formatPrice(warChest)}</div>
               <table>
                 <tr><td>Bar Umsatz</td><td class="amount">${formatPrice(cashRevenue)}</td></tr>
                 <tr><td>Einlagen</td><td class="amount">${formatPrice(totalDeposits)}</td></tr>
                 <tr><td>Ausgaben</td><td class="amount">-${formatPrice(totalManualExpenses)}</td></tr>
                 <tr><td>Entnahmen</td><td class="amount">-${formatPrice(totalWithdrawals)}</td></tr>
               </table>
             `)}
             onShareText={`Kassensturz: Soll=${formatPrice(warChest)}`}
          />
        </>
      );
    }
    
    // --- 5. REPORT (THE NEW BILANZ / JOURNAL) ---
    if (detailView === 'REPORT') {
      exportTitle = "BILANZ_PROTOKOLL";
      
      // 1. Merge ALL Data into a unified Journal
      // Transaction Mapping
      const txEntries = transactions.map(tx => ({
        id: `tx-${tx.id}`,
        ts: tx.timestamp,
        time: tx.timeStr,
        type: tx.type === 'internal' ? 'INTERN' : (tx.status === 'open' ? 'RECHNUNG (OFFEN)' : 'VERKAUF'),
        desc: `${tx.teamName} (${tx.items.length} Pos.)`,
        amount: tx.total,
        isPositive: true,
        category: 'revenue',
        displayClass: tx.type === 'internal' ? 'text-purple-600' : (tx.status === 'open' ? 'text-orange-500' : 'text-green-600')
      }));

      // Expense Mapping
      const exEntries = expenses.map(ex => {
        let label = 'AUSGABE';
        let isPos = false;
        let dClass = 'text-red-600';

        if (ex.type === 'deposit') { label = 'EINLAGE'; isPos = true; dClass = 'text-green-500'; }
        else if (ex.type === 'withdraw') { label = 'ENTNAHME'; isPos = false; dClass = 'text-red-500'; }
        
        return {
          id: ex.id,
          ts: ex.timestamp,
          time: new Date(ex.timestamp).toLocaleTimeString('de-DE', {hour:'2-digit', minute:'2-digit'}),
          type: label,
          desc: ex.description,
          amount: ex.amount,
          isPositive: isPos,
          category: 'cash',
          displayClass: dClass
        };
      });

      // 2. Sort Descending (Newest first) for UI
      const journal = [...txEntries, ...exEntries].sort((a, b) => b.ts - a.ts);

      // 3. Totals for Header - WITH ROUNDING
      const totalIn = safeRound(journal.filter(j => j.isPositive).reduce((sum, j) => sum + j.amount, 0));
      const totalOut = safeRound(journal.filter(j => !j.isPositive).reduce((sum, j) => sum + j.amount, 0));
      const netBalance = safeRound(totalIn - totalOut); // Simple Net Flow

      return (
        <div className="fixed inset-0 z-[150] bg-black flex flex-col animate-in slide-in-from-bottom duration-300">
          
          {/* HEADER (Black) */}
          <div className="shrink-0 p-5 bg-neutral-900 border-b border-neutral-800 flex justify-between items-center shadow-lg relative z-10">
            <div>
               <h2 className="text-xl font-sci-fi font-black text-white italic uppercase">Einsatz-Bilanz</h2>
               <p className="text-[10px] text-neutral-500 font-black uppercase tracking-[0.2em]">Vollständiges Journal</p>
            </div>
            <button 
               onClick={() => setDetailView(null)} 
               className="w-10 h-10 rounded-full bg-neutral-800 text-neutral-400 flex items-center justify-center font-bold active:scale-90"
            >
               ✕
            </button>
          </div>

          {/* CONTENT (White Paper Look) */}
          <div className="flex-1 overflow-y-auto p-4 bg-[#f0f0f0] text-black">
             <div className="bg-white shadow-2xl min-h-full p-6 max-w-3xl mx-auto rounded-xl">
                
                {/* SUMMARY HEADER ON PAPER */}
                <div className="border-b-2 border-black pb-6 mb-6">
                   <div className="flex justify-between items-start mb-6">
                      <div>
                         <h1 className="text-2xl font-black uppercase tracking-tight mb-1">Bilanzierung</h1>
                         <p className="text-xs text-neutral-500 font-bold uppercase">Lückenlose Erfassung aller Vorgänge</p>
                      </div>
                      <div className="text-right">
                         <div className="text-xs font-mono text-neutral-500">{new Date().toLocaleDateString('de-DE')}</div>
                         <div className="text-xs font-bold uppercase text-neutral-400">Green Hornets POS</div>
                      </div>
                   </div>

                   <div className="grid grid-cols-3 gap-4">
                      <div className="bg-green-50 p-3 rounded border border-green-100">
                         <div className="text-[9px] uppercase font-black text-green-800 mb-1">Summe Eingang (+)</div>
                         <div className="text-lg font-black text-green-700 font-mono">{formatPrice(totalIn)}</div>
                      </div>
                      <div className="bg-red-50 p-3 rounded border border-red-100">
                         <div className="text-[9px] uppercase font-black text-red-800 mb-1">Summe Ausgang (-)</div>
                         <div className="text-lg font-black text-red-700 font-mono">-{formatPrice(totalOut)}</div>
                      </div>
                      <div className="bg-gray-100 p-3 rounded border border-gray-200">
                         <div className="text-[9px] uppercase font-black text-gray-600 mb-1">Netto Bewegung</div>
                         <div className={`text-lg font-black font-mono ${netBalance >= 0 ? 'text-black' : 'text-red-600'}`}>
                            {netBalance >= 0 ? '+' : ''}{formatPrice(netBalance)}
                         </div>
                      </div>
                   </div>
                </div>

                {/* JOURNAL TABLE */}
                <div className="space-y-4">
                   <div className="grid grid-cols-12 gap-2 text-[10px] font-black uppercase text-neutral-500 border-b border-neutral-300 pb-2">
                      <div className="col-span-2">Zeit</div>
                      <div className="col-span-3">Typ</div>
                      <div className="col-span-5">Beschreibung</div>
                      <div className="col-span-2 text-right">Betrag</div>
                   </div>

                   {journal.map(entry => (
                      <div key={entry.id} className="grid grid-cols-12 gap-2 text-xs py-2 border-b border-neutral-100 items-start hover:bg-gray-50">
                         <div className="col-span-2 font-mono text-neutral-500 text-[10px] pt-0.5">{entry.time}</div>
                         <div className="col-span-3 font-bold uppercase text-[10px] tracking-wide pt-0.5">{entry.type}</div>
                         <div className="col-span-5 text-neutral-800 font-medium leading-tight">
                            {entry.desc}
                         </div>
                         <div className={`col-span-2 text-right font-bold font-mono ${entry.displayClass}`}>
                            {entry.isPositive ? '+' : '-'}{formatPrice(entry.amount)}
                         </div>
                      </div>
                   ))}
                </div>

                <div className="mt-8 pt-4 border-t-2 border-black text-center text-[10px] uppercase font-bold text-neutral-400">
                   *** Ende des Berichts ***
                </div>
             </div>
          </div>

          {/* FOOTER ACTIONS */}
          <div className="shrink-0 p-4 bg-neutral-900 border-t border-neutral-800 flex gap-3 pb-safe">
             <button 
                onClick={() => handlePrint("BILANZ PROTOKOLL", `
                  <div class="summary-box">
                    <div>
                      <div>EINGANG (+)</div>
                      <div class="positive">${formatPrice(totalIn)}</div>
                    </div>
                    <div>
                      <div>AUSGANG (-)</div>
                      <div class="negative">-${formatPrice(totalOut)}</div>
                    </div>
                    <div style="text-align:right">
                      <div>SALDO</div>
                      <div style="font-size:16px; font-weight:bold">${formatPrice(netBalance)}</div>
                    </div>
                  </div>
                  <table>
                    <thead><tr><th>Zeit</th><th>Typ</th><th>Beschreibung</th><th>Betrag</th></tr></thead>
                    <tbody>
                    ${journal.map(j => `
                      <tr>
                        <td>${j.time}</td>
                        <td>${j.type}</td>
                        <td>${j.desc}</td>
                        <td class="amount ${j.isPositive ? 'positive' : 'negative'}">
                          ${j.isPositive ? '+' : '-'}${formatPrice(j.amount)}
                        </td>
                      </tr>
                    `).join('')}
                    </tbody>
                  </table>
                `)}
                className="flex-1 bg-white text-black py-4 rounded-xl font-black text-[12px] uppercase tracking-widest shadow-lg active:scale-95"
             >
                Drucken / PDF
             </button>
             
             <button 
                 onClick={() => handleShare("BILANZ_STATUS", `Bilanz Status: Eingang +${formatPrice(totalIn)} | Ausgang -${formatPrice(totalOut)} | Netto: ${formatPrice(netBalance)}`)}
                 className="flex-1 bg-[#0098d4] text-white rounded-xl font-black text-[12px] uppercase tracking-widest active:scale-95 shadow-lg"
             >
                Teilen
             </button>
          </div>

        </div>
      );
    }

    // GENERIC MODAL WRAPPER
    return (
      <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col animate-in slide-in-from-bottom duration-300">
        <CloseBtn />
        <div className="shrink-0 p-6 pt-12 pb-4">
           <h2 className="text-2xl font-sci-fi font-black text-white italic uppercase">{title}</h2>
           <p className="text-[10px] text-neutral-500 font-black uppercase tracking-[0.4em] border-b border-neutral-800 pb-4 mb-0">Kaufmännische Detailansicht</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 pt-0">
           {content}
        </div>
      </div>
    );
  };

  // --- SUBVIEW: TEAM STATISTICS ---
  if (subView === 'teams') {
    return (
      <div className="p-4 h-full overflow-y-auto bg-black pb-24 scrollbar-hide animate-in slide-in-from-right-4 duration-300">
        <div className="flex items-center gap-4 mb-6">
          <button 
            onClick={() => setSubView('overview')}
            className="w-12 h-12 flex items-center justify-center bg-neutral-900 rounded-2xl border border-neutral-800 text-neutral-400 active:scale-95 transition-transform"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div>
            <h2 className="font-sci-fi text-xl font-black text-white italic uppercase">Truppen-Analyse</h2>
            <p className="text-[10px] font-black text-[#0098d4] uppercase tracking-[0.2em]">Detail-Auswertung</p>
          </div>
        </div>

        {/* FILTERS */}
        <div className="bg-neutral-900/40 border border-neutral-800 p-4 rounded-[24px] mb-6 shadow-xl">
           <div className="text-[9px] font-black text-neutral-500 uppercase tracking-widest mb-3">Filter-Matrix</div>
           <div className="flex gap-3">
             <div className="flex-1">
               <label className="text-[8px] uppercase text-neutral-600 font-bold block mb-1">Bereich</label>
               <select 
                 value={filterCategory} 
                 onChange={(e) => { setFilterCategory(e.target.value); setFilterProduct('ALLE'); }}
                 className="w-full bg-black border border-neutral-800 rounded-xl px-3 py-2 text-[10px] font-bold text-white uppercase outline-none focus:border-[#0098d4]"
               >
                 <option value="ALLE">ALLE BEREICHE</option>
                 {categories.map(c => <option key={c} value={c}>{c}</option>)}
               </select>
             </div>
             <div className="flex-1">
               <label className="text-[8px] uppercase text-neutral-600 font-bold block mb-1">Artikel</label>
               <select 
                  value={filterProduct} 
                  onChange={(e) => setFilterProduct(e.target.value)}
                  className="w-full bg-black border border-neutral-800 rounded-xl px-3 py-2 text-[10px] font-bold text-white uppercase outline-none focus:border-[#0098d4]"
               >
                 <option value="ALLE">ALLE ARTIKEL</option>
                 {products
                   .filter(p => filterCategory === 'ALLE' || p.category === filterCategory)
                   .map(p => <option key={p.id} value={p.id}>{p.name}</option>)
                 }
               </select>
             </div>
           </div>
        </div>

        {/* CHART */}
        <div className="h-64 w-full bg-neutral-900/30 rounded-[32px] p-4 border border-neutral-800 relative shadow-2xl mb-6 overflow-hidden">
          {chartReady && teamStats.length > 0 ? (
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={teamStats.slice(0, 7)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                 <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                 <XAxis dataKey="name" hide />
                 <YAxis stroke="#525252" fontSize={9} tickFormatter={(val) => `€${val}`} />
                 <Tooltip 
                    cursor={{fill: '#22c55e05'}} 
                    contentStyle={{ backgroundColor: '#000', border: '1px solid #404040', borderRadius: '12px', fontSize: '10px' }}
                    formatter={(value: number) => [formatPrice(value), 'Umsatz']}
                    labelStyle={{ color: '#0098d4', fontWeight: 'bold' }}
                 />
                 <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                   {teamStats.slice(0, 7).map((entry, index) => (
                     <Cell key={`cell-${index}`} fill={index === 0 ? '#22c55e' : '#0098d4'} opacity={0.8 + (0.2 - index * 0.05)} />
                   ))}
                 </Bar>
               </BarChart>
             </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-[10px] uppercase text-neutral-600 font-black tracking-widest">Keine Daten verfügbar</div>
          )}
        </div>

        {/* TABLE */}
        <div className="space-y-1">
          <div className="flex px-4 pb-2 text-[8px] font-black text-neutral-600 uppercase tracking-widest">
            <div className="w-8 text-center">#</div>
            <div className="flex-1">Einheit</div>
            <div className="text-right">Umsatz</div>
          </div>
          {teamStats.map((team, idx) => (
            <div key={idx} className="flex items-center bg-neutral-900/40 border border-neutral-800/50 p-4 rounded-2xl">
              <div className={`w-8 text-center font-sci-fi font-black ${idx === 0 ? 'text-[#39ff14]' : 'text-neutral-500'}`}>{idx + 1}</div>
              <div className="flex-1">
                <div className="text-[11px] font-black text-white uppercase leading-tight">{team.name}</div>
                <div className="text-[8px] font-mono text-neutral-500 mt-0.5 opacity-70">
                   {filterCategory === 'ALLE' && filterProduct === 'ALLE' ? 'Gesamtumsatz' : 'Gefilterter Umsatz'}
                </div>
              </div>
              <div className="text-right font-sci-fi font-black text-[#0098d4]">
                {formatPrice(team.value)}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // --- MAIN OVERVIEW ---
  return (
    <div className="p-4 h-full overflow-y-auto bg-black pb-24 scrollbar-hide relative">
      
      {renderDetailModal()}

      {/* HEADER WITH TEAM STATS BUTTON */}
      <div className="mb-6 relative">
         <div className="absolute inset-0 bg-gradient-to-r from-[#0098d4]/10 to-transparent blur-xl pointer-events-none" />
         
         <button 
           onClick={() => setSubView('teams')}
           className="w-full relative overflow-hidden group bg-neutral-900 border border-[#0098d4]/30 p-5 rounded-[28px] shadow-[0_0_20px_rgba(0,152,212,0.15)] active:scale-[0.98] transition-all"
         >
           <div className="flex justify-between items-center relative z-10">
             <div className="text-left">
               <h3 className="font-sci-fi text-lg font-black text-white italic uppercase tracking-wider group-hover:text-[#0098d4] transition-colors">Team Statistik</h3>
               <p className="text-[9px] font-black text-neutral-500 uppercase tracking-[0.3em] mt-1">Umsatz & Artikel-Analyse</p>
             </div>
             <div className="w-10 h-10 rounded-full bg-[#0098d4]/20 flex items-center justify-center text-[#0098d4] group-hover:bg-[#0098d4] group-hover:text-black transition-colors">
               <svg className="w-5 h-5 transform group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
             </div>
           </div>
         </button>
      </div>

      <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-neutral-800 to-transparent mb-6" />

      {/* CARD LAYOUT FOR FINANCIAL OVERVIEW */}
      <div className="flex flex-col gap-3 mb-8">
        
        {/* CARD 1: BRUTTO UMSATZ */}
        <div onClick={() => setDetailView('REVENUE')} className="glass-panel p-5 rounded-[32px] border border-green-900/30 shadow-lg relative overflow-hidden group cursor-pointer active:scale-95 transition-all">
          <div className="flex justify-between items-start mb-2">
            <div className="text-[9px] font-black uppercase tracking-widest text-neutral-500 italic">Brutto Umsatz</div>
            <div className="w-5 h-5 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-400 group-hover:bg-green-500 group-hover:text-black transition-colors">
               <Icons.Chart className="w-3 h-3" />
            </div>
          </div>
          <div className="text-3xl font-sci-fi font-black text-white italic tabular-nums tracking-tight">{formatPrice(totalRevenue)}</div>
          <div className="absolute right-0 top-0 h-full w-1 bg-white/10 group-hover:bg-green-500/50 transition-colors"></div>
        </div>

        {/* CARD 2: AUSGABEN, INTERN & CASH MOVEMENTS */}
        <div onClick={() => setDetailView('EXPENSES')} className="glass-panel p-5 rounded-[32px] border border-red-900/30 shadow-lg relative overflow-hidden group cursor-pointer active:scale-95 transition-all">
          <div className="flex justify-between items-start mb-4">
             <div className="text-[9px] font-black uppercase tracking-widest text-red-400 italic">Ausgaben / Intern / Kassen-Bewegungen</div>
             <div className="w-5 h-5 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-400 group-hover:bg-red-500 group-hover:text-black transition-colors">
               <Icons.Chart className="w-3 h-3" />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
             <div>
               <div className="text-[7px] uppercase text-neutral-500 font-bold mb-0.5">Interner Verbrauch</div>
               <div className="text-sm font-mono text-red-400 font-bold">{formatPrice(internalConsumption)}</div>
             </div>
             <div>
               <div className="text-[7px] uppercase text-neutral-500 font-bold mb-0.5">Operativ (Bar)</div>
               <div className="text-sm font-mono text-red-400 font-bold">{formatPrice(totalManualExpenses)}</div>
             </div>
             <div>
               <div className="text-[7px] uppercase text-green-700 font-bold mb-0.5">Wechselgeld (IN)</div>
               <div className="text-sm font-mono text-green-600 font-bold">{formatPrice(totalDeposits)}</div>
             </div>
             <div>
               <div className="text-[7px] uppercase text-red-700 font-bold mb-0.5">Wechselgeld (OUT)</div>
               <div className="text-sm font-mono text-red-600 font-bold">{formatPrice(totalWithdrawals)}</div>
             </div>
          </div>
        </div>

        {/* CARD 3: HORNETS EINSATZ BELOHNUNG (REINGEWINN) */}
        <div onClick={() => setDetailView('PROFIT')} className="glass-panel p-6 rounded-[32px] border border-yellow-500/30 shadow-[0_0_20px_rgba(234,179,8,0.15)] relative overflow-hidden group bg-yellow-900/10 cursor-pointer active:scale-95 transition-all">
          <div className="flex justify-between items-start mb-2">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-yellow-500 italic">Hornets Einsatz Belohnung</div>
            <div className="w-5 h-5 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-400 group-hover:bg-yellow-500 group-hover:text-black transition-colors">
               <Icons.Chart className="w-3 h-3" />
            </div>
          </div>
          <div className="text-[8px] font-black text-neutral-500 uppercase tracking-widest mb-3">(Gewinnrechnung Event)</div>
          
          <div className={`text-4xl font-sci-fi font-black italic tabular-nums tracking-tighter drop-shadow-lg ${totalNetProfit >= 0 ? 'text-yellow-400' : 'text-red-500'}`}>
             {formatPrice(totalNetProfit)}
          </div>
          
          <div className="absolute right-0 top-0 h-full w-1 bg-yellow-500/20 group-hover:bg-yellow-500/50 transition-colors"></div>
        </div>

        {/* CARD 4: KRIEGSKASSE (NETTO CASH) */}
        <div onClick={() => setDetailView('WARCHEST')} className="mt-2 p-1 rounded-[34px] bg-gradient-to-r from-[#0098d4] via-[#22c55e] to-[#0098d4] shadow-[0_0_25px_rgba(0,152,212,0.3)] cursor-pointer active:scale-95 transition-all">
          <div className="bg-black rounded-[32px] p-6 relative overflow-hidden">
             <div className="absolute inset-0 bg-[#0098d4]/5" />
             <div className="relative z-10 text-center">
               <div className="text-[12px] font-black uppercase tracking-[0.3em] text-[#0098d4] mb-1 italic">KRIEGSKASSENSTAND</div>
               <div className="text-[8px] font-black uppercase tracking-widest text-neutral-600 mb-2 italic">(Aktueller Kassenstand in Bar)</div>
               <div className="text-4xl font-sci-fi font-black text-white italic drop-shadow-[0_0_15px_rgba(0,152,212,0.6)] tabular-nums">
                 {formatPrice(warChest)}
               </div>
             </div>
          </div>
        </div>

      </div>

      <button onClick={() => setDetailView('REPORT')} className="w-full py-5 rounded-[22px] bg-neutral-900 border border-blue-500/20 text-blue-500 font-black text-[11px] uppercase tracking-widest active:scale-95 transition-all mb-4 shadow-lg hover:bg-blue-900/20">
        EINSATZ-BILANZ & JOURNAL
      </button>
      
      <div className="text-center">
        <p className="text-[8px] text-neutral-700 uppercase tracking-widest font-bold">Imperial Financial System v2.3</p>
      </div>
    </div>
  );
};

export default Stats;
