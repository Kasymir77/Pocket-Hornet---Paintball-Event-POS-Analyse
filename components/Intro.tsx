
import React, { useEffect, useState } from 'react';
import { soundService } from '../services/audioService';

interface IntroProps {
  onComplete: () => void;
}

const GatoLogo = ({ className = "w-24 h-24" }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 40 L35 15 L45 35" stroke="#0098d4" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M80 40 L65 15 L55 35" stroke="#0098d4" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M20 40 C20 40 20 80 50 85 C80 80 80 40 80 40" stroke="#0098d4" strokeWidth="4" strokeLinecap="round" />
    <path d="M35 55 L45 60 L50 55 L55 60 L65 55" stroke="#0098d4" strokeWidth="3" strokeLinecap="round" />
    <path d="M45 70 L50 75 L55 70" stroke="#0098d4" strokeWidth="4" strokeLinecap="round" />
  </svg>
);

const Intro: React.FC<IntroProps> = ({ onComplete }) => {
  const [stage, setStage] = useState(0); // 0: Logos, 1: FadeOut

  useEffect(() => {
    // Sequenz startet sofort automatisch
    const sequenceTimer = setTimeout(() => {
      setStage(1);
      // Kurzer Delay für den Fade-Out Effekt vor onComplete
      setTimeout(() => {
        onComplete();
      }, 800);
    }, 4000); // 4 Sekunden Show-Off

    return () => clearTimeout(sequenceTimer);
  }, [onComplete]);

  return (
    <div className={`fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center transition-all duration-1000 ${stage === 1 ? 'opacity-0 scale-110 blur-2xl' : 'opacity-100'}`}>
      
      <div className="relative flex flex-col items-center justify-center max-w-sm w-full px-6 text-center z-50">
        
        {/* Logos Side by Side */}
        <div className="flex items-center justify-center gap-6 mb-10 animate-in zoom-in-95 fade-in duration-1000">
           <div className="flex flex-col items-center">
             <GatoLogo className="w-16 h-16 md:w-20 md:h-20 drop-shadow-[0_0_20px_#0098d4]" />
             <span className="text-[7px] font-black text-[#0098d4] tracking-[0.3em] uppercase mt-2">Gato Dynamics</span>
           </div>
           
           <div className="h-16 w-[1px] bg-neutral-800" />

           <div className="flex flex-col items-center">
             <div className="text-3xl md:text-4xl font-black italic text-[#39ff14] tracking-tighter drop-shadow-[0_0_20px_rgba(57,255,20,0.4)] leading-none text-left">
               GREEN<br/>HORNETS
             </div>
             <span className="text-[7px] font-black text-[#39ff14] tracking-[0.3em] uppercase mt-2 w-full text-left">Landshut</span>
           </div>
        </div>

        {/* Status Line */}
        <div className="animate-in slide-in-from-bottom-4 fade-in duration-700 delay-500 fill-mode-forwards opacity-0 mb-4">
          <div className="flex items-center gap-2">
             <div className="h-[1px] w-8 bg-neutral-800" />
             <span className="font-black text-[9px] uppercase tracking-[0.5em] text-neutral-500 italic">
               Paintball Event POS
             </span>
             <div className="h-[1px] w-8 bg-neutral-800" />
          </div>
        </div>
        
        {/* Automatischer Ladebalken als Feedback */}
        <div className="w-32 h-[1px] bg-neutral-900 mt-8 relative overflow-hidden">
           <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#39ff14] to-transparent w-1/2 animate-[loading_2s_infinite]" />
        </div>
      </div>

      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>

      <div className="pointer-events-none absolute inset-0 z-[1000] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.02),rgba(0,255,0,0.01),rgba(0,0,255,0.02))] bg-[length:100%_4px,3px_100%]" />
    </div>
  );
};

export default Intro;
