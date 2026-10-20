import {
  Briefcase,
  Code2,
  Lock,
  RotateCcw,
  Swords,
  Wrench,
  Zap,
} from 'lucide-react';
import React from 'react';
import { money } from '../../../core/format';
import { soundEngine } from '../audio/soundEngine';
import {
  type AppScreen,
  type TeamRobotProject,
  type TeamRole,
} from '../types/robot';

export interface ChecklistStep {
  label: string;
  detail?: string;
  done: boolean;
}

interface BattlebotShellProps {
  project: TeamRobotProject;
  activeScreen: AppScreen;
  onNavigate: (screen: AppScreen) => void;
  onResetTask?: () => void;
  resetTaskLabel?: string;
  onResetGame?: () => void;
  checklistSteps: ChecklistStep[];
  spentUsd: number;
  availableUsd: number;
  children: React.ReactNode;
  isDevMode?: boolean;
  onDevEnterArena?: () => void;
}

export const BattlebotShell: React.FC<BattlebotShellProps> = ({
  project,
  activeScreen,
  onNavigate,
  onResetGame,
  checklistSteps,
  spentUsd,
  availableUsd,
  children,
  isDevMode = false,
  onDevEnterArena,
}) => {
  const isOverBudget = spentUsd > availableUsd;

  const allRolesComplete =
    project.mechanical.isCompleted &&
    project.electrical.isCompleted &&
    project.software.isCompleted &&
    project.projectLead.isCompleted;

  const getRoleStatus = (role: TeamRole): 'done' | 'progress' | 'not-started' => {
    switch (role) {
      case 'mechanical':
        if (project.mechanical.isCompleted) return 'done';
        if (
          Object.keys(project.mechanical.purchasedParts || {}).length > 0 ||
          (project.mechanical.assembledParts || []).length > 0
        )
          return 'progress';
        return 'not-started';

      case 'electrical':
        if (project.electrical.isCompleted) return 'done';
        if ((project.electrical.wires || []).length > 0 || project.electrical.wiringVerified)
          return 'progress';
        return 'not-started';

      case 'software':
        if (project.software.isCompleted) return 'done';
        if (
          project.software.computerConnected ||
          project.software.bugsFixed ||
          project.software.softwareUploaded
        )
          return 'progress';
        return 'not-started';

      case 'project-lead':
        if (project.projectLead.isCompleted) return 'done';
        if (Boolean(project.projectLead.adPrompt?.trim()) || project.projectLead.sponsorTier !== 'None')
          return 'progress';
        return 'not-started';
    }
  };

  const navTabs: {
    id: AppScreen;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    roleId?: TeamRole;
    isArena?: boolean;
  }[] = [
    {
      id: 'mechanical',
      label: 'Mechanical',
      icon: Wrench,
      roleId: 'mechanical',
    },
    {
      id: 'electrical',
      label: 'Electrical',
      icon: Zap,
      roleId: 'electrical',
    },
    {
      id: 'software',
      label: 'Software',
      icon: Code2,
      roleId: 'software',
    },
    {
      id: 'project-lead',
      label: 'Business',
      icon: Briefcase,
      roleId: 'project-lead',
    },
    {
      id: 'arena',
      label: 'Arena',
      icon: Swords,
      isArena: true,
    },
  ];

  return (
    <div className="relative flex h-full w-full flex-col bg-slate-100 text-slate-800 font-sans select-none overflow-hidden">
      {/* 1. Global BESA Engineering Lab Header & Role Navigation Strip */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2.5 z-30 shadow-xs">
        {/* Left: Lab branding & Station Tabs */}
        <div className="flex items-center gap-3 overflow-x-auto min-w-0">
          {/* Lab title */}
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onNavigate('team-dashboard');
            }}
            className="flex items-center gap-2 pr-3 border-r border-slate-200 hover:opacity-80 transition shrink-0 text-left"
          >
            <span className="grid size-8 place-items-center rounded-xl bg-slate-900 text-cyan-400 font-bold text-xs shadow-xs">
              🤖
            </span>
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-700 block leading-tight">
                BESA Engineering Lab
              </span>
              <span className="block font-display text-sm font-extrabold text-slate-900 tracking-tight leading-tight">
                BattleBot Incubator
              </span>
            </div>
          </button>

          {/* Clean 5-Tab Navigation Strip: [ Mechanical ] [ Electrical ] [ Software ] [ Business ] [ Arena ] */}
          <nav className="flex items-center gap-1.5 shrink-0" aria-label="Role Navigation">
            {navTabs.map((t) => {
              const active = t.id === activeScreen;
              const status = t.roleId ? getRoleStatus(t.roleId) : null;
              const isLockedArena = t.isArena && !allRolesComplete && !isDevMode;

              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    if (isLockedArena) {
                      soundEngine.playWarning();
                      onNavigate('team-dashboard');
                      return;
                    }
                    soundEngine.playClick();
                    onNavigate(t.id);
                  }}
                  className={`cursor-pointer px-3 py-1.5 rounded-xl font-display text-xs font-bold transition flex items-center gap-1.5 ${
                    active
                      ? 'bg-slate-900 text-white shadow-xs'
                      : isLockedArena
                      ? 'text-slate-400 hover:bg-slate-50 opacity-70'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  title={
                    isLockedArena
                      ? 'Arena Locked — Complete all 4 roles to enter'
                      : t.label
                  }
                >
                  {isLockedArena && <Lock className="size-3 text-slate-400" />}
                  <span>{t.label}</span>

                  {/* Tiny state indicator: ○ Not started, ● In progress, ✓ Done */}
                  {status && (
                    <span className="ml-0.5 font-mono text-[11px] leading-none">
                      {status === 'done' ? (
                        <span className="text-emerald-500 font-bold" title="Done">✓</span>
                      ) : status === 'progress' ? (
                        <span className="text-cyan-500 font-bold" title="In progress">●</span>
                      ) : (
                        <span className="text-slate-300 font-normal" title="Not started">○</span>
                      )}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right: Single Primary Budget Indicator + Reset Game */}
        <div className="ml-auto flex shrink-0 items-center gap-3">
          {isDevMode && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-50 border border-amber-300 text-[10px] font-mono font-bold tracking-wider text-amber-800 uppercase shadow-xs">
                <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                DEV MODE
              </span>
              {activeScreen !== 'arena' && onDevEnterArena && (
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    onDevEnterArena();
                  }}
                  title="Developer Mode: Jump directly into the Combat Arena"
                  className="cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-display font-extrabold text-xs shadow-xs transition active:scale-95"
                >
                  <Swords className="w-3.5 h-3.5" />
                  <span>TEST ARENA</span>
                </button>
              )}
            </div>
          )}
          <div className="text-right leading-tight hidden sm:block">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 block">
              Budget
            </span>
            <span className={`font-mono text-xs font-bold ${isOverBudget ? 'text-rose-600' : 'text-slate-800'}`}>
              {money(spentUsd)} <span className="text-slate-400 font-normal">/ {money(availableUsd)}</span>
            </span>
          </div>

          {onResetGame && (
            <button
              type="button"
              onClick={onResetGame}
              title="Reset entire BattleBot challenge"
              className="cursor-pointer flex items-center gap-1.5 rounded-xl bg-slate-100 px-2.5 py-1.5 font-display text-xs font-semibold text-slate-500 ring-1 ring-slate-200 hover:bg-rose-50 hover:text-rose-700 hover:ring-rose-200 transition"
            >
              <RotateCcw className="size-3.5 text-slate-400 group-hover:text-rose-500" />
              <span className="hidden sm:inline">↻ Reset Game</span>
            </button>
          )}
        </div>
      </header>

      {/* 2. ONE Small Objective Strip (Only rendered on Role Screens, never on Home or Arena) */}
      {activeScreen !== 'team-dashboard' && activeScreen !== 'arena' && checklistSteps.length > 0 && (
        <nav
          aria-label="Role objective"
          className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-1.5 z-20 overflow-x-auto text-xs"
        >
          <div className="flex items-center gap-1.5 flex-wrap">
            {checklistSteps.map((s, i) => (
              <React.Fragment key={s.label}>
                {i > 0 && <span className="text-slate-300 mx-1 font-bold">→</span>}
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold transition ${
                    s.done
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                      : 'bg-slate-50 text-slate-600 border border-slate-200'
                  }`}
                >
                  <span className="font-mono text-[10px] text-slate-400">{i + 1}</span>
                  <span>{s.label}</span>
                  {s.done && <span className="text-emerald-600 font-bold">✓</span>}
                </span>
              </React.Fragment>
            ))}
          </div>
        </nav>
      )}

      {/* 3. Main Workspace */}
      <main className="min-h-0 flex-1 relative overflow-hidden bg-slate-50">
        {children}
      </main>
    </div>
  );
};
