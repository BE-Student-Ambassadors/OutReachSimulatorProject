import React, { useEffect, useState } from 'react';
import { CheckCircle2, Package, Truck, ArrowRight } from 'lucide-react';
import { soundEngine } from '../../../audio/soundEngine';
import { type PurchasedMechanicalPart } from '../../../types/robot';

interface DeliveryAnimationModalProps {
  isOpen: boolean;
  orderedParts: PurchasedMechanicalPart[];
  onComplete: () => void;
}

export const DeliveryAnimationModal: React.FC<DeliveryAnimationModalProps> = ({
  isOpen,
  orderedParts,
  onComplete,
}) => {
  const [deliveredCount, setDeliveredCount] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      setDeliveredCount(0);
      return;
    }

    soundEngine.playInstall();

    // Stagger arrival of each component
    const total = orderedParts.length;
    let current = 0;

    const interval = setInterval(() => {
      current++;
      setDeliveredCount(current);
      soundEngine.playClick();

      if (current >= total) {
        clearInterval(interval);
        soundEngine.playInstall();
      }
    }, 450);

    return () => clearInterval(interval);
  }, [isOpen, orderedParts.length]);

  if (!isOpen) return null;

  const allDelivered = deliveredCount >= orderedParts.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-lg bg-slate-950 border border-cyan-500/40 rounded-2xl p-6 shadow-2xl shadow-cyan-950/60 text-white font-mono-num flex flex-col items-center text-center">
        {/* Animated Icon */}
        <div className="relative mb-4">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            {allDelivered ? (
              <CheckCircle2 className="w-9 h-9 text-emerald-400 animate-in zoom-in-75 duration-300" />
            ) : (
              <Truck className="w-8 h-8 text-cyan-400 animate-bounce" />
            )}
          </div>
        </div>

        <span className="text-[11px] uppercase tracking-wider text-cyan-400 font-bold mb-1">
          BOTBAY LOGISTICS DISPATCH
        </span>
        <h2 className="font-display font-black text-2xl mb-1">
          {allDelivered ? '✓ ALL PARTS DELIVERED' : 'ORDER PROCESSING...'}
        </h2>
        <p className="text-xs text-slate-400 mb-5">
          {allDelivered
            ? 'Your purchased components have arrived at the mechanical workshop workbench.'
            : 'Unloading express crates at the pit bay...'}
        </p>

        {/* Delivery Progress Bar */}
        <div className="w-full bg-slate-900 border border-slate-800 rounded-full h-3 mb-5 overflow-hidden p-0.5">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full transition-all duration-300 ease-out"
            style={{
              width: `${(deliveredCount / Math.max(1, orderedParts.length)) * 100}%`,
            }}
          />
        </div>

        {/* Packages List */}
        <div className="w-full space-y-2 mb-6 max-h-56 overflow-y-auto pr-1 text-left">
          {orderedParts.map((part, index) => {
            const isArrived = index < deliveredCount;

            return (
              <div
                key={part.category}
                className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-all duration-300 ${
                  isArrived
                    ? 'bg-slate-900/90 border-emerald-500/40 text-slate-100 shadow-sm'
                    : 'bg-slate-950/60 border-slate-800/60 text-slate-500 opacity-60'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      isArrived ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-600'
                    }`}
                  >
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-[11px] block">{part.name}</span>
                    <span className="text-[9px] uppercase tracking-wider text-slate-400">
                      {part.category} • {part.condition} • {part.weightLb} lb
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  {isArrived ? (
                    <span className="text-emerald-400 font-bold text-[10px] flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> ARRIVED
                    </span>
                  ) : (
                    <span className="text-slate-500 text-[10px]">EN ROUTE...</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Transition CTA */}
        <button
          onClick={() => {
            soundEngine.playClick();
            onComplete();
          }}
          disabled={!allDelivered}
          className={`w-full py-3 rounded-xl font-display font-black text-sm uppercase tracking-wide flex items-center justify-center gap-2 transition-all cursor-pointer ${
            allDelivered
              ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 transform hover:-translate-y-0.5 active:scale-95'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
          }`}
        >
          <span>GO TO WORKBENCH</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
