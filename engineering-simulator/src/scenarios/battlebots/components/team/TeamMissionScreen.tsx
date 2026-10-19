import {
  Briefcase,
  Cpu,
  Sparkles,
  Swords,
  Wrench,
  Zap,
} from 'lucide-react';
import React from 'react';
import { soundEngine } from '../../audio/soundEngine';

interface TeamMissionScreenProps {
  onBeginProject: () => void;
}

export const TeamMissionScreen: React.FC<TeamMissionScreenProps> = ({ onBeginProject }) => {
  return (
    <div className="relative w-full h-full bg-[#070a12] text-white overflow-y-auto flex flex-col justify-between p-4 sm:p-6 md:p-8">
      {/* Background radial glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-950/30 via-transparent to-black" />

      {/* Header bar */}
      <div className="relative z-10 flex items-center justify-between border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="font-mono-num text-xs uppercase tracking-widest text-cyan-400 font-semibold">
            BESA Robotics Lab • Collaborative Challenge
          </span>
        </div>
        <div className="font-mono-num text-xs text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1 rounded-full">
          CLASS: 30.0 LB AUTONOMOUS
        </div>
      </div>

      {/* Main Mission Briefing Card */}
      <div className="relative z-10 max-w-4xl mx-auto my-auto w-full py-6">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono-num uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5" /> Project Objective
          </div>
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-white mb-4">
            BATTLEBOT ENGINEERING CHALLENGE
          </h1>
          <p className="text-slate-300 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            Design, build, and deploy an autonomous <strong className="text-amber-400">30.0 lb combat robot</strong> capable of defeating the arena champion. But no engineer builds a robot alone.
          </p>
        </div>

        {/* Four Roles Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Mechanical */}
          <div className="holo-panel rounded-2xl border border-cyan-500/30 bg-slate-900/60 p-5 hover:border-cyan-400/60 transition-all">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 mb-3">
              <Wrench className="w-5 h-5" />
            </div>
            <div className="text-xs font-mono-num uppercase tracking-wider text-cyan-400 font-semibold mb-1">
              DISCIPLINE 01 • DESIGN
            </div>
            <h3 className="font-display font-extrabold text-lg text-white mb-1.5">
              MECHANICAL
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed italic mb-1.5">
              "I built the robot."
            </p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Select chassis, weapon, drive, and armor within the 30.0 lb weight limit.
            </p>
          </div>

          {/* Electrical */}
          <div className="holo-panel rounded-2xl border border-amber-500/30 bg-slate-900/60 p-5 hover:border-amber-400/60 transition-all">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 mb-3">
              <Zap className="w-5 h-5" />
            </div>
            <div className="text-xs font-mono-num uppercase tracking-wider text-amber-400 font-semibold mb-1">
              DISCIPLINE 02 • WIRE
            </div>
            <h3 className="font-display font-extrabold text-lg text-white mb-1.5">
              ELECTRICAL
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed italic mb-1.5">
              "I wired the robot."
            </p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Connect the wiring harness across 5 stages and power on the robot's systems safely.
            </p>
          </div>

          {/* Software */}
          <div className="holo-panel rounded-2xl border border-emerald-500/30 bg-slate-900/60 p-5 hover:border-emerald-400/60 transition-all">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 mb-3">
              <Cpu className="w-5 h-5" />
            </div>
            <div className="text-xs font-mono-num uppercase tracking-wider text-emerald-400 font-semibold mb-1">
              DISCIPLINE 03 • DEBUG
            </div>
            <h3 className="font-display font-extrabold text-lg text-white mb-1.5">
              SOFTWARE
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed italic mb-1.5">
              "I connected & fixed the code."
            </p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Connect the laptop cable, debug BotCode typos, and upload the autonomous software.
            </p>
          </div>

          {/* Business Lead */}
          <div className="holo-panel rounded-2xl border border-purple-500/30 bg-slate-900/60 p-5 hover:border-purple-400/60 transition-all">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 mb-3">
              <Briefcase className="w-5 h-5" />
            </div>
            <div className="text-xs font-mono-num uppercase tracking-wider text-purple-400 font-semibold mb-1">
              DISCIPLINE 04 • PROMOTE
            </div>
            <h3 className="font-display font-extrabold text-lg text-white mb-1.5">
              BUSINESS LEAD
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed italic mb-1.5">
              "I earned our sponsorship."
            </p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Prompt an advertisement for your BattleBot and earn up to $700 in corporate sponsorship.
            </p>
          </div>
        </div>

        {/* Combat Champion Notice */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 mb-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="text-2xl p-2 rounded-xl bg-amber-500/20 border border-amber-500/30">
              🐂
            </div>
            <div>
              <div className="text-xs font-mono-num text-amber-400 uppercase tracking-wider">
                FINAL ARENA OPPONENT
              </div>
              <div className="font-display font-bold text-white text-base">
                THE BULL (30 lb Heavy Armored Ramming Wedge)
              </div>
              <div className="text-xs text-slate-400">
                100% Autonomous Combat. Your engineering decisions dictate the outcome.
              </div>
            </div>
          </div>
          <div className="text-xs font-mono-num text-slate-400 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-center">
            SYSTEM INTEGRATION REQUIRED BEFORE ARENA UNLOCK
          </div>
        </div>

        {/* Launch Button */}
        <div className="text-center">
          <button
            onClick={() => {
              soundEngine.playClick();
              soundEngine.playInstall();
              onBeginProject();
            }}
            className="cursor-pointer inline-flex items-center gap-3 px-10 py-4 rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-display font-black text-lg tracking-wide shadow-xl shadow-cyan-500/25 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <Swords className="w-5 h-5" />
            BEGIN PROJECT →
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 text-center text-xs font-mono-num text-slate-500 border-t border-slate-900 pt-3">
        COLLABORATIVE ENGINEERING • NO ENGINEERING BACKGROUND REQUIRED • 4-STUDENT TEAM
      </div>
    </div>
  );
};
