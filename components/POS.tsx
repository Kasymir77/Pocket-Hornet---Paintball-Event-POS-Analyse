
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Product, Team, Transaction, CartItem, PaymentMethod } from '../types';
import { Icons, formatPrice } from '../constants';
import { soundService } from '../services/audioService';

interface POSProps {
  products: Product[];
  teams: Team[];
  setTeams: React.Dispatch<React.SetStateAction<Team[]>>;
  paymentMethods: PaymentMethod[];
  onCheckout: (tx: Transaction) => void;
  onNotify: (msg: string) => void;
  recentTransactions?: Transaction[];
}

const POS: React.FC<POSProps> = ({ products, teams, setTeams, paymentMethods, onCheckout, onNotify, recentTransactions = [] }) => {
  const activeProducts = products.filter(p => p.active);
  const activeTeams = teams.filter(t => t.active);
  const activePaymentMethods = paymentMethods.filter(pm => pm.active);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [showTeamSelector, setShowTeamSelector] = useState(false);
  const [teamSearchQuery, setTeamSearchQuery] = useState('');
  
  // State für "Freundlich nachfragen" Modal
  const [showCashAskModal, setShowCashAskModal] = useState(false);
  
  // State für Change Calculator (Wechselgeld)
  const [showChangeCalc, setShowChangeCalc] = useState(false);
  const [cashGiven, setCashGiven] = useState('');
  const [pendingCashTx, setPendingCashTx] = useState<{teamId: string, teamName: string} | null>(null);

  // States für neue Team-Erstellung im Modal
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  
  const [feedback, setFeedback] = useState<Record<string, 'added' | 'removed' | null>>({});
  
  // Quick Add Ref (falls später Barcode Scanner kommt)
  const quickInputRef = useRef<HTMLInputElement>(null);
  // Auto-Focus Ref für Change Calc
  const cashInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!showTeamSelector) {
      setTeamSearchQuery('');
      setIsCreatingTeam(false);
      setNewTeamName('');
    }
  }, [showTeamSelector]);

  // Focus Logic für Wechselgeld Rechner
  useEffect(() => {
    if (showChangeCalc && cashInputRef.current) {
        setTimeout(() => cashInputRef.current?.focus(), 100);
    }
  }, [showChangeCalc]);

  // MATH FIX: Rounding to avoid floating point errors
  const rawTotal = cart.reduce((sum, item) => sum + (item.price * item.count), 0);
  const total = Math.round(rawTotal * 100) / 100;

  const filteredTeams = useMemo(() => {
    if (!teamSearchQuery.trim()) return activeTeams;
    const query = teamSearchQuery.toLowerCase();
    return activeTeams.filter(t => t.name.toLowerCase().includes(query));
  }, [activeTeams, teamSearchQuery]);

  // IMPERIAL LOGIC: Check if selected team is exempt from cash payment
  const isInternalTeam = selectedTeamId === 't1' || selectedTeamId === 't2';

  const triggerHaptic = (pattern: number | number[] = 15) => {
    if (window.navigator.vibrate) window.navigator.vibrate(pattern);
  };

  const setButtonFeedback = (id: string, type: 'added' | 'removed') => {
    setFeedback(prev => ({ ...prev, [id]: type }));
    setTimeout(() => {
      setFeedback(prev => ({ ...prev, [id]: null }));
    }, 400);
  };

  const addToCart = (product: Product) => {
    soundService.playShot(); // NEW: MARKIERER SOUND
    triggerHaptic(20);
    setButtonFeedback(product.id, 'added');
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, count: item.count + 1 } : item);
      }
      return [...prev, { ...product, count: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    soundService.playReload(); // NEW: RELOAD SOUND
    triggerHaptic(10);
    setButtonFeedback(productId, 'removed');
    setCart(prev => {
      const existing = prev.find(item => item.id === productId);
      if (existing && existing.count > 1) {
        return prev.map(item => item.id === productId ? { ...item, count: item.count - 1 } : item);
      }
      return prev.filter(item => item.id !== productId);
    });
  };

  const clearCart = () => {
    soundService.playReload(); // NEW: RELOAD SOUND
    triggerHaptic([30, 30]);
    setCart([]);
    setSelectedTeamId(null);
  };

  const clearTeam = (e: React.MouseEvent) => {
    e.stopPropagation();
    soundService.playReload();
    triggerHaptic(10);
    setSelectedTeamId(null);
  };

  // KERN-BUCHUNGS-LOGIK (Separated for reuse)
  const processTransaction = (methodId: string, finalTeamId: string, finalTeamName: string, status: 'paid' | 'open' | 'settled') => {
      // Robust ID generation for rapid-fire usage
      const txId = Date.now() + Math.floor(Math.random() * 1000);
      
      const tx: Transaction = {
        id: txId,
        items: [...cart],
        total: total, // Use the rounded total
        type: methodId,
        teamId: finalTeamId,
        teamName: finalTeamName,
        status: status,
        timestamp: Date.now(),
        dateStr: new Date().toLocaleDateString('de-DE'),
        timeStr: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
      };

      // Play Sound AFTER state update trigger for better feel? No, immediate is better.
      soundService.playSplat(); // NEW: BUNKER HIT SOUND (Success)
      
      onCheckout(tx);
      setCart([]); // Direct clear without sound
      setSelectedTeamId(null);
      // Close Modals
      setShowChangeCalc(false);
      setCashGiven('');
      setPendingCashTx(null);
  };

  // Initialer Klick auf Checkout Button
  const handleCheckoutRequest = (method: PaymentMethod | 'internal') => {
    if (cart.length === 0) return;
    
    // Safety Check: Internal teams CANNOT use normal methods
    if (isInternalTeam && method !== 'internal') {
        soundService.playError();
        onNotify("FEHLER: NUR INTERN MÖGLICH");
        return;
    }

    // Wenn BAR und KEIN Team ausgewählt -> Modal öffnen
    if (method !== 'internal' && method.id === 'cash' && !selectedTeamId) {
        soundService.playClick();
        setShowCashAskModal(true);
        return;
    }

    // Wenn Rechnung (Account) aber kein Team -> Fehler
    if (method !== 'internal' && method.requiresTeam && (!selectedTeamId || selectedTeamId === 'bar')) {
      soundService.playError();
      setShowTeamSelector(true);
      onNotify("TEAM WÄHLEN!");
      return;
    }

    // Standard Checkout Flow (wenn Team gewählt oder Internal)
    const methodId = method === 'internal' ? 'internal' : method.id;
    const teamId = selectedTeamId || 'bar';
    const teamName = selectedTeamId === 'bar' ? 'DIREKTVERKAUF' : (teams.find(t => t.id === selectedTeamId)?.name || 'DIREKTVERKAUF');
    const status = method === 'internal' ? 'paid' : method.initialStatus;

    // --- NEW: BAR RECHNER INTERCEPT ---
    if (methodId === 'cash') {
       setPendingCashTx({ teamId, teamName });
       setShowChangeCalc(true);
       return; 
    }

    processTransaction(methodId, teamId, teamName, status);
  };

  // Aktion: Anonym Buchen (Button im Ask-Modal)
  const handleAnonymCheckout = () => {
     setShowCashAskModal(false);
     // Redirect to Cash Calculator instead of direct booking
     setPendingCashTx({ teamId: 'bar', teamName: 'DIREKTVERKAUF (BAR)' });
     setShowChangeCalc(true);
  };

  // Aktion: Team Wählen (Button im Ask-Modal)
  const handleSelectTeamFromAsk = () => {
     soundService.playClick();
     setShowCashAskModal(false);
     setShowTeamSelector(true);
  };
  
  // Aktion: Finale Buchung aus dem Rechner
  const confirmCashBooking = () => {
      if (!pendingCashTx) return;
      processTransaction('cash', pendingCashTx.teamId, pendingCashTx.teamName, 'paid');
  };

  const handleCreateTeam = () => {
    if (!newTeamName.trim()) return;
    const newTeam: Team = {
      id: `t${Date.now()}`,
      name: newTeamName.trim(),
      active: true
    };
    setTeams(prev => [...prev, newTeam]);
    setSelectedTeamId(newTeam.id);
    soundService.playDing();
    onNotify(`EINHEIT "${newTeamName.toUpperCase()}" REGISTRIERT`);
    setShowTeamSelector(false);
  };

  const selectedTeamName = useMemo(() => {
    if (!selectedTeamId) return "EMPFÄNGER WÄHLEN...";
    if (selectedTeamId === 'bar') return "DIREKTVERKAUF (BAR)";
    return teams.find(t => t.id === selectedTeamId)?.name;
  }, [selectedTeamId, teams]);

  // Calc Logic
  const givenAmount = parseFloat(cashGiven.replace(',', '.')) || 0;
  // MATH FIX: Prevent floating point artifacts (e.g. 4.99999999)
  const changeAmount = Math.round((givenAmount - total) * 100) / 100;

  return (
    <div className="h-full flex flex-col p-2 md:p-3 overflow-hidden">
      
      <div className="shrink-0 mb-3 flex gap-2">
        <button 
          onClick={() => { soundService.playClick(); setShowTeamSelector(true); }}
          className={`flex-1 p-3 rounded-xl border flex justify-between items-center transition-all overflow-hidden ${selectedTeamId ? 'bg-[#0098d4]/10 border-[#0098d4] shadow-[0_0_15px_rgba(0,152,212,0.2)]' : 'bg-neutral-900 border-neutral-800'}`}
        >
          <span className={`text-[11px] font-black uppercase tracking-tight truncate w-full text-left ${selectedTeamId ? 'text-[#0098d4]' : 'text-neutral-500 italic'}`}>
            {selectedTeamName}
          </span>
          <Icons.Wallet className={`w-3.5 h-3.5 shrink-0 ${selectedTeamId ? 'text-[#0098d4]' : 'text-neutral-700'}`} />
        </button>

        {selectedTeamId && (
          <button onClick={clearTeam} className="w-12 bg-red-950/20 border border-red-500/30 rounded-xl flex items-center justify-center text-red-500 active:bg-red-500 active:text-black">✕</button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pb-6 px-0.5">
        {activeProducts.map(product => {
          const count = cart.find(i => i.id === product.id)?.count || 0;
          const status = feedback[product.id];
          let borderClass = count > 0 ? 'border-[#22c55e]' : 'border-neutral-800/80';
          let bgClass = count > 0 ? 'bg-green-950/40' : 'bg-neutral-900/60';
          
          return (
            <button
              key={product.id}
              onClick={() => addToCart(product)}
              onContextMenu={(e) => { e.preventDefault(); removeFromCart(product.id); }}
              className={`relative min-h-[120px] p-4 rounded-[24px] border transition-all duration-300 flex flex-col justify-between items-start text-left shadow-2xl ${bgClass} ${borderClass} active:scale-95`}
            >
              <div className="font-black text-[16px] sm:text-lg leading-tight text-white uppercase pr-4 line-clamp-2 w-full italic">{product.name}</div>
              <div className="w-full text-right pt-2 relative">
                <div className="font-sci-fi text-[11px] sm:text-[12px] font-black text-[#22c55e] leading-none drop-shadow-[0_0_5px_rgba(34,197,94,0.4)] inline-block">
                  {formatPrice(product.price).replace(' €', '')}<span className="text-[8px] ml-0.5 opacity-60">€</span>
                </div>
              </div>
              {count > 0 && <div className="absolute -top-1.5 -right-1.5 w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-black shadow-lg border-2 border-black bg-[#22c55e] text-black">{count}</div>}
            </button>
          );
        })}
      </div>

      {cart.length > 0 && (
        <div className={`shrink-0 rounded-[32px] border p-5 shadow-2xl animate-in slide-in-from-bottom-5 duration-300 ${isInternalTeam ? 'bg-purple-950/20 border-purple-500/30' : 'bg-neutral-950 border-neutral-800'}`}>
          <div className="flex justify-between items-center mb-4">
            <div className="flex flex-col">
              <span className={`text-[7px] font-black uppercase tracking-[0.3em] mb-0.5 italic ${isInternalTeam ? 'text-purple-400' : 'text-neutral-600'}`}>
                 {isInternalTeam ? 'Interner Verbrauch' : 'Tribut'}
              </span>
              <span className="text-3xl font-sci-fi font-black text-white italic leading-none">{formatPrice(total)}</span>
            </div>
            {/* UPDATED CLEAR BUTTON TO TRASH ICON */}
            <button 
              onClick={clearCart} 
              className="p-3 bg-red-950/20 rounded-xl text-red-500 border border-red-900/30 active:bg-red-600 active:text-black flex items-center justify-center gap-2"
            >
              <Icons.Trash className="w-5 h-5" />
            </button>
          </div>
          <div className="flex gap-3">
            {isInternalTeam ? (
              <button 
                 onClick={() => handleCheckoutRequest('internal')} 
                 className="flex-1 py-5 rounded-[22px] font-black text-[12px] uppercase bg-purple-600 text-white shadow-lg active:scale-95 flex flex-col items-center justify-center leading-none gap-1"
              >
                 <span>BUCHUNG: INTERN / ORGA</span>
                 <span className="text-[8px] opacity-70 tracking-wider">KEINE ZAHLUNG</span>
              </button>
            ) : (
              activePaymentMethods.map(method => (
                <button key={method.id} onClick={() => handleCheckoutRequest(method)} className={`flex-1 py-5 rounded-[22px] font-black text-[12px] uppercase transition-all active:scale-95 shadow-lg ${method.id === 'cash' ? 'bg-[#22c55e] text-black' : 'bg-[#0098d4] text-white'}`}>{method.name}</button>
              ))
            )}
          </div>
        </div>
      )}

      {/* --- ASK FOR TEAM MODAL --- */}
      {showCashAskModal && (
        <div className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-md flex items-center justify-center p-6 animate-in zoom-in-95 duration-200">
           <div className="w-full max-w-sm bg-neutral-900 border-2 border-[#22c55e] rounded-[32px] p-8 shadow-[0_0_50px_rgba(34,197,94,0.2)] text-center relative">
              <div className="w-16 h-16 bg-[#22c55e]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                 <Icons.Chart className="w-8 h-8 text-[#22c55e]" />
              </div>
              <h3 className="text-xl font-sci-fi font-black text-white italic uppercase mb-2">Moment mal, Commander!</h3>
              <p className="text-neutral-400 font-bold text-xs uppercase mb-8 leading-relaxed">
                 Frag höflich nach dem Teamnamen für die Statistik! <br/>
                 <span className="text-[#22c55e]">Zwecks (spaßigem) Ranking!</span><br/>
                 Ehre wem Ehre gebührt.
              </p>

              <div className="flex flex-col gap-3">
                 <button 
                    onClick={handleSelectTeamFromAsk}
                    className="w-full py-4 bg-[#0098d4] text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-transform"
                 >
                    Einheit wählen
                 </button>
                 <button 
                    onClick={handleAnonymCheckout}
                    className="w-full py-4 bg-transparent border border-neutral-700 text-neutral-500 rounded-2xl font-black text-[10px] uppercase tracking-[0.1em] active:scale-95 transition-transform hover:bg-neutral-800 hover:text-white"
                 >
                    Kein Team / Anonym
                 </button>
              </div>
           </div>
        </div>
      )}
      
      {/* --- CASH CALCULATOR MODAL --- */}
      {showChangeCalc && (
         <div className="fixed inset-0 z-[400] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6 animate-in slide-in-from-bottom duration-300">
            <div className="w-full max-w-md bg-neutral-900 border-2 border-[#22c55e] rounded-[32px] p-6 shadow-2xl relative">
               <div className="text-center mb-6">
                  <div className="text-[10px] font-black uppercase text-neutral-500 tracking-[0.3em] mb-2">Wechselgeld Rechner</div>
                  <div className="text-4xl font-sci-fi font-black text-white italic">{formatPrice(total)}</div>
                  <p className="text-[10px] font-bold text-[#22c55e] uppercase mt-1">Zu zahlen</p>
               </div>

               <div className="bg-black/50 p-4 rounded-2xl border border-neutral-800 mb-6">
                  <div className="flex justify-between items-center mb-2">
                     <span className="text-[10px] font-black uppercase text-neutral-400">Gegeben (€)</span>
                  </div>
                  <input 
                     ref={cashInputRef}
                     type="number" 
                     inputMode="decimal"
                     value={cashGiven}
                     onChange={(e) => setCashGiven(e.target.value)}
                     placeholder="0.00"
                     className="w-full bg-transparent text-3xl font-mono font-bold text-white outline-none placeholder-neutral-700 text-center border-b border-neutral-700 focus:border-[#22c55e] pb-2 transition-colors"
                  />
               </div>

               <div className="flex justify-between items-end mb-8 px-2">
                  <span className="text-[10px] font-black uppercase text-neutral-500">Rückgeld</span>
                  <div className={`text-2xl font-mono font-black ${changeAmount >= 0 ? 'text-[#22c55e]' : 'text-red-500'}`}>
                     {changeAmount >= 0 ? formatPrice(changeAmount) : "FEHLBETRAG!"}
                  </div>
               </div>

               <div className="flex flex-col gap-3">
                  <button 
                     onClick={confirmCashBooking}
                     className="w-full py-5 bg-[#22c55e] text-black rounded-2xl font-black text-[12px] uppercase tracking-[0.2em] shadow-[0_0_20px_rgba(34,197,94,0.4)] active:scale-95 transition-transform flex items-center justify-center gap-2"
                  >
                     <Icons.Wallet className="w-5 h-5" />
                     ERLEDIGT / IN KASSE BUCHEN
                  </button>
                  <button 
                     onClick={() => { setShowChangeCalc(false); setCashGiven(''); }}
                     className="w-full py-4 bg-transparent text-red-500 border border-red-900/30 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-transform hover:bg-red-900/10"
                  >
                     ABBRUCH
                  </button>
               </div>
            </div>
         </div>
      )}

      {showTeamSelector && (
        <div className="fixed inset-0 z-[200] bg-black/98 backdrop-blur-xl p-5 flex flex-col animate-in fade-in duration-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-sci-fi font-black uppercase italic text-[#22c55e]">Ziel-Bereich</h2>
            <button onClick={() => setShowTeamSelector(false)} className="bg-neutral-900 p-3 rounded-full text-neutral-400 border border-neutral-800 active:scale-90">✕</button>
          </div>
          
          <input type="text" value={teamSearchQuery} onChange={(e) => setTeamSearchQuery(e.target.value)} placeholder="EINHEIT SCANNEN..." className="w-full bg-neutral-900/50 border border-neutral-800 p-4 rounded-2xl text-white font-black uppercase text-xs tracking-widest outline-none mb-4 focus:border-[#22c55e]" />
          
          {/* NEUES TEAM ERSTELLEN SECTION */}
          <div className="mb-6">
            {!isCreatingTeam ? (
              <button 
                onClick={() => { soundService.playClick(); setIsCreatingTeam(true); }}
                className="w-full py-3 rounded-xl border border-dashed border-[#0098d4]/50 text-[#0098d4] font-black text-[10px] uppercase tracking-widest active:bg-[#0098d4]/10 transition-colors"
              >
                + Neue Einheit registrieren
              </button>
            ) : (
              <div className="bg-[#0098d4]/10 border border-[#0098d4]/30 p-3 rounded-xl animate-in zoom-in-95 duration-200">
                <input 
                  autoFocus
                  type="text" 
                  value={newTeamName} 
                  onChange={(e) => setNewTeamName(e.target.value)} 
                  placeholder="NAME DER EINHEIT..." 
                  className="w-full bg-black border border-[#0098d4]/50 p-3 rounded-lg text-white font-black uppercase text-xs mb-3 focus:outline-none focus:border-[#0098d4]"
                />
                <div className="flex gap-2">
                  <button onClick={handleCreateTeam} className="flex-1 bg-[#0098d4] text-white py-2 rounded-lg font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95">Erstellen</button>
                  <button onClick={() => setIsCreatingTeam(false)} className="px-4 bg-black border border-neutral-700 text-neutral-400 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest active:scale-95">X</button>
                </div>
              </div>
            )}
          </div>

          <div className="h-[1px] w-full bg-neutral-800 mb-4" />

          <div className="flex-1 overflow-y-auto space-y-2 pb-20 scrollbar-hide px-1">
            {/* BARZAHLUNG / DIREKTVERKAUF OPTION */}
            {!teamSearchQuery && !isCreatingTeam && (
              <button 
                onClick={() => { soundService.playClick(); setSelectedTeamId('bar'); setShowTeamSelector(false); }} 
                className={`w-full p-5 rounded-[24px] border text-left font-black uppercase text-[14px] italic transition-all mb-4 relative overflow-hidden group ${selectedTeamId === 'bar' ? 'bg-[#22c55e] text-black border-[#22c55e]' : 'bg-neutral-900 border-green-900/30 text-[#22c55e]'}`}
              >
                <div className={`absolute left-0 top-0 w-1 h-full bg-[#22c55e] transition-opacity ${selectedTeamId === 'bar' ? 'opacity-0' : 'opacity-100'}`} />
                DIREKTVERKAUF (BAR)
              </button>
            )}

            {filteredTeams.map(team => (
              <button key={team.id} onClick={() => { soundService.playClick(); setSelectedTeamId(team.id); setShowTeamSelector(false); }} className={`w-full p-5 rounded-[24px] border text-left font-black uppercase text-[14px] italic transition-all ${selectedTeamId === team.id ? 'bg-[#0098d4] text-white border-white' : 'bg-neutral-900/50 border-neutral-800 text-neutral-400'}`}>{team.name}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default POS;
