import { AlertTriangle, Check, Cpu, Sparkles, Wrench, X } from 'lucide-react';
import React, { useState } from 'react';
import { soundEngine } from '../../audio/soundEngine';
import { inventorAI } from '../../services/inventorAI';
import { type CustomComponentSpec } from '../../types/robot';

interface InventorLabModalProps {
  onClose: () => void;
  onInstallCustomComponent: (spec: CustomComponentSpec) => void;
}

const EXAMPLE_PROMPTS = [
  'Make something that protects my wheels and pushes The Bull.',
  'I want two curved arms that grab the other robot.',
  'Give me a lightweight weapon that hits from the side.',
  'I want something weird that can help flip the boss.',
  'Make an indestructible weapon that weighs nothing and destroys everything.',
];

export const InventorLabModal: React.FC<InventorLabModalProps> = ({
  onClose,
  onInstallCustomComponent,
}) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSpec, setGeneratedSpec] = useState<CustomComponentSpec | null>(null);

  const handleSynthesize = async (textToUse?: string) => {
    const query = (textToUse ?? prompt).trim();
    if (!query) return;
    soundEngine.playClick();
    setIsGenerating(true);

    // Brief synthesis animation delay for tactile feel
    await new Promise((r) => setTimeout(r, 320));
    const result = await inventorAI.generateComponent(query);
    setGeneratedSpec(result);
    setIsGenerating(false);
    soundEngine.playInstall();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-fade-in">
      <div className="holo-panel holo-glow-cyan w-full max-w-3xl rounded-2xl border border-cyan-500/40 p-6 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/25 to-purple-500/25 border border-cyan-400/40 flex items-center justify-center text-cyan-300">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-extrabold text-white tracking-wide flex items-center gap-2">
                ✨ INVENTOR LAB
                <span className="text-[11px] font-mono-num px-2.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-400/30 text-cyan-300">
                  AI ENGINEERING ASSISTANT
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Describe a custom combat attachment. The engineering solver will synthesize a
                3D assembly and enforce real physical tradeoffs.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Prompt Input */}
        <div className="mb-4">
          <label className="block text-xs font-mono-num uppercase tracking-wider text-cyan-300 mb-2">
            DESCRIBE YOUR CUSTOM ATTACHMENT IDEA
          </label>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSynthesize();
              }}
              placeholder="e.g., I want two curved arms that grab The Bull..."
              className="flex-1 rounded-xl bg-slate-900/95 border border-slate-700 focus:border-cyan-400 focus:outline-none px-4 py-3 text-sm text-white placeholder-slate-500"
            />
            <button
              onClick={() => handleSynthesize()}
              disabled={!prompt.trim() || isGenerating}
              className="cursor-pointer px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-sky-400 hover:from-cyan-300 hover:to-sky-300 disabled:opacity-40 text-slate-950 font-display font-extrabold text-sm tracking-wide shrink-0"
            >
              {isGenerating ? 'SYNTHESIZING...' : 'GENERATE PART'}
            </button>
          </div>
        </div>

        {/* Quick Example Chips */}
        <div className="mb-6">
          <div className="text-[11px] font-mono-num uppercase tracking-wider text-slate-400 mb-2">
            TRY AN EXAMPLE PROMPT:
          </div>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_PROMPTS.map((ex) => (
              <button
                key={ex}
                onClick={() => {
                  setPrompt(ex);
                  handleSynthesize(ex);
                }}
                className="cursor-pointer text-left text-xs px-3 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 hover:border-cyan-500/40 text-slate-300 transition-colors"
              >
                &ldquo;{ex}&rdquo;
              </button>
            ))}
          </div>
        </div>

        {/* Generated Component Result */}
        {generatedSpec && (
          <div className="rounded-2xl bg-slate-900/95 border border-cyan-500/40 p-5 animate-slide-up">
            {generatedSpec.constraintExplanation && (
              <div className="mb-4 rounded-xl bg-amber-500/15 border border-amber-500/40 p-3.5 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-200 leading-relaxed">
                  <strong className="block font-display text-amber-300 uppercase tracking-wider mb-0.5">
                    NO CHEAT CODES — PHYSICAL CONSTRAINTS ENFORCED
                  </strong>
                  {generatedSpec.constraintExplanation}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-3.5 mb-4">
              <div>
                <div className="text-[11px] font-mono-num uppercase tracking-widest text-cyan-400 mb-0.5 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5" /> PROCEDURAL {generatedSpec.category.toUpperCase()}{' '}
                  BLUEPRINT
                </div>
                <h3 className="font-display text-2xl font-black text-white">
                  {generatedSpec.name}
                </h3>
                <p className="text-xs text-slate-300 mt-1">{generatedSpec.description}</p>
              </div>

              <div className="rounded-xl bg-slate-950 border border-cyan-500/30 px-4 py-2 text-right">
                <div className="text-[10px] font-mono-num text-slate-400 uppercase">MASS</div>
                <div className="font-mono-num text-xl font-extrabold text-cyan-300">
                  {generatedSpec.mass.toFixed(1)} LB
                </div>
              </div>
            </div>

            {/* Key Engineering Budget Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
              <div className="rounded-lg bg-slate-950/90 border border-slate-800 p-2.5">
                <div className="text-[10px] font-mono-num text-slate-400 uppercase">
                  IMPACT / ENERGY
                </div>
                <div className="font-mono-num text-sm font-bold text-white mt-0.5">
                  {generatedSpec.weaponEnergyPotential.toLocaleString()} J (
                  {generatedSpec.impactType.toUpperCase()})
                </div>
              </div>
              <div className="rounded-lg bg-slate-950/90 border border-slate-800 p-2.5">
                <div className="text-[10px] font-mono-num text-slate-400 uppercase">
                  PEAK POWER DRAW
                </div>
                <div className="font-mono-num text-sm font-bold text-white mt-0.5">
                  {generatedSpec.powerDraw.toFixed(2)} kW
                </div>
              </div>
              <div className="rounded-lg bg-slate-950/90 border border-slate-800 p-2.5">
                <div className="text-[10px] font-mono-num text-slate-400 uppercase">
                  DURABILITY
                </div>
                <div className="font-mono-num text-sm font-bold text-white mt-0.5">
                  {generatedSpec.durability >= 1.15
                    ? 'HIGH'
                    : generatedSpec.durability <= 0.9
                    ? 'MODERATE'
                    : 'STANDARD'}
                </div>
              </div>
              <div className="rounded-lg bg-slate-950/90 border border-slate-800 p-2.5">
                <div className="text-[10px] font-mono-num text-slate-400 uppercase">
                  RECOIL / COMPLEXITY
                </div>
                <div className="font-mono-num text-sm font-bold text-white mt-0.5">
                  {generatedSpec.recoilScore >= 60
                    ? 'HIGH RECOIL'
                    : generatedSpec.recoilScore >= 30
                    ? 'MODERATE'
                    : 'LOW RECOIL'}
                </div>
              </div>
            </div>

            {/* Pros & Tradeoffs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div className="rounded-xl bg-emerald-950/20 border border-emerald-500/30 p-3">
                <div className="text-[11px] font-mono-num uppercase text-emerald-300 font-bold mb-1.5">
                  ENGINEERING ADVANTAGES
                </div>
                <div className="space-y-1 text-xs text-emerald-200">
                  {generatedSpec.pros.map((p, i) => (
                    <div key={i}>+ {p}</div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl bg-amber-950/20 border border-amber-500/30 p-3">
                <div className="text-[11px] font-mono-num uppercase text-amber-300 font-bold mb-1.5">
                  REQUIRED TRADEOFFS
                </div>
                <div className="space-y-1 text-xs text-amber-200">
                  {generatedSpec.tradeoffs.map((t, i) => (
                    <div key={i}>- {t}</div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <div className="text-xs text-slate-400 flex items-center gap-1.5">
                <Wrench className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>3D Geometry: {generatedSpec.visualDescription}</span>
              </div>
              <button
                onClick={() => {
                  onInstallCustomComponent(generatedSpec);
                  onClose();
                }}
                className="cursor-pointer inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-slate-950 font-display font-extrabold text-sm tracking-wide shadow-lg shadow-cyan-500/20"
              >
                <Check className="w-4 h-4" />
                INSTALL ON ROBOT ({generatedSpec.mass.toFixed(1)} LB)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
