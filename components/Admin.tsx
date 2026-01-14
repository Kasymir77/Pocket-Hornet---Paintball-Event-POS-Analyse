
import React, { useState, useMemo, useRef } from 'react';
import { Product, Team, PaymentMethod, Transaction, CashLogType, LootConfig } from '../types';
import { formatPrice, Icons } from '../constants';
import { soundService } from '../services/audioService';

interface AdminProps {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  teams: Team[];
  setTeams: React.Dispatch<React.SetStateAction<Team[]>>;
  paymentMethods: PaymentMethod[];
  setPaymentMethods: React.Dispatch<React.SetStateAction<PaymentMethod[]>>;
  categories: string[];
  setCategories: React.Dispatch<React.SetStateAction<string[]>>;
  onReset: () => void;
  onUndoLast: () => void;
  lastTransaction?: Transaction;
  onAddCashLog: (amount: number, description: string, type: CashLogType) => void;
  lootConfig: LootConfig;
  setLootConfig: React.Dispatch<React.SetStateAction<LootConfig>>;
  
  // NEW: Full transaction control
  transactions: Transaction[];
  onDeleteTransaction: (id: number) => void;
}

type DialogType = 'confirm' | 'prompt' | 'export' | null;
type AdminSubView = 'dashboard' | 'arsenal' | 'teams' | 'system';

// Imperialer Toggle Switch (Compact)
const ToggleSwitch = ({ active, onToggle, label, color = "bg-green-500" }: { active: boolean, onToggle: () => void, label: string, color?: string }) => (
  <div className="flex items-center gap-2">
    {label && <span className="text-[9px] font-black uppercase text-neutral-500 italic tracking-widest">{label}</span>}
    <button 
      onClick={onToggle}
      className={`w-10 h-5 rounded-full p-0.5 transition-all duration-300 relative ${active ? color : 'bg-neutral-800'}`}
    >
      <div className={`w-4 h-4 bg-white rounded-full shadow-lg transition-all duration-300 transform ${active ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  </div>
);

const Admin: React.FC<AdminProps> = ({ 
  products, setProducts, 
  teams, setTeams, 
  paymentMethods, setPaymentMethods, 
  categories, setCategories,
  onReset, onUndoLast, lastTransaction,
  onAddCashLog,
  lootConfig, setLootConfig,
  transactions, onDeleteTransaction
}) => {
  const [subView, setSubView] = useState<AdminSubView>('dashboard');
  const [selectedFilterCategory, setSelectedFilterCategory] = useState<string>('ALLE');
  
  // State für Finanzen
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [depositAmount, setDepositAmount] = useState('');

  // State für Handbuch
  const [showManual, setShowManual] = useState(false);
  
  // State für neues Transaktions-Protokoll (Master Storno)
  const [showTransactionManager, setShowTransactionManager] = useState(false);
  
  // State für Taschenrechner
  const [showCalculator, setShowCalculator] = useState(false);
  const [calcInput, setCalcInput] = useState('');
  
  // FILTER STATES for Transaction Manager
  const [txSearchTerm, setTxSearchTerm] = useState('');
  const [txFilterStatus, setTxFilterStatus] = useState<'ALL' | 'open' | 'paid' | 'settled'>('ALL');
  const [txFilterType, setTxFilterType] = useState<'ALL' | 'cash' | 'acc' | 'internal'>('ALL');
  const [txMinAmount, setTxMinAmount] = useState('');
  const [txMaxAmount, setTxMaxAmount] = useState('');

  // Hidden File Input Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // DRAG & DROP STATE
  const [draggedProductId, setDraggedProductId] = useState<string | null>(null);

  const [dialog, setDialog] = useState<{
    type: DialogType;
    title: string;
    message: string;
    inputValue?: string;
    isDanger?: boolean;
    onConfirm: (val?: string) => void;
  } | null>(null);

  const askConfirm = (title: string, message: string, onConfirm: () => void, isDanger: boolean = false) => {
    setDialog({ 
      type: 'confirm', 
      title, 
      message, 
      isDanger,
      onConfirm: () => { onConfirm(); setDialog(null); } 
    });
  };

  const askPrompt = (title: string, message: string, initial: string, onConfirm: (val: string) => void) => {
    setDialog({ 
      type: 'prompt', title, message, inputValue: initial, 
      onConfirm: (val) => { if (val) onConfirm(val); setDialog(null); } 
    });
  };

  // --- FILTER LOGIC FOR TRANSACTION MANAGER ---
  const filteredTransactions = useMemo(() => {
     const safeTransactions = Array.isArray(transactions) ? transactions : [];

     return safeTransactions.filter(tx => {
         if (txSearchTerm) {
             const term = txSearchTerm.toLowerCase();
             const itemString = (tx.items || []).map(i => i.name).join(' ').toLowerCase();
             const matchName = (tx.teamName || '').toLowerCase().includes(term);
             const matchItems = itemString.includes(term);
             if (!matchName && !matchItems) return false;
         }

         if (txFilterStatus !== 'ALL' && tx.status !== txFilterStatus) return false;

         if (txFilterType !== 'ALL') {
             if (txFilterType === 'internal' && tx.type === 'internal') {
             } else if (txFilterType === 'cash' && tx.type === 'cash') {
             } else if (txFilterType === 'acc' && tx.type === 'acc') {
             } else {
                 return false;
             }
         }

         if (txMinAmount && tx.total < parseFloat(txMinAmount)) return false;
         if (txMaxAmount && tx.total > parseFloat(txMaxAmount)) return false;

         return true;
     });
  }, [transactions, txSearchTerm, txFilterStatus, txFilterType, txMinAmount, txMaxAmount]);

  // --- CONFIG EXPORT / IMPORT LOGIC ---
  const handleExportConfig = () => {
    const configData = {
      meta: {
        type: "POCKET_HORNET_CONFIG",
        version: "2.4",
        date: new Date().toISOString(),
        exportedBy: "IMPERIAL_ADMIN_DROID"
      },
      payload: {
        products,
        teams,
        paymentMethods,
        categories,
        lootConfig
      }
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(configData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    const fileName = `HORNET_CONFIG_${new Date().toISOString().slice(0, 10)}.json`;
    
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", fileName);
    document.body.appendChild(downloadAnchorNode); 
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; 
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);

        if (!data.meta || data.meta.type !== "POCKET_HORNET_CONFIG" || !data.payload) {
          throw new Error("Ungültiges Dateiformat. Dies ist kein Hornet-Config-Kristall.");
        }

        askConfirm(
          "SYSTEM ÜBERSCHREIBEN?", 
          `Config vom ${new Date(data.meta.date).toLocaleDateString()} laden? Aktuelle Einstellungen (Produkte, Teams) werden ersetzt!`, 
          () => applyImport(data.payload), 
          true
        );

      } catch (err) {
        alert("FEHLER BEIM LESEN: " + (err as Error).message);
      }
    };
    reader.readAsText(file);
  };

  const applyImport = (payload: any) => {
    try {
      if (payload.products) setProducts(payload.products);
      if (payload.teams) setTeams(payload.teams);
      if (payload.paymentMethods) setPaymentMethods(payload.paymentMethods);
      if (payload.categories) setCategories(payload.categories);
      if (payload.lootConfig) setLootConfig(payload.lootConfig);
      
      localStorage.setItem('gh_products', JSON.stringify(payload.products));
      localStorage.setItem('gh_teams', JSON.stringify(teams));
      localStorage.setItem('gh_categories', JSON.stringify(payload.categories));
      
      alert("SYSTEM ERFOLGREICH AKTUALISIERT. RELOAD...");
      window.location.reload();
    } catch (e) {
      console.error(e);
      alert("KRITISCHER FEHLER BEIM IMPORT.");
    }
  };

  // --- FINANZ LOGIC ---
  const handleAddExpenseClick = () => {
    const amount = parseFloat(expenseAmount.replace(',', '.'));
    if (!amount || amount <= 0) return;
    
    // VALIDATION: Description is mandatory
    if (!expenseDesc.trim()) {
        soundService.playError();
        alert("BEFEHL VERWEIGERT: ZWECK ANGEBEN!");
        return;
    }

    onAddCashLog(amount, expenseDesc.trim(), 'expense');
    setExpenseAmount('');
    setExpenseDesc('');
  };

  const handleDepositClick = () => {
    const amount = parseFloat(depositAmount.replace(',', '.'));
    if (!amount || amount <= 0) return;
    onAddCashLog(amount, "Bareinlage", 'deposit');
    setDepositAmount('');
  };

  const handleWithdrawDepositClick = () => {
    const amount = parseFloat(depositAmount.replace(',', '.'));
    if (!amount || amount <= 0) return;
    askConfirm("EINLAGE ZURÜCK?", `${formatPrice(amount)} Wechselgeld an Eigentümer zurückgeben?`, () => {
       onAddCashLog(amount, "Rückzahlung Bareinlage", 'withdraw');
       setDepositAmount('');
    });
  };

  // --- ARTIKEL LOGIC ---
  const filteredProducts = useMemo(() => {
    if (selectedFilterCategory === 'ALLE') return products;
    return products.filter(p => p.category?.toUpperCase() === selectedFilterCategory);
  }, [products, selectedFilterCategory]);

  const updateProduct = (id: string, field: keyof Product, value: any) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const deleteProduct = (id: string, name: string) => {
    askConfirm("ARTIKEL ENTFERNEN?", `"${name.toUpperCase()}" löschen?`, () => {
      setProducts(prev => prev.filter(p => p.id !== id));
    }, true);
  };

  const addProduct = () => {
    // Robust ID
    const newId = `p${Date.now()}${Math.floor(Math.random()*1000)}`;
    const category = selectedFilterCategory === 'ALLE' ? (categories[0] || 'ALLGEMEIN') : selectedFilterCategory;
    setProducts([...products, { id: newId, name: 'Neuer Artikel', price: 0, active: true, category }]);
  };

  // --- DRAG AND DROP HANDLERS ---
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedProductId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); 
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedProductId || draggedProductId === targetId) return;

    const oldIndex = products.findIndex(p => p.id === draggedProductId);
    const newIndex = products.findIndex(p => p.id === targetId);

    if (oldIndex === -1 || newIndex === -1) return;

    const newProducts = [...products];
    const [removed] = newProducts.splice(oldIndex, 1);
    newProducts.splice(newIndex, 0, removed);

    setProducts(newProducts);
    setDraggedProductId(null);
    if(window.navigator.vibrate) window.navigator.vibrate(10);
  };

  // --- BEREICH LOGIC ---
  const handleAddCategory = () => {
    askPrompt("NEUER BEREICH", "Name der Kategorie:", "", (name) => {
      const upper = name.trim().toUpperCase();
      if (!upper || categories.includes(upper)) return;
      setCategories(prev => [...prev, upper].sort());
    });
  };

  const handleRenameCategory = (oldName: string) => {
    askPrompt("BEREICH UMBENENNEN", `Neuer Name für "${oldName}":`, oldName, (newName) => {
      const upper = newName.trim().toUpperCase();
      if (!upper || upper === oldName) return;
      setCategories(prev => prev.map(c => c === oldName ? upper : c).sort());
      setProducts(prev => prev.map(p => p.category?.toUpperCase() === oldName ? { ...p, category: upper } : p));
      if (selectedFilterCategory === oldName) setSelectedFilterCategory(upper);
    });
  };

  const handleDeleteCategory = (catName: string) => {
    if (catName === 'ALLGEMEIN') return;
    askConfirm("BEREICH LÖSCHEN?", `"${catName}" entfernen? Artikel werden nach "ALLGEMEIN" verschoben.`, () => {
      setCategories(prev => prev.filter(c => c !== catName));
      setProducts(prev => prev.map(p => p.category?.toUpperCase() === catName ? { ...p, category: 'ALLGEMEIN' } : p));
      if (selectedFilterCategory === catName) setSelectedFilterCategory('ALLE');
    }, true);
  };

  // --- TEAM LOGIC ---
  const updateTeam = (id: string, field: keyof Team, value: any) => {
    setTeams(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const deleteTeam = (id: string, name: string) => {
    askConfirm("EINHEIT AUFLÖSEN?", `"${name.toUpperCase()}" entfernen?`, () => {
      setTeams(prev => prev.filter(t => t.id !== id));
    }, true);
  };

  const addTeam = () => {
    const newId = `t${Date.now()}${Math.floor(Math.random()*1000)}`;
    setTeams([...teams, { id: newId, name: 'Neues Team', active: true }]);
  };

  const handleFactoryReset = () => {
    askConfirm("TOTALER RESET?", "WIRKLICH ALLES AUF NULL SETZEN?", () => {
      localStorage.clear();
      window.location.reload();
    }, true);
  };

  // --- CALCULATOR LOGIC ---
  const handleCalcInput = (val: string) => {
     soundService.playClick();
     
     // RESET IF ERROR STATE
     if (calcInput === 'Err' && !['C', '='].includes(val)) {
        setCalcInput(val);
        return;
     }

     if (val === 'C') {
        setCalcInput('');
     } else if (val === '=') {
        try {
           // eslint-disable-next-line no-eval
           const result = eval(calcInput.replace(/x/g, '*').replace(/,/g, '.')); 
           setCalcInput(String(Math.round(result * 1000) / 1000)); // Simple rounding
        } catch (e) {
           setCalcInput('Err');
           soundService.playError();
        }
     } else {
        setCalcInput(prev => prev + val);
     }
  };

  // --- MANUAL / PDF GENERATION ---
  const getManualContent = () => {
    return `
      <div style="font-family: 'Helvetica', sans-serif; color: #000; padding: 20px; line-height: 1.5;">
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 20px;">
          <h1 style="margin: 0; font-size: 24px; text-transform: uppercase;">Pocket Hornet</h1>
          <div style="font-size: 12px; font-weight: bold; text-transform: uppercase; color: #666;">Feldhandbuch & Bedienungsanleitung</div>
          <div style="font-size: 10px; margin-top: 5px;">Green Hornets Landshut | Bavarian Wood Edition</div>
        </div>
        ...
      </div>
    `;
  };

  const adminTabs = [
    { id: 'dashboard', label: 'COMMAND', color: 'text-white', border: 'border-white' },
    { id: 'arsenal', label: 'ARSENAL', color: 'text-green-500', border: 'border-green-500' },
    { id: 'teams', label: 'TRUPPEN', color: 'text-[#0098d4]', border: 'border-[#0098d4]' },
    { id: 'system', label: 'SYSTEM', color: 'text-purple-500', border: 'border-purple-500' },
  ];

  return (
    <div className="p-4 h-full overflow-y-auto bg-black pb-32 scrollbar-hide relative flex flex-col">
      <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFileChange} />

      {/* TOP NAVIGATION BAR */}
      <div className="shrink-0 mb-6 sticky top-0 bg-black/90 backdrop-blur-md z-40 pb-2 border-b border-neutral-800">
         <div className="flex gap-2 overflow-x-auto scrollbar-hide py-2">
           {adminTabs.map(tab => (
             <button
               key={tab.id}
               onClick={() => { soundService.playClick(); setSubView(tab.id as AdminSubView); }}
               className={`flex-1 py-3 px-4 rounded-xl border font-black text-[10px] uppercase tracking-widest transition-all whitespace-nowrap ${subView === tab.id ? `bg-neutral-900 ${tab.color} ${tab.border} shadow-[0_0_15px_rgba(255,255,255,0.1)]` : `bg-neutral-950 border-neutral-800/50 ${tab.color.replace('text-', 'text-opacity-40 text-')}`}`}
             >
               {tab.label}
             </button>
           ))}
         </div>
      </div>

      <div className="flex-1 relative">
        {subView === 'dashboard' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-8 text-center pt-2">
              <h2 className="font-sci-fi text-2xl font-black text-white italic tracking-tighter uppercase drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">Command Center</h2>
              <p className="text-[9px] font-black text-neutral-600 uppercase tracking-[0.4em] mt-1 italic">Imperial Admin Protocol</p>
            </div>

            {/* RED ZONE: VOID & SYSTEM INTEGRITY */}
            <div className="mb-6 bg-red-950/20 border-2 border-red-500/30 p-5 rounded-[32px] shadow-2xl relative overflow-hidden">
              {/* Header Area */}
              <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-red-500 mb-6 px-1 flex items-center gap-2 italic">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_red]"></span>
                VOID & CORRECTION SYSTEM
              </h3>

              {/* 1. Quick Void Part */}
              <div className="mb-6">
                 <p className="text-[8px] font-bold text-red-400/60 uppercase tracking-widest mb-2 pl-1">QUICK ACTION: LAST ENTRY</p>
                 {lastTransaction ? (
                    <div className="space-y-3">
                       <div className="bg-black/50 p-3 rounded-2xl border border-red-900/30 flex justify-between items-center text-xs">
                           <span className="text-neutral-400 font-mono">{lastTransaction.timeStr}</span>
                           <span className="text-white font-black uppercase">{lastTransaction.teamName}</span>
                           <span className="text-red-500 font-bold">{formatPrice(lastTransaction.total)}</span>
                       </div>
                       <button 
                        onClick={() => askConfirm("STORNO?", `Letzte Buchung von ${lastTransaction.teamName} (${lastTransaction.items.length} Positionen) stornieren?`, onUndoLast, true)}
                        className="w-full bg-red-600 text-white py-5 rounded-[24px] text-[12px] font-black uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-transform"
                      >
                        LETZTE BUCHUNG LÖSCHEN
                      </button>
                    </div>
                  ) : (
                    <p className="text-[9px] text-neutral-600 font-black uppercase text-center py-2 italic tracking-widest">Keine Logs verfügbar</p>
                  )}
              </div>

              <div className="h-[1px] w-full bg-red-500/20 mb-6" />

              {/* 2. Master Void Part */}
              <div>
                   <p className="text-[8px] font-bold text-red-400/60 uppercase tracking-widest mb-2 pl-1">MASTER LOG ACCESS</p>
                   <button 
                      onClick={() => { soundService.playClick(); setShowTransactionManager(true); }}
                      className="w-full py-5 bg-red-600/10 border border-red-500/50 text-red-500 rounded-[24px] font-black text-[10px] uppercase tracking-[0.2em] shadow-[0_0_20px_rgba(220,38,38,0.15)] active:bg-red-600 active:text-white transition-all flex items-center justify-center gap-3 hover:bg-red-600/20"
                   >
                      <Icons.Settings className="w-5 h-5 drop-shadow-[0_0_8px_rgba(220,38,38,0.8)] animate-pulse" />
                      <span>KOMPLETTÜBERSICHT BUCHUNGEN</span>
                   </button>
              </div>
            </div>
            
            {/* GREEN ZONE: FIELD TOOLS / CALCULATOR */}
            <div className="mb-8 bg-[#22c55e]/10 border-2 border-[#22c55e]/30 p-5 rounded-[32px] shadow-2xl relative overflow-hidden">
               <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-[#22c55e] mb-6 px-1 flex items-center gap-2 italic">
                  <span className="w-2 h-2 bg-[#22c55e] rounded-full animate-pulse shadow-[0_0_10px_#22c55e]"></span>
                  FIELD TOOLS
               </h3>
               <button 
                  onClick={() => { soundService.playClick(); setShowCalculator(true); }}
                  className="w-full py-5 bg-[#22c55e]/10 border border-[#22c55e]/50 text-[#22c55e] rounded-[24px] font-black text-[12px] uppercase tracking-[0.2em] shadow-lg active:bg-[#22c55e] active:text-black transition-all flex items-center justify-center gap-3 hover:bg-[#22c55e]/20"
               >
                  <Icons.Chart className="w-5 h-5 drop-shadow-[0_0_8px_rgba(34,197,94,0.8)] animate-pulse" />
                  <span>TASCHENRECHNER</span>
               </button>
            </div>

            {/* FINANCE OPERATIONS */}
            <div className="mb-8 bg-neutral-900/40 border-2 border-orange-500/30 p-5 rounded-[32px] shadow-2xl">
              <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-orange-400 mb-6 px-1 flex items-center gap-2 italic">
                <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse shadow-[0_0_10px_orange]"></span>
                Finanz-Operationen
              </h3>
              
              <div className="flex flex-col gap-6">
                
                {/* AUSGABEN (Verlust) */}
                <div className="bg-orange-950/10 p-4 rounded-3xl border border-orange-500/10">
                   <div className="text-[8px] font-black uppercase text-orange-600 mb-2 tracking-widest">Operative Ausgaben</div>
                   <div className="flex gap-2 mb-2">
                     <input 
                       type="number" 
                       value={expenseAmount}
                       onChange={(e) => setExpenseAmount(e.target.value)}
                       placeholder="Betrag (€)" 
                       className="w-1/3 bg-black border border-orange-900/50 rounded-2xl px-4 py-3 text-white font-mono font-bold placeholder-neutral-700 outline-none focus:border-orange-500"
                     />
                     <input 
                       type="text" 
                       value={expenseDesc}
                       onChange={(e) => setExpenseDesc(e.target.value)}
                       placeholder="Zweck..." 
                       className="flex-1 bg-black border border-orange-900/50 rounded-2xl px-4 py-3 text-white font-bold uppercase text-xs placeholder-neutral-700 outline-none focus:border-orange-500"
                     />
                  </div>
                  <button 
                    onClick={handleAddExpenseClick}
                    className="w-full bg-orange-600 text-black py-3 rounded-[20px] font-black uppercase tracking-[0.1em] shadow-lg active:scale-95 transition-transform flex flex-col items-center justify-center leading-none gap-1"
                  >
                    <span className="text-[10px]">AUS KASSE (BAR) BEZAHLEN</span>
                    <span className="text-[8px] opacity-75">/ AUSGABE BUCHEN</span>
                  </button>
                </div>

                {/* BAREINLAGE / WECHSELGELD (Cash Flow) */}
                <div className="bg-[#0098d4]/10 p-4 rounded-3xl border border-[#0098d4]/10">
                   <div className="text-[8px] font-black uppercase text-[#0098d4] mb-2 tracking-widest">Wechselgeld / Cash Fund (Kasseneinlage - Entnahme)</div>
                   <div className="flex gap-2 mb-2">
                     <input 
                       type="number" 
                       value={depositAmount}
                       onChange={(e) => setDepositAmount(e.target.value)}
                       placeholder="Betrag (€)" 
                       className="w-full bg-black border border-[#0098d4]/30 rounded-2xl px-4 py-3 text-white font-mono font-bold placeholder-neutral-700 outline-none focus:border-[#0098d4]"
                     />
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={handleDepositClick}
                      className="flex-1 bg-[#0098d4] text-white py-4 rounded-[20px] text-[10px] font-black uppercase tracking-[0.1em] shadow-lg active:scale-95 transition-transform"
                    >
                      Bareinlage (+)
                    </button>
                    <button 
                      onClick={handleWithdrawDepositClick}
                      className="flex-1 bg-red-900/40 text-red-500 border border-red-500/30 py-4 rounded-[20px] text-[10px] font-black uppercase tracking-[0.1em] shadow-lg active:scale-95 transition-transform hover:bg-red-900/60"
                    >
                      BARENTNAHME (-)
                    </button>
                  </div>
                </div>

                {/* HORNETS LOOTBOX CHECKER - REDESIGN GREEN */}
                <div className="bg-[#22c55e]/10 p-6 rounded-[32px] border border-[#22c55e]/30 shadow-[0_0_20px_rgba(34,197,94,0.1)]">
                   <div className="mb-6">
                     <h2 className="text-lg font-sci-fi font-black uppercase text-[#22c55e] italic tracking-tighter text-left">HORNET LOOTBOX CHECKER</h2>
                     <p className="text-[9px] font-bold text-red-500 uppercase tracking-wide mt-1 leading-relaxed opacity-90 text-center border-t border-red-500/20 pt-1">
                       NICHT FÜR BARZAHLUNGEN AUS KASSE!
                     </p>
                   </div>

                   <div className="space-y-4">
                      {/* Row 1: Paint */}
                      <div className="flex items-center justify-between gap-4">
                         <span className="text-[10px] font-black uppercase text-neutral-400">Paint pro Kiste (EK)</span>
                         <input 
                            type="number" 
                            value={lootConfig.paintCostPerBox || ''}
                            onChange={(e) => setLootConfig(prev => ({...prev, paintCostPerBox: parseFloat(e.target.value) || 0}))}
                            className="w-24 bg-black border border-[#22c55e]/50 rounded-xl px-3 py-2 text-xs font-mono text-[#22c55e] outline-none focus:border-[#22c55e] text-right font-bold shadow-inner"
                            placeholder="0.00"
                         />
                      </div>
                      
                      {/* Row 2: Food */}
                      <div className="flex items-center justify-between gap-4">
                         <span className="text-[10px] font-black uppercase text-neutral-400">Einkauf Lebensmittel</span>
                         <input 
                            type="number" 
                            value={lootConfig.foodCost || ''}
                            onChange={(e) => setLootConfig(prev => ({...prev, foodCost: parseFloat(e.target.value) || 0}))}
                            className="w-24 bg-black border border-[#22c55e]/50 rounded-xl px-3 py-2 text-xs font-mono text-[#22c55e] outline-none focus:border-[#22c55e] text-right font-bold shadow-inner"
                            placeholder="0.00"
                         />
                      </div>

                      {/* Row 3: CUSTOM FIELD */}
                      <div className="flex items-center justify-between gap-3">
                         <input 
                            type="text" 
                            value={lootConfig.customCostName || ''}
                            onChange={(e) => setLootConfig(prev => ({...prev, customCostName: e.target.value}))}
                            placeholder="FREI BESCHRIFTBAR"
                            className="flex-1 bg-transparent border-b border-neutral-700 px-0 py-1 text-[10px] font-black uppercase text-neutral-400 outline-none focus:border-[#22c55e] placeholder-neutral-700"
                         />
                         <input 
                            type="number" 
                            value={lootConfig.customCostAmount || ''}
                            onChange={(e) => setLootConfig(prev => ({...prev, customCostAmount: parseFloat(e.target.value) || 0}))}
                            className="w-24 bg-black border border-[#22c55e]/50 rounded-xl px-3 py-2 text-xs font-mono text-[#22c55e] outline-none focus:border-[#22c55e] text-right font-bold shadow-inner"
                            placeholder="0.00"
                         />
                      </div>

                      {/* SEPARATOR */}
                      <div className="pt-4 border-t border-[#22c55e]/20 mt-4 space-y-4">
                         
                         {/* Row 4: Rent/Event (Moved Down) */}
                         <div className="flex items-center justify-between gap-4">
                             <span className="text-[10px] font-black uppercase text-neutral-400">PACHT / EVENTKOSTEN</span>
                             <input 
                                type="number" 
                                value={lootConfig.rentCost || ''}
                                onChange={(e) => setLootConfig(prev => ({...prev, rentCost: parseFloat(e.target.value) || 0}))}
                                className="w-24 bg-black border border-[#22c55e]/50 rounded-xl px-3 py-2 text-xs font-mono text-[#22c55e] outline-none focus:border-[#22c55e] text-right font-bold shadow-inner"
                                placeholder="0.00"
                             />
                         </div>

                         <div className="flex flex-col gap-2">
                             <ToggleSwitch 
                                active={lootConfig.active}
                                onToggle={() => setLootConfig(prev => ({...prev, active: !prev.active}))}
                                label="BUCHUNGSAUTOMATIK"
                                color="bg-[#22c55e]"
                             />
                             <div className="flex justify-between items-center px-2">
                                <span className="text-[8px] font-black uppercase text-neutral-500">Aktueller Status</span>
                                <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${lootConfig.rentPaid ? 'text-green-500 bg-green-900/20' : 'text-neutral-500 bg-neutral-800'}`}>
                                   {lootConfig.rentPaid ? "BEREITS BEZAHLT" : "OFFEN"}
                                </span>
                             </div>
                         </div>
                      </div>

                   </div>
                </div>

              </div>
            </div>

            <div className="mb-8">
               <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-500 mb-3 px-1 italic">Help & Intel</h3>
               <button 
                 onClick={() => setShowManual(true)}
                 className="w-full bg-blue-900/20 border border-blue-500/30 py-5 rounded-[24px] text-[12px] font-black uppercase text-blue-400 tracking-widest shadow-lg active:scale-95 flex items-center justify-center gap-2"
               >
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                 HANDBUCH & ANLEITUNG
               </button>
            </div>
          </div>
        )}

        {subView === 'arsenal' && (
          <div className="animate-in fade-in slide-in-from-right-8 duration-300 pb-20">
             
             {/* HEADER AREA */}
             <div className="mb-8">
                <h2 className="font-sci-fi text-2xl font-black text-green-500 italic uppercase">Arsenal</h2>
                <p className="text-[9px] font-black text-neutral-600 uppercase tracking-[0.4em]">Produkt & Lagerverwaltung</p>
             </div>

             {/* 1. SECTOR CONTROL (AMBER) */}
             <div className="bg-amber-500/10 border-2 border-amber-500/30 p-6 rounded-[32px] mb-8 shadow-2xl relative overflow-hidden">
                <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-amber-500 mb-6 px-1 flex items-center gap-2 italic">
                   <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse shadow-[0_0_10px_orange]"></span>
                   SEKTOREN KONTROLLE
                </h3>

                <div className="flex justify-between items-center mb-3">
                   {selectedFilterCategory !== 'ALLE' ? (
                      <div className="flex gap-2 w-full justify-end">
                         <button onClick={() => handleRenameCategory(selectedFilterCategory)} className="text-[9px] font-bold text-neutral-400 bg-neutral-800 px-4 py-2 rounded-xl border border-neutral-700 hover:text-white active:scale-95">UMBENENNEN</button>
                         <button onClick={() => handleDeleteCategory(selectedFilterCategory)} className="text-[9px] font-bold text-red-500 bg-red-900/20 px-4 py-2 rounded-xl border border-red-900/30 hover:bg-red-900 active:scale-95">LÖSCHEN</button>
                      </div>
                   ) : (
                      <div className="text-[9px] text-neutral-600 font-bold uppercase italic text-right w-full">Wähle eine Gruppe für Optionen</div>
                   )}
                </div>

                <div className="flex flex-col gap-4">
                   <div className="relative w-full">
                      <select
                         value={selectedFilterCategory}
                         onChange={(e) => setSelectedFilterCategory(e.target.value)}
                         className="w-full bg-black border border-amber-500/50 rounded-2xl pl-4 pr-10 py-4 text-white font-black uppercase text-xs appearance-none outline-none focus:border-amber-500 transition-colors shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]"
                      >
                         <option value="ALLE">:: ARTIKELGRUPPEN (Übersicht) ::</option>
                         {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                         ))}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-amber-500 text-[10px]">▼</div>
                   </div>
                   
                   <button 
                     onClick={handleAddCategory}
                     className="w-full bg-amber-500 text-black px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-[0_0_15px_rgba(245,158,11,0.4)] active:scale-95 hover:bg-white transition-all whitespace-nowrap"
                   >
                     + Neue Artikelgruppe
                   </button>
                </div>
             </div>

             {/* 2. PRODUCT MANAGEMENT (GREEN) */}
             <div className="bg-green-500/10 border-2 border-green-500/30 p-6 rounded-[32px] mb-8 shadow-2xl relative overflow-hidden">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                   <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-green-500 px-1 flex items-center gap-2 italic">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_lime]"></span>
                      ARTIKELVERWALTUNG
                   </h3>
                   
                   <button 
                     onClick={addProduct}
                     className="bg-green-600 text-black px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-[0_0_15px_rgba(34,197,94,0.4)] active:scale-95 hover:bg-white transition-all w-full sm:w-auto"
                   >
                     + Neuer Artikel
                   </button>
                </div>

                {/* PRODUCT LIST - COMPACT MODE */}
                <div className="space-y-2">
                  {filteredProducts.map(p => (
                    <div 
                      key={p.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, p.id)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, p.id)}
                      className={`bg-neutral-900 border p-2 rounded-xl flex items-center gap-2 group transition-all ${p.active ? 'border-neutral-800' : 'border-red-900/30 opacity-60'}`}
                    >
                      {/* Drag Handle - Compact */}
                      <div className="cursor-move text-neutral-700 hover:text-white p-1 shrink-0">
                        <Icons.DragHandle className="w-4 h-4" />
                      </div>
                      
                      {/* Main Content Area */}
                      <div className="flex-1 min-w-0 flex flex-col gap-1">
                        <input 
                          type="text" 
                          value={p.name} 
                          onChange={(e) => updateProduct(p.id, 'name', e.target.value)} 
                          className="bg-transparent text-white font-black uppercase text-xs w-full outline-none border-b border-transparent focus:border-green-500 placeholder-neutral-700 truncate py-1"
                          placeholder="NAME"
                        />
                        <div className="flex items-center gap-2">
                           <select 
                             value={p.category || 'ALLGEMEIN'}
                             onChange={(e) => updateProduct(p.id, 'category', e.target.value)}
                             className="bg-black/30 text-[9px] font-bold text-neutral-400 uppercase rounded px-1 py-0.5 outline-none w-full max-w-[120px]"
                           >
                              {categories.map(c => <option key={c} value={c}>{c}</option>)}
                           </select>
                        </div>
                      </div>

                      {/* Right Side - Compact */}
                      <div className="flex items-center gap-2 shrink-0">
                         <div className="flex flex-col items-center">
                            <span className="text-[6px] font-black text-neutral-600 uppercase mb-0.5 tracking-wider">PREIS</span>
                            <input 
                                type="number"
                                value={p.price}
                                onChange={(e) => updateProduct(p.id, 'price', parseFloat(e.target.value))}
                                className="w-12 bg-black/50 border border-neutral-700 rounded px-1 py-1 text-center text-green-500 font-mono font-bold text-xs outline-none focus:border-green-500"
                            />
                         </div>
                         
                         <div className="scale-75 origin-center">
                           <ToggleSwitch 
                              active={p.active} 
                              onToggle={() => updateProduct(p.id, 'active', !p.active)} 
                              label="" 
                           />
                         </div>
                         
                         <button 
                            onClick={() => deleteProduct(p.id, p.name)} 
                            className="w-6 h-6 flex items-center justify-center rounded text-red-900 hover:bg-red-900/20 hover:text-red-500 transition-colors"
                         >
                            <Icons.Trash className="w-3 h-3" />
                         </button>
                      </div>
                    </div>
                  ))}
                  {filteredProducts.length === 0 && <div className="text-center py-10 text-neutral-700 font-black uppercase text-[10px]">Keine Artikel in diesem Sektor</div>}
                </div>
             </div>
          </div>
        )}

        {/* ... Rest of components/Admin.tsx remains unchanged ... */}
        {subView === 'teams' && (
          <div className="animate-in fade-in slide-in-from-right-8 duration-300 pb-20">
             {/* ... Team Content ... */}
             <div className="flex justify-between items-end mb-6">
               <div>
                  <h2 className="font-sci-fi text-2xl font-black text-[#0098d4] italic uppercase">Truppen</h2>
                  <p className="text-[9px] font-black text-neutral-600 uppercase tracking-[0.4em]">Einheiten Verwaltung</p>
               </div>
               <button 
                 onClick={addTeam}
                 className="bg-[#0098d4] text-white px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95"
               >
                 + Neue Einheit
               </button>
             </div>

             <div className="space-y-3">
               {teams.map(t => (
                 <div key={t.id} className="bg-neutral-900/80 border border-neutral-800 p-4 rounded-2xl flex items-center justify-between gap-4">
                    <div className="flex-1">
                       <input 
                         type="text"
                         value={t.name}
                         onChange={(e) => updateTeam(t.id, 'name', e.target.value)}
                         className="bg-transparent text-white font-black uppercase text-sm w-full outline-none border-b border-transparent focus:border-[#0098d4] placeholder-neutral-600 py-1"
                         placeholder="TEAM NAME"
                       />
                       <div className="h-[1px] w-full bg-neutral-800 mt-1" />
                    </div>
                    <div className="flex items-center gap-4">
                       <ToggleSwitch 
                          active={t.active}
                          onToggle={() => updateTeam(t.id, 'active', !t.active)}
                          label={t.active ? "AKTIV" : "INAKTIV"}
                          color="bg-[#0098d4]"
                       />
                       <button onClick={() => deleteTeam(t.id, t.name)} className="text-red-900 hover:text-red-500 p-2"><Icons.Trash className="w-5 h-5" /></button>
                    </div>
                 </div>
               ))}
             </div>
          </div>
        )}
        
        {subView === 'system' && (
          <div className="animate-in fade-in slide-in-from-right-8 duration-300 pb-20">
             <h2 className="font-sci-fi text-2xl font-black text-purple-500 italic uppercase mb-6">System Core</h2>
             {/* ... System Content ... */}
             <div className="bg-neutral-900/50 border border-purple-900/30 p-5 rounded-[24px] mb-6">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-purple-400 mb-4">Datentransfer</h3>
                <div className="flex gap-4">
                   <button onClick={handleExportConfig} className="flex-1 bg-black border border-neutral-800 py-4 rounded-xl text-white font-black uppercase text-[10px] tracking-widest hover:border-purple-500">
                      Export Config (JSON)
                   </button>
                   <button onClick={handleImportClick} className="flex-1 bg-purple-900/20 border border-purple-500/30 py-4 rounded-xl text-purple-400 font-black uppercase text-[10px] tracking-widest hover:bg-purple-900/40">
                      Import Config
                   </button>
                </div>
             </div>

             <div className="bg-red-950/10 border border-red-900/30 p-5 rounded-[24px]">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-red-500 mb-4 flex items-center gap-2">
                   <Icons.Trash className="w-4 h-4" /> Danger Zone
                </h3>
                <div className="space-y-3">
                   <button onClick={() => askConfirm("KASSE NULLEN?", "Alle Umsätze & Ausgaben werden gelöscht! Produkte & Teams bleiben.", onReset, true)} className="w-full py-4 rounded-xl border border-red-900/50 text-red-500 font-black uppercase text-[10px] tracking-widest hover:bg-red-900/20">
                      Tagessatz zurücksetzen (Kasse Nullen)
                   </button>
                   <button onClick={handleFactoryReset} className="w-full py-4 rounded-xl bg-red-900 text-white font-black uppercase text-[10px] tracking-widest hover:bg-red-800 shadow-[0_0_20px_rgba(127,29,29,0.4)]">
                      WERKSEINSTELLUNG (TOTAL RESET)
                   </button>
                </div>
             </div>
             
             <div className="mt-8 text-center">
               <p className="text-[8px] font-mono text-neutral-600">
                  SYSTEM VERSION 2.4-BW | BUILD 2026-05-12 <br/>
                  IMPERIAL CODING STANDARDS APPLIED
               </p>
             </div>
          </div>
        )}

      </div>

      {/* --- MODALS (Unchanged) --- */}
      {showManual && (
        <div className="fixed inset-0 z-[200] bg-white text-black overflow-y-auto animate-in slide-in-from-bottom duration-300">
           <button 
             onClick={() => setShowManual(false)} 
             className="fixed top-4 right-4 bg-black text-white w-10 h-10 rounded-full font-bold flex items-center justify-center shadow-lg active:scale-90 z-50"
           >✕</button>
           <div dangerouslySetInnerHTML={{ __html: getManualContent() }} />
        </div>
      )}

      {/* ... Other modals (Calculator, Transaction Manager, Dialog) same as before ... */}
      {/* 2. CALCULATOR MODAL */}
      {showCalculator && (
         <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center pointer-events-none">
            <div className="w-full max-w-sm bg-neutral-900 border border-neutral-700 rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl pointer-events-auto animate-in slide-in-from-bottom duration-300">
               <div className="flex justify-between items-center mb-6">
                  <h3 className="text-sm font-black uppercase text-neutral-500 tracking-widest">Taschenrechner</h3>
                  <button onClick={() => setShowCalculator(false)} className="text-neutral-500 p-2">✕</button>
               </div>
               
               <div className="bg-black border border-neutral-800 rounded-2xl p-4 mb-4 text-right">
                  <div className="text-3xl font-mono text-white font-bold tracking-wider h-10">{calcInput || '0'}</div>
               </div>

               <div className="grid grid-cols-4 gap-3">
                  {['7','8','9','/','4','5','6','x','1','2','3','-','C','0','=','+'].map(btn => (
                     <button 
                        key={btn}
                        onClick={() => handleCalcInput(btn)}
                        className={`h-16 rounded-2xl font-black text-xl shadow-lg active:scale-95 transition-all
                           ${btn === 'C' ? 'bg-red-900/20 text-red-500 border border-red-900/30' : 
                             btn === '=' ? 'bg-green-600 text-black' : 
                             ['/','x','-','+'].includes(btn) ? 'bg-neutral-800 text-[#0098d4]' : 'bg-neutral-800/50 text-white'
                           }`}
                     >
                        {btn}
                     </button>
                  ))}
               </div>
            </div>
         </div>
      )}

      {/* 3. TRANSACTION MANAGER (MASTER VOID) */}
      {showTransactionManager && (
         <div className="fixed inset-0 z-[150] bg-neutral-950 flex flex-col animate-in slide-in-from-bottom duration-300">
            <div className="p-5 border-b border-neutral-800 flex justify-between items-center bg-neutral-900">
               <div>
                  <h2 className="text-lg font-sci-fi font-black text-white italic uppercase">Master Protokoll</h2>
                  <p className="text-[9px] text-neutral-500 font-black uppercase tracking-widest">Alle Buchungen verwalten</p>
               </div>
               <button onClick={() => setShowTransactionManager(false)} className="w-10 h-10 bg-neutral-800 rounded-full text-neutral-400">✕</button>
            </div>

            {/* FILTERS */}
            <div className="p-4 bg-neutral-900 border-b border-neutral-800 space-y-3">
               <input 
                  type="text" 
                  value={txSearchTerm}
                  onChange={(e) => setTxSearchTerm(e.target.value)}
                  placeholder="SUCHE (Team, ID, Artikel)..."
                  className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-white font-bold text-xs outline-none focus:border-red-500"
               />
               <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  <select 
                     value={txFilterStatus} 
                     onChange={(e:any) => setTxFilterStatus(e.target.value)} 
                     className="bg-neutral-800 text-white text-[10px] font-bold uppercase rounded-lg px-3 py-2 outline-none"
                  >
                     <option value="ALL">Status: Alle</option>
                     <option value="paid">Bezahlt</option>
                     <option value="open">Offen</option>
                     <option value="settled">Beglichen</option>
                  </select>
                  <select 
                     value={txFilterType} 
                     onChange={(e:any) => setTxFilterType(e.target.value)} 
                     className="bg-neutral-800 text-white text-[10px] font-bold uppercase rounded-lg px-3 py-2 outline-none"
                  >
                     <option value="ALL">Typ: Alle</option>
                     <option value="cash">Bar</option>
                     <option value="acc">Rechnung</option>
                     <option value="internal">Intern</option>
                  </select>
               </div>
            </div>

            {/* LIST */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
               {filteredTransactions.map(tx => (
                  <div key={tx.id} className="bg-neutral-900/50 border border-neutral-800 p-4 rounded-xl flex flex-col gap-2">
                     <div className="flex justify-between items-start">
                        <div>
                           <div className="text-[10px] font-mono text-neutral-500">{tx.dateStr} {tx.timeStr}</div>
                           <div className="text-sm font-black text-white uppercase">{tx.teamName}</div>
                           <div className="text-[10px] text-neutral-400">{tx.items.length} Positionen</div>
                        </div>
                        <div className="text-right">
                           <div className="text-lg font-mono font-bold text-white">{formatPrice(tx.total)}</div>
                           <div className={`text-[9px] font-black uppercase px-1.5 rounded ${tx.status === 'open' ? 'bg-red-900/30 text-red-500' : 'bg-green-900/30 text-green-500'}`}>{tx.status}</div>
                        </div>
                     </div>
                     
                     <div className="h-[1px] bg-neutral-800 my-1" />
                     
                     <div className="flex justify-between items-center">
                        <div className="text-[9px] text-neutral-600 truncate max-w-[200px]">{tx.items.map(i => i.name).join(', ')}</div>
                        <button 
                           onClick={() => askConfirm("EINTRAG LÖSCHEN?", `Buchung ${tx.id} endgültig entfernen?`, () => onDeleteTransaction(tx.id), true)}
                           className="bg-red-950/30 border border-red-900/50 text-red-500 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-red-900 hover:text-white"
                        >
                           LÖSCHEN
                        </button>
                     </div>
                  </div>
               ))}
               {filteredTransactions.length === 0 && <div className="text-center py-10 text-neutral-600 font-bold text-xs uppercase">Keine Daten gefunden</div>}
            </div>
         </div>
      )}

      {/* 4. DIALOG MODAL */}
      {dialog && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in zoom-in-95 duration-200">
           <div className={`w-full max-w-sm bg-neutral-900 border-2 rounded-[32px] p-8 shadow-2xl relative ${dialog.isDanger ? 'border-red-600' : 'border-[#0098d4]'}`}>
             <h3 className={`text-xl font-sci-fi font-black italic uppercase mb-2 ${dialog.isDanger ? 'text-red-500' : 'text-[#0098d4]'}`}>{dialog.title}</h3>
             <p className="text-neutral-300 font-bold text-xs uppercase mb-6 leading-relaxed">{dialog.message}</p>
             
             {dialog.type === 'prompt' && (
                <input 
                  autoFocus
                  type="text" 
                  defaultValue={dialog.inputValue}
                  className="w-full bg-black border border-neutral-700 p-4 rounded-xl text-white font-bold mb-6 outline-none focus:border-white"
                  onKeyDown={(e) => { if(e.key === 'Enter') dialog.onConfirm(e.currentTarget.value); }}
                />
             )}

             <div className="flex flex-col gap-3">
               <button 
                 onClick={() => {
                    // Bei Prompt muss Value gelesen werden, hier vereinfacht
                    if (dialog.type === 'confirm') dialog.onConfirm();
                    else {
                       // Hacky way to submit via button for prompt
                       const input = document.querySelector('input[type="text"]') as HTMLInputElement;
                       if (input) dialog.onConfirm(input.value);
                    }
                 }}
                 className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg active:scale-95 ${dialog.isDanger ? 'bg-red-600 text-white' : 'bg-[#0098d4] text-white'}`}
               >
                 BESTÄTIGEN
               </button>
               <button 
                 onClick={() => setDialog(null)}
                 className="w-full py-4 bg-transparent text-neutral-500 border border-neutral-800 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 hover:bg-neutral-800"
               >
                 ABBRUCH
               </button>
             </div>
           </div>
        </div>
      )}

    </div>
  );
};

export default Admin;
