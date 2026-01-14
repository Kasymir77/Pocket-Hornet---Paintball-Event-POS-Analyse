
import React, { useState, useEffect, useCallback } from 'react';
import { ViewType, Product, Team, Transaction, PaymentMethod, Expense, CashLogType, LootConfig } from './types';
import { DEFAULT_PRODUCTS, DEFAULT_TEAMS, DEFAULT_PAYMENT_METHODS, Icons, formatPrice } from './constants';
import { soundService } from './services/audioService';
import POS from './components/POS';
import Settle from './components/Settle';
import Stats from './components/Stats';
import Admin from './components/Admin';
import Intro from './components/Intro';

const GatoLogo = ({ className = "w-32 h-32" }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 40 L35 15 L45 35" stroke="#0098d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-[0_0_8px_#0098d4]" />
    <path d="M80 40 L65 15 L55 35" stroke="#0098d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-[0_0_8px_#0098d4]" />
    <path d="M20 40 C20 40 20 80 50 85 C80 80 80 40 80 40" stroke="#0098d4" strokeWidth="2" strokeLinecap="round" className="drop-shadow-[0_0_8px_#0098d4]" />
    <path d="M35 55 L45 60 L50 55 L55 60 L65 55" stroke="#0098d4" strokeWidth="1.5" strokeLinecap="round" className="drop-shadow-[0_0_5px_#0098d4]" />
    <path d="M45 70 L50 75 L55 70" stroke="#0098d4" strokeWidth="2" strokeLinecap="round" className="drop-shadow-[0_0_5px_#0098d4]" />
    <circle cx="40" cy="45" r="2" fill="#0098d4" className="animate-pulse" />
    <circle cx="60" cy="45" r="2" fill="#0098d4" className="animate-pulse" />
  </svg>
);

const App: React.FC = () => {
  const [view, setView] = useState<ViewType>('pos');
  const [showIntro, setShowIntro] = useState(true);
  
  // SECURITY UPDATE: Initialisiere State direkt basierend auf Storage. 
  // Wenn nicht akzeptiert -> Modal ist SOFORT da (true). Laden dicht.
  const [showGatoModal, setShowGatoModal] = useState(() => {
    return !localStorage.getItem('gh_legal_accepted');
  });
  
  // State für Miete-Prompt
  const [showRentPrompt, setShowRentPrompt] = useState(false);

  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem('gh_products');
    return saved ? JSON.parse(saved) : DEFAULT_PRODUCTS;
  });
  const [teams, setTeams] = useState<Team[]>(() => {
    const saved = localStorage.getItem('gh_teams');
    return saved ? JSON.parse(saved) : DEFAULT_TEAMS;
  });
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(() => {
    const saved = localStorage.getItem('gh_payment_methods');
    return saved ? JSON.parse(saved) : DEFAULT_PAYMENT_METHODS;
  });
  const [categories, setCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('gh_categories');
    if (saved) return JSON.parse(saved);
    const cats = new Set<string>();
    DEFAULT_PRODUCTS.forEach(p => { if(p.category) cats.add(p.category.toUpperCase()); });
    return cats.size > 0 ? Array.from(cats).sort() : ['PAINT', 'GETRÄNKE', 'ESSEN', 'ALLGEMEIN'];
  });
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('gh_tx');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [expenses, setExpenses] = useState<Expense[]>(() => {
    const saved = localStorage.getItem('gh_expenses');
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return parsed.map((ex: any) => ({
      ...ex,
      type: ex.type || 'expense'
    }));
  });

  const [lootConfig, setLootConfig] = useState<LootConfig>(() => {
    const saved = localStorage.getItem('gh_loot_config');
    // Migration: rentPaid default false
    const parsed = saved ? JSON.parse(saved) : {};
    return { 
      active: parsed.active || false, 
      paintCostPerBox: parsed.paintCostPerBox || 0, 
      rentCost: parsed.rentCost || 0, 
      foodCost: parsed.foodCost || 0,
      rentPaid: parsed.rentPaid || false,
      customCostName: parsed.customCostName || '',
      customCostAmount: parsed.customCostAmount || 0
    };
  });

  const [currentTime, setCurrentTime] = useState(new Date());
  const [notification, setNotification] = useState<string | null>(null);

  // AUTO FULLSCREEN TRY ON MOUNT
  useEffect(() => {
    const tryFullscreen = async () => {
      try {
        const doc = document.documentElement;
        if (!document.fullscreenElement) {
          // @ts-ignore
          if (doc.requestFullscreen) await doc.requestFullscreen();
          // @ts-ignore
          else if (doc.webkitRequestFullscreen) await doc.webkitRequestFullscreen();
        }
      } catch (e) {
        // Silent fail if no user interaction yet (Browser Policy)
      }
    };
    tryFullscreen();

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('gh_products', JSON.stringify(products));
      localStorage.setItem('gh_teams', JSON.stringify(teams));
      localStorage.setItem('gh_payment_methods', JSON.stringify(paymentMethods));
      localStorage.setItem('gh_categories', JSON.stringify(categories));
      localStorage.setItem('gh_tx', JSON.stringify(transactions));
      localStorage.setItem('gh_expenses', JSON.stringify(expenses));
      localStorage.setItem('gh_loot_config', JSON.stringify(lootConfig));
    } catch (e) { console.error("Storage Sync Error", e); }
  }, [products, teams, paymentMethods, categories, transactions, expenses, lootConfig]);

  const showNotify = useCallback((msg: string) => {
    soundService.playDing();
    if (window.navigator.vibrate) try { window.navigator.vibrate([30, 50, 30]); } catch(e){}
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  }, []);

  // AUTOMATISCHE MIETE CHECKER
  useEffect(() => {
    if (!lootConfig.active || lootConfig.rentPaid || lootConfig.rentCost <= 0) return;

    // Berechne aktuellen KRIEGSKASSENSTAND (Barbestand)
    const cashRevenue = transactions.reduce((sum, tx) => {
      if (tx.status === 'paid' && tx.type === 'cash') return sum + tx.total;
      if (tx.status === 'settled') return sum + tx.total;
      return sum;
    }, 0);
    
    const manualExpenses = expenses.filter(e => e.type === 'expense' || !e.type).reduce((s, e) => s + e.amount, 0);
    const deposits = expenses.filter(e => e.type === 'deposit').reduce((s, e) => s + e.amount, 0);
    const withdrawals = expenses.filter(e => e.type === 'withdraw').reduce((s, e) => s + e.amount, 0);

    const warChest = cashRevenue + deposits - manualExpenses - withdrawals;

    // Schwellenwert: Mietkosten + 50€ Puffer
    if (warChest >= (lootConfig.rentCost + 50)) {
       // Verhindern, dass Prompt spammt, wenn er schon offen ist
       setShowRentPrompt(true);
    }

  }, [transactions, expenses, lootConfig]);

  const handlePayRent = useCallback(() => {
     if (!lootConfig.rentCost) return;
     
     // 1. Geld als AUSGABE buchen (Miete ist weg, aber kein Wechselgeld-Abfluss im technischen Sinne, sondern Kosten)
     const newEntry: Expense = {
      id: `ex${Date.now()}`,
      amount: lootConfig.rentCost,
      description: "MIETE HALLE (AUTO-ZAHLUNG)",
      type: 'expense', // CHANGE: 'expense' instead of 'withdraw'
      timestamp: Date.now(),
      dateStr: new Date().toLocaleDateString('de-DE')
    };
    setExpenses(prev => [newEntry, ...prev]);

    // 2. Status auf bezahlt setzen
    setLootConfig(prev => ({ ...prev, rentPaid: true }));
    setShowRentPrompt(false);
    
    soundService.playKaching();
    showNotify(`MIETE (${formatPrice(lootConfig.rentCost)}) GEBUCHT & BEZAHLT`);
  }, [lootConfig.rentCost, showNotify]);


  const handleIntroComplete = useCallback(() => {
    setShowIntro(false);
    // Erneuter Versuch Fullscreen nach Intro
    try {
      const doc = document.documentElement;
      if (doc.requestFullscreen && !document.fullscreenElement) {
        doc.requestFullscreen().catch(() => {});
      }
    } catch (e) {}
  }, []);

  const addTransaction = useCallback((tx: Transaction) => {
    setTransactions(prev => [tx, ...prev]);
    const method = paymentMethods.find(m => m.id === tx.type);
    showNotify(method ? `${method.name} GEBUCHT!` : "GEBUCHT!");
  }, [paymentMethods, showNotify]);

  const undoLastTransaction = useCallback(() => {
    soundService.playRevert();
    setTransactions(prev => {
      if (prev.length === 0) {
        showNotify("KEINE DATEN");
        return prev;
      }
      const lastTx = prev[0];
      setTimeout(() => { showNotify(`STORNO: ${formatPrice(lastTx.total)}`); }, 0);
      return prev.slice(1);
    });
  }, [showNotify]);

  // NEW: Delete specific transaction (Storno from Detailed View)
  const deleteTransaction = useCallback((id: number) => {
    soundService.playRemove();
    setTransactions(prev => prev.filter(tx => tx.id !== id));
    showNotify("BUCHUNG STORNIERT");
  }, [showNotify]);

  const addCashLog = useCallback((amount: number, description: string, type: CashLogType) => {
    const newEntry: Expense = {
      id: `ex${Date.now()}`,
      amount,
      description,
      type,
      timestamp: Date.now(),
      dateStr: new Date().toLocaleDateString('de-DE')
    };
    setExpenses(prev => [newEntry, ...prev]);
    
    if (type === 'deposit') showNotify(`BAREINLAGE: +${formatPrice(amount)}`);
    else if (type === 'withdraw') showNotify(`ENTNAHME: -${formatPrice(amount)}`);
    else showNotify(`BAR-AUSGABE: ${formatPrice(amount)}`);
  }, [showNotify]);

  const settleTeam = useCallback((teamId: string) => {
    soundService.playKaching();
    setTransactions(prev => prev.map(tx => 
      (tx.teamId === teamId && tx.status === 'open') ? { ...tx, status: 'settled' } : tx
    ));
    const team = teams.find(t => t.id === teamId);
    showNotify(`${team?.name || 'TEAM'} BEGLICHEN`);
  }, [teams, showNotify]);

  const resetTransactions = useCallback(() => {
    soundService.playRevert();
    setTransactions([]);
    setExpenses([]);
    setLootConfig(prev => ({...prev, rentPaid: false})); // Reset Rent Status too
    showNotify("KASSE & AUSGABEN GENULLT");
  }, [showNotify]);

  // LEGAL CONFIRMATION HANDLER
  // Speichert Zeitstempel & Fingerprint
  const handleConfirmLegal = useCallback(() => {
    const complianceData = {
       acceptedAt: Date.now(),
       isoDate: new Date().toISOString(),
       userAgent: navigator.userAgent, // Offline Device Fingerprint
       ipPlaceholder: "127.0.0.1 (LOCAL_SECURE)", // Da wir keine externe API rufen
       version: "2.4 Bavarian Wood"
    };

    localStorage.setItem('gh_legal_accepted', JSON.stringify(complianceData));
    setShowGatoModal(false);
    soundService.playClick();
    
    // GUARANTEED FULLSCREEN TRIGGER ON USER INTERACTION
    try {
        const doc = document.documentElement;
        if (doc.requestFullscreen) {
            doc.requestFullscreen().catch(err => console.log("Fullscreen blocked", err));
        }
    } catch(e) {}

  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-black text-white select-none overflow-hidden font-inter relative">
      {showIntro && <Intro onComplete={handleIntroComplete} />}

      <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-[#22c55e]/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-[#0098d4]/10 blur-[100px] pointer-events-none" />

      <header className="shrink-0 bg-neutral-900/90 backdrop-blur-md border-b border-[#22c55e]/40 px-5 flex justify-between items-center h-24 z-50 shadow-[0_4px_30px_rgba(0,0,0,0.5)] overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-[#22c55e] via-[#0098d4] to-[#22c55e] shadow-[0_0_15px_rgba(0,152,212,0.6)]" />
        
        <button 
          onClick={() => { soundService.playClick(); setShowGatoModal(true); }}
          className="flex flex-col relative text-left active:scale-95 transition-transform outline-none"
        >
          <h1 className="font-sci-fi text-2xl font-black tracking-tighter text-[#22c55e] uppercase italic leading-none drop-shadow-[0_0_15px_rgba(34,197,94,0.8)]">
            Pocket Hornet
          </h1>
          <div className="flex items-center gap-1.5 mt-1">
             <span className="text-[10px] font-black text-white uppercase tracking-[0.1em] italic bg-[#0098d4] px-2 py-0.5 rounded flex items-center gap-1 shadow-[0_0_10px_rgba(0,152,212,0.4)]">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                Bavarian Wood Edition
             </span>
          </div>
        </button>
        
        <div className="flex flex-col items-center justify-center border-2 border-[#0098d4] bg-black/40 px-4 py-2 rounded-2xl min-w-[110px] shadow-[0_0_20px_rgba(0,152,212,0.4)]">
          <span className="text-xl font-sci-fi font-black text-white tabular-nums leading-tight drop-shadow-[0_0_5px_#0098d4]">
            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span className="text-[9px] font-black text-[#0098d4] uppercase tracking-widest border-t border-[#0098d4]/30 w-full text-center py-0.5 mt-0.5">
            {currentTime.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}
          </span>
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative bg-transparent">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,#22c55e10,transparent_70%)] pointer-events-none" />
        
        {view === 'pos' && (
          <POS 
            products={products} 
            teams={teams} 
            setTeams={setTeams}
            paymentMethods={paymentMethods}
            onCheckout={addTransaction}
            onNotify={showNotify}
            recentTransactions={transactions.slice(0, 5)}
          />
        )}
        {view === 'settle' && (
           <Settle 
             transactions={transactions} 
             teams={teams} 
             paymentMethods={paymentMethods} 
             onSettleTeam={settleTeam} 
             onNotify={showNotify} 
             onDeleteTransaction={deleteTransaction}
           />
        )}
        {view === 'stats' && (
          <Stats 
            transactions={transactions} 
            teams={teams} 
            paymentMethods={paymentMethods} 
            expenses={expenses} 
            products={products}
            categories={categories}
            lootConfig={lootConfig}
          />
        )}
        {view === 'admin' && (
          <Admin 
            products={products} setProducts={setProducts} 
            teams={teams} setTeams={setTeams} 
            paymentMethods={paymentMethods} setPaymentMethods={setPaymentMethods}
            categories={categories} setCategories={setCategories}
            lootConfig={lootConfig} setLootConfig={setLootConfig}
            onReset={resetTransactions}
            onUndoLast={undoLastTransaction}
            onDeleteTransaction={deleteTransaction}
            transactions={transactions}
            lastTransaction={transactions[0]}
            onAddCashLog={addCashLog}
          />
        )}
      </main>

      <nav className="shrink-0 bg-neutral-950/95 backdrop-blur-xl border-t border-neutral-800/50 flex justify-around items-stretch h-20 pb-safe z-50 shadow-[0_-4px_30px_rgba(0,0,0,0.8)]">
        {[
          { id: 'pos', icon: Icons.Shop, label: 'Kasse', color: 'text-[#22c55e]', glow: 'shadow-[0_0_20px_rgba(34,197,94,0.3)]' },
          { id: 'settle', icon: Icons.Wallet, label: 'Tribut', color: 'text-[#0098d4]', glow: 'shadow-[0_0_20px_rgba(0,152,212,0.3)]' },
          { id: 'stats', icon: Icons.Chart, label: 'Bericht', color: 'text-[#22c55e]', glow: 'shadow-[0_0_20px_rgba(34,197,94,0.3)]' },
          { id: 'admin', icon: Icons.Settings, label: 'Admin', color: 'text-[#0098d4]', glow: 'shadow-[0_0_20px_rgba(0,152,212,0.3)]' }
        ].map(item => (
          <button
            key={item.id}
            onClick={() => { if(window.navigator.vibrate) window.navigator.vibrate(10); setView(item.id as ViewType); }}
            className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all relative ${view === item.id ? item.color : 'text-neutral-600'}`}
          >
            <item.icon className={`w-6 h-6 transition-all duration-300 ${view === item.id ? `scale-125 ${item.color.replace('text-', 'drop-shadow-')}` : 'scale-100 opacity-50'}`} />
            <span className={`text-[8px] font-black uppercase tracking-widest transition-opacity duration-300 ${view === item.id ? 'opacity-100' : 'opacity-30'}`}>{item.label}</span>
            {view === item.id && (
              <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-1 rounded-t-full ${item.color.replace('text-', 'bg-')} ${item.glow}`} />
            )}
          </button>
        ))}
      </nav>

      {/* RENT PAYMENT PROMPT MODAL */}
      {showRentPrompt && (
        <div className="fixed inset-0 z-[2000] bg-black/95 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in zoom-in duration-300">
           <div className="w-full max-w-sm bg-neutral-900 border-2 border-[#0098d4] rounded-[32px] p-8 shadow-[0_0_50px_rgba(0,152,212,0.3)] text-center relative overflow-hidden">
             {/* Background Scanlines */}
             <div className="absolute inset-0 bg-[linear-gradient(rgba(0,152,212,0.05)_50%,transparent_50%)] bg-[length:100%_4px] pointer-events-none" />
             
             <div className="w-16 h-16 bg-[#0098d4]/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                <Icons.Wallet className="w-8 h-8 text-[#0098d4]" />
             </div>
             
             <h3 className="text-xl font-sci-fi font-black text-white italic uppercase mb-2">Miete Verfügbar</h3>
             <p className="text-[#0098d4] font-black text-xs uppercase tracking-widest mb-6">Kriegskasse hat den Zielwert erreicht.</p>
             
             <div className="bg-black/50 p-4 rounded-xl border border-[#0098d4]/30 mb-8">
               <div className="text-[10px] text-neutral-400 font-bold uppercase mb-1">Mietkosten</div>
               <div className="text-2xl font-black text-white font-sci-fi tabular-nums">{formatPrice(lootConfig.rentCost)}</div>
             </div>

             <div className="flex flex-col gap-3 relative z-10">
               <button 
                 onClick={handlePayRent}
                 className="w-full py-4 bg-[#0098d4] text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-transform"
               >
                 JETZT BUCHEN (AUSGABE)
               </button>
               <button 
                 onClick={() => setShowRentPrompt(false)}
                 className="w-full py-3 bg-transparent text-neutral-500 font-black text-[10px] uppercase tracking-widest active:scale-95 transition-transform"
               >
                 Später erinnern
               </button>
             </div>
           </div>
        </div>
      )}

      {/* --- GATO DYNAMICS CI MODAL (UPDATED VISUALS & TEXT) --- */}
      {showGatoModal && (
        <div className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-2xl overflow-y-auto animate-in fade-in zoom-in duration-300">
          <div className="min-h-screen w-full flex flex-col items-center justify-center py-12 px-4 relative">
            
            {/* NO CLOSE BUTTON - YOU MUST ACCEPT */}

            {/* THE UNIT */}
            <div className="w-full max-w-md flex flex-col items-center">
               <GatoLogo className="w-32 h-32 mb-4 shrink-0" />
               <h2 className="font-sci-fi text-3xl font-black text-white italic tracking-tighter leading-none text-center uppercase">GATO DYNAMICS</h2>
               <p className="text-[10px] font-black text-[#0098d4] uppercase tracking-[0.4em] mt-1 mb-6 text-center">Code with Instinct</p>
            
               <div className="w-12 h-[2px] bg-[#0098d4] shadow-[0_0_10px_#0098d4] mb-8 shrink-0" />

               <div className="w-full space-y-4">
                  
                  {/* BLUE BOX */}
                  <div className="bg-[#0098d4]/10 border border-[#0098d4]/30 p-4 rounded-2xl text-center">
                     <div className="text-[12px] font-black text-white uppercase tracking-widest mb-1">
                        Bavarian Wood Edition
                     </div>
                     <p className="text-[10px] text-[#0098d4] font-bold uppercase tracking-wide">
                        Offline-Optimized Core.
                     </p>
                     <p className="text-[8px] text-neutral-500 font-bold uppercase tracking-widest mt-1">
                        Netz nur für Share nötig.
                     </p>
                  </div>

                  <p className="text-[10px] font-bold text-neutral-400 italic tracking-wide text-center">
                    Made with <span className="text-red-500">♥</span> & Imperial Precision by <span className="text-[#0098d4]">Gato Dynamics</span>.
                  </p>

                  {/* LEGAL TEXT BOX */}
                  <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-[24px] text-[10px] text-neutral-500 font-medium text-left leading-relaxed mt-2 h-[450px] overflow-y-auto scrollbar-hide shadow-2xl">
                    <h4 className="text-white font-black uppercase mb-4 text-[11px] tracking-widest border-b border-neutral-700 pb-2 sticky top-0 bg-neutral-900 z-10">
                      Rechtliche Hinweise & Urheberrecht
                    </h4>
                    
                    <div className="space-y-6 font-mono text-[9px] uppercase tracking-wide text-neutral-400">
                        <div>
                          <strong className="text-white block mb-1">1. GEISTIGES EIGENTUM:</strong>
                          SÄMTLICHE INHALTE DIESER APPLIKATION, INSBESONDERE QUELLCODE, DESIGN-ELEMENTE UND ALGORITHMEN, SIND AUSSCHLIESSLICHES GEISTIGES EIGENTUM VON <span className="text-white">GATO DYNAMICS</span>.
                        </div>

                        <div>
                          <strong className="text-white block mb-1">2. LIZENZ & HAFTUNGSAUSSCHLUSS:</strong>
                          DIESE SOFTWARE IST URHEBERRECHTLICH GESCHÜTZT. JEGLICHE UNAUTORISIERTE VERVIELFÄLTIGUNG, DEKOMPILIERUNG, VERBREITUNG ODER MODIFIKATION IST UNTERSAGT UND WIRD ZIVIL- UND STRAFRECHTLICH VERFOLGT.
                        </div>

                        <div>
                          <strong className="text-white block mb-1">3. SONDERSTATUS & NUTZUNGSRECHTE (GREEN HORNETS LANDSHUT):</strong>
                          ABWEICHEND VON DEN BESTIMMUNGEN IN ZIFFER 1 UND 2 WIRD DEM "PAINTBALL TEAM GREEN HORNETS LANDSHUT" (NACHFOLGEND "LIZENZNEHMER") EIN UNEINGESCHRÄNKTES, JEDOCH NICHT ÜBERTRAGBARES NUTZUNGS- UND VERWERTUNGSRECHT AN DER GEGENSTÄNDLICHEN APPLIKATION EINGERÄUMT. DER LIZENZNEHMER IST DEN EIGENTÜMERN GLEICHGESTELLT. DAS HIER EINGERÄUMTE SONDERRECHT IST JEDOCH PERSONENGEBUNDEN AN DAS KOLLEKTIV "GREEN HORNETS LANDSHUT". EINE ÜBERTRAGUNG, LIZENZIERUNG ODER VERÄUSSERUNG VON EIGENTUMS-, NUTZUNGS- ODER VERWERTUNGSRECHTEN AN DRITTE PARTEIEN IST AUSGESCHLOSSEN UND BLEIBT ALLEINIGES VORRECHT VON GATO DYNAMICS.
                        </div>
                    </div>

                    <div className="text-center border-t border-neutral-800 pt-4 mt-8 flex items-center justify-center gap-2 text-neutral-600 uppercase italic tracking-widest text-[9px] font-bold">
                      <GatoLogo className="w-4 h-4 inline-block opacity-50" />
                      <span>© 2026 GATO DYNAMICS. ALL RIGHTS RESERVED.</span>
                    </div>
                  </div>

                  <button 
                    onClick={handleConfirmLegal}
                    className="w-full px-10 py-5 mt-4 bg-[#0098d4] text-black font-black uppercase text-xs tracking-widest rounded-2xl shadow-[0_0_30px_rgba(0,152,212,0.4)] active:scale-95 transition-transform hover:bg-[#0087bd]"
                  >
                    GELESEN, VERSTANDEN UND AKZEPTIERT
                  </button>
               </div>
            </div>
          </div>
        </div>
      )}

      {notification && (
        <div className="fixed top-28 left-1/2 -translate-x-1/2 z-[100] bg-gradient-to-r from-[#22c55e] to-[#0098d4] text-white px-8 py-4 rounded-2xl font-black text-xs uppercase shadow-[0_0_30px_rgba(0,152,212,0.5)] border border-white/20 animate-in fade-in zoom-in duration-200 flex items-center gap-3">
          <div className="w-2 h-2 bg-white rounded-full animate-ping" />
          {notification}
        </div>
      )}
    </div>
  );
};

export default App;
