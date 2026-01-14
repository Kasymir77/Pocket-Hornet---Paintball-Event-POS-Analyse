
import React, { useState, useMemo } from 'react';
import { Transaction, Team, PaymentMethod } from '../types';
import { Icons, formatPrice } from '../constants';
import { soundService } from '../services/audioService';

interface SettleProps {
  transactions: Transaction[];
  teams: Team[];
  paymentMethods: PaymentMethod[];
  onSettleTeam: (teamId: string) => void;
  onNotify: (msg: string) => void;
  onDeleteTransaction: (id: number) => void; // Prop is passed but unused in UI now
}

const Settle: React.FC<SettleProps> = ({ transactions, teams, paymentMethods, onSettleTeam, onNotify }) => {
  // Nur noch ein View-State: Das Invoice Modal
  const [showInvoiceModal, setShowInvoiceModal] = useState<string | null>(null);

  // Zusammenfassung der Aktivitäten für alle Teams
  const teamSummaries = useMemo(() => {
    const map: Record<string, { totalDebt: number; totalVolume: number; count: number; name: string; id: string }> = {};
    
    transactions.forEach(tx => {
      if (!map[tx.teamId]) {
        let teamName = 'Unbekannt';
        if (tx.teamId === 'bar') {
          teamName = 'Direktverkauf (Bar)';
        } else {
          teamName = teams.find(t => t.id === tx.teamId)?.name || 'Unbekanntes Team';
        }
        map[tx.teamId] = { totalDebt: 0, totalVolume: 0, count: 0, name: teamName, id: tx.teamId };
      }
      
      map[tx.teamId].totalVolume += tx.total;
      map[tx.teamId].count += 1;
      if (tx.status === 'open') {
        map[tx.teamId].totalDebt += tx.total;
      }
    });
    
    return Object.values(map).sort((a, b) => {
      if (b.totalDebt !== a.totalDebt) return b.totalDebt - a.totalDebt;
      return b.totalVolume - a.totalVolume;
    });
  }, [transactions, teams]);

  const totalDebtOverall = teamSummaries.reduce((sum, s) => sum + s.totalDebt, 0);

  const settleAllForTeam = (e: React.MouseEvent, teamId: string) => {
    e.stopPropagation();
    soundService.playSplat(); // NEW: BUNKER HIT SOUND (Payment Received)
    onSettleTeam(teamId);
    setShowInvoiceModal(null);
  };

  // Druck-Funktion (PDF Export Standard)
  const handlePrintInvoice = (teamId: string, teamName: string, teamTransactions: Transaction[], totalDebt: number) => {
    const printWindow = window.open('', '', 'width=800,height=800');
    if (!printWindow) return;

    const itemsRows = teamTransactions.map(tx => {
        const itemDetails = tx.items.map(i => `<div>${i.count}x ${i.name} (${formatPrice(i.price)})</div>`).join('');
        return `
          <tr style="border-bottom: 1px solid #ddd;">
             <td style="padding: 8px;">${tx.dateStr} ${tx.timeStr}</td>
             <td style="padding: 8px;">${itemDetails}</td>
             <td style="padding: 8px;">${tx.status === 'open' ? 'OFFEN' : 'BEZAHLT'}</td>
             <td style="padding: 8px; text-align: right;">${formatPrice(tx.total)}</td>
          </tr>
        `;
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>RECHNUNG_${teamName}</title>
          <style>
            body { font-family: 'Helvetica', sans-serif; padding: 20px; color: #000; }
            h1 { font-size: 24px; margin-bottom: 5px; }
            .header { margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th { text-align: left; background: #f0f0f0; padding: 8px; border-bottom: 2px solid #000; }
            .total-box { margin-top: 30px; text-align: right; font-size: 18px; font-weight: bold; }
            .footer { margin-top: 50px; font-size: 10px; text-align: center; color: #555; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>RECHNUNG / KOSTENAUFSTELLUNG</h1>
            <div>Empfänger: <strong>${teamName}</strong></div>
            <div>Datum: ${new Date().toLocaleDateString('de-DE')}</div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Datum</th>
                <th>Artikel / Positionen</th>
                <th>Status</th>
                <th style="text-align: right;">Betrag</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>

          <div class="total-box">
             <div>GESAMT OFFEN: ${formatPrice(totalDebt)}</div>
          </div>

          <div class="footer">
             Ausgestellt durch POCKET HORNET POS SYSTEM<br>
             Green Hornets Landshut
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
       printWindow.print();
       printWindow.close();
    }, 500);
  };

  // --- DETAIL ANSICHT (INVOICE MODAL) ---
  if (showInvoiceModal) {
    const summary = teamSummaries.find(s => s.id === showInvoiceModal);
    const teamTransactions = transactions
      .filter(tx => tx.teamId === showInvoiceModal)
      .sort((a, b) => b.timestamp - a.timestamp);

    return (
      <div className="fixed inset-0 z-[200] bg-black flex flex-col animate-in slide-in-from-bottom-10 duration-300">
        
        {/* HEADER */}
        <div className="shrink-0 p-5 bg-neutral-900 border-b border-neutral-800 flex justify-between items-center shadow-lg relative z-10">
          <div>
             <h2 className="text-xl font-sci-fi font-black text-white italic uppercase truncate max-w-[200px]">{summary?.name}</h2>
             <p className="text-[10px] text-neutral-500 font-black uppercase tracking-[0.2em]">Kaufmännische Analyse</p>
          </div>
          <button 
             onClick={() => { soundService.playClick(); setShowInvoiceModal(null); }}
             className="w-10 h-10 rounded-full bg-neutral-800 text-neutral-400 flex items-center justify-center font-bold active:scale-90"
          >
             ✕
          </button>
        </div>

        {/* CONTENT (SCROLLABLE INVOICE) */}
        <div className="flex-1 overflow-y-auto p-4 bg-[#f0f0f0] text-black">
           <div className="bg-white shadow-2xl min-h-full p-6 max-w-2xl mx-auto rounded-xl">
              
              <div className="border-b-2 border-black pb-4 mb-6">
                 <div className="flex justify-between items-end">
                    <div>
                       <h1 className="text-2xl font-black uppercase tracking-tight">Rechnung</h1>
                       <p className="text-xs text-neutral-500 font-bold uppercase">Kostenaufstellung / Bewirtungsbeleg</p>
                    </div>
                    <div className="text-right">
                       <div className="text-xs font-mono text-neutral-500">{new Date().toLocaleDateString('de-DE')}</div>
                       <div className="text-sm font-bold uppercase">{summary?.name}</div>
                    </div>
                 </div>
              </div>

              <div className="space-y-4">
                 {/* TABLE HEADER */}
                 <div className="grid grid-cols-12 gap-2 text-[10px] font-black uppercase text-neutral-500 border-b border-neutral-300 pb-2">
                    <div className="col-span-2">Zeit</div>
                    <div className="col-span-8">Positionen</div>
                    <div className="col-span-2 text-right">Summe</div>
                 </div>

                 {/* ITEMS */}
                 {teamTransactions.map(tx => (
                    <div key={tx.id} className="grid grid-cols-12 gap-2 text-xs py-3 border-b border-neutral-100 items-start group">
                       <div className="col-span-2 font-mono text-neutral-500 text-[10px]">{tx.timeStr}</div>
                       <div className="col-span-8">
                          {tx.items.map((i, idx) => (
                             <div key={idx} className="mb-0.5">
                                <span className="font-bold">{i.count}x</span> {i.name} <span className="text-neutral-400 text-[10px]">({formatPrice(i.price)})</span>
                             </div>
                          ))}
                          <div className={`mt-1 text-[9px] font-black uppercase px-1.5 py-0.5 inline-block rounded ${tx.status === 'open' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                             {tx.status === 'open' ? 'Offen' : 'Bezahlt'}
                          </div>
                       </div>
                       <div className="col-span-2 text-right font-bold font-mono">
                          {formatPrice(tx.total)}
                       </div>
                       {/* REMOVED INDIVIDUAL DELETE BUTTON FROM HERE */}
                    </div>
                 ))}
              </div>

              <div className="mt-8 pt-4 border-t-2 border-black flex justify-end">
                 <div className="text-right">
                    <div className="text-[10px] font-black uppercase text-neutral-500">Gesamtbetrag Offen</div>
                    <div className={`text-3xl font-black ${summary?.totalDebt ? 'text-red-600' : 'text-green-600'}`}>
                       {formatPrice(summary?.totalDebt || 0)}
                    </div>
                 </div>
              </div>
           </div>
        </div>

        {/* ACTION BAR FOOTER */}
        <div className="shrink-0 p-4 bg-neutral-900 border-t border-neutral-800 flex gap-3 pb-safe">
           <button 
              onClick={() => handlePrintInvoice(showInvoiceModal!, summary!.name, teamTransactions, summary!.totalDebt)}
              className="flex-1 bg-white text-black py-4 rounded-xl font-black text-[12px] uppercase tracking-widest shadow-lg active:scale-95"
           >
              Drucken / PDF
           </button>
           
           <button 
               onClick={() => { 
                  if (navigator.share) {
                     navigator.share({
                        title: `Rechnung ${summary?.name}`,
                        text: `Offener Betrag für ${summary?.name}: ${formatPrice(summary?.totalDebt || 0)}`
                     }).catch(console.error);
                  } else {
                     onNotify("Teilen nicht verfügbar");
                  }
               }}
               className="px-6 bg-[#0098d4] text-white rounded-xl font-black text-[12px] uppercase tracking-widest active:scale-95"
           >
              Teilen
           </button>

           {summary && summary.totalDebt > 0 && (
              <button 
                 onClick={(e) => settleAllForTeam(e, showInvoiceModal!)}
                 className="flex-[1.5] bg-[#22c55e] text-black py-4 rounded-xl font-black text-[12px] uppercase tracking-widest shadow-[0_0_20px_rgba(34,197,94,0.4)] active:scale-95"
              >
                 BEZAHLEN
              </button>
           )}
        </div>
      </div>
    );
  }

  // --- HAUPT LISTE ---
  return (
    <div className="p-4 h-full overflow-y-auto bg-black pb-20 scrollbar-hide">
      <div className="text-center py-10">
        <div className="text-[9px] text-neutral-600 font-black tracking-[0.6em] uppercase mb-1">Ausstehender Gesamttribut</div>
        <div className={`text-5xl font-sci-fi font-black tracking-tighter ${totalDebtOverall > 0 ? 'text-red-500' : 'text-green-500'}`}>
          {formatPrice(totalDebtOverall)}
        </div>
      </div>

      <div className="space-y-4">
        {teamSummaries.length > 0 ? teamSummaries.map(summary => (
          <div 
            key={summary.id}
            className={`flex flex-col bg-neutral-900/60 border rounded-[30px] overflow-hidden shadow-xl transition-all ${summary.totalDebt > 0 ? 'border-red-900/30' : 'border-neutral-800'}`}
          >
            <div 
              onClick={() => { soundService.playClick(); setShowInvoiceModal(summary.id); }}
              className="flex items-center justify-between p-6 active:bg-neutral-800/50 cursor-pointer group"
            >
              <div className="flex flex-col flex-1 pr-4 overflow-hidden">
                <div className="text-white font-black uppercase tracking-widest text-sm mb-1 truncate">{summary.name}</div>
                <div className="text-[9px] text-neutral-600 font-black uppercase tracking-wider">
                  {summary.count} Einträge | Vol: {formatPrice(summary.totalVolume)}
                </div>
                
                <div className="mt-3 flex gap-2">
                  <button 
                    onClick={(e) => { e.stopPropagation(); soundService.playClick(); setShowInvoiceModal(summary.id); }}
                    className="bg-[#0098d4]/10 text-[#0098d4] border border-[#0098d4]/30 px-3 py-2 rounded-xl flex items-center gap-2 active:scale-95 transition-all shadow-sm w-full justify-center group-hover:bg-[#0098d4] group-hover:text-black"
                  >
                    <Icons.Chart className="w-3 h-3" />
                    <span className="text-[9px] font-black uppercase tracking-widest">DETAILS / ANALYSE / EXPORT</span>
                  </button>
                </div>
              </div>
              
              <div className="flex flex-col items-end shrink-0 pl-2">
                <div className={`text-xl font-sci-fi font-black ${summary.totalDebt > 0 ? 'text-red-500' : 'text-green-500'}`}>
                  {formatPrice(summary.totalDebt)}
                </div>
              </div>
            </div>
            
            {summary.totalDebt > 0 && (
              <button 
                onClick={(e) => settleAllForTeam(e, summary.id)}
                className="w-full bg-red-600/10 border-t border-red-900/20 py-4 text-[10px] font-black text-red-500 uppercase tracking-[0.3em] active:bg-green-600 active:text-black transition-colors"
              >
                TRIBUT BEGLEICHEN
              </button>
            )}
          </div>
        )) : (
          <div className="flex flex-col items-center justify-center pt-20 text-neutral-800">
            <Icons.Wallet className="w-12 h-12 mb-4 opacity-20" />
            <p className="font-black text-[10px] uppercase tracking-[0.4em] text-neutral-600">Keine Einträge im Archiv</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settle;
