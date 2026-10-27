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
import { BaskinLogo } from '../../../shell/BrandMark';
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
  /** Multiplayer: this player's jobs, marked on their tabs. */
  myRoles?: TeamRole[];
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
  myRoles,
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
    <div className="relative flex h-full w-full flex-col bg-[#f4f6fa] text-[#0b1d2e] font-sans select-none overflow-hidden antialiased">
      {/* 1. Global BESA Engineering Lab Header & Role Navigation Strip */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#d8e0ea] bg-white px-4 py-2 z-30 shadow-xs">
        {/* Left: Lab branding & Station Tabs */}
        <div className="flex items-center gap-3 overflow-x-auto min-w-0">
          {/* Lab title */}
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onNavigate('team-dashboard');
            }}
            className="flex items-center gap-2.5 pr-3 border-r border-[#d8e0ea] hover:opacity-85 transition shrink-0 text-left cursor-pointer"
          >
            <BaskinLogo height={26} />
            <div className="h-5 w-px bg-slate-200 hidden sm:block" />
            <div>
              <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-[#003c6c] block leading-tight">
                BE Lab
              </span>
              <span className="block font-sans text-xs font-black text-[#003c6c] tracking-tight leading-tight">
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
                  className={`cursor-pointer px-3 py-1.5 rounded-xl font-sans text-xs font-bold transition flex items-center gap-1.5 ${
                    active
                      ? t.isArena
                        ? 'bg-[#f29813] text-white shadow-xs'
                        : 'bg-[#003c6c] text-white shadow-xs'
                      : isLockedArena
                      ? 'text-[#75787b]/60 hover:bg-slate-50 opacity-70'
                      : t.isArena
                      ? 'text-[#f29813] hover:bg-amber-50 font-black'
                      : 'text-[#0b1d2e] hover:bg-[#f4f6fa]'
                  }`}
                  title={
                    isLockedArena
                      ? 'Arena Locked — Complete all 4 roles to enter'
                      : t.label
                  }
                >
                  {isLockedArena && <Lock className="size-3 text-slate-400" />}
                  <span>{t.label}</span>
                  {t.roleId && myRoles?.includes(t.roleId) && (
                    <span className={`rounded-full px-1.5 py-px font-mono text-[9px] font-bold ${active ? 'bg-white/20 text-white' : 'bg-blue-50 text-[#003c6c]'}`}>YOU</span>
                  )}

                  {/* Tiny state indicator: ○ Not started, ● In progress, ✓ Done */}
                  {status && (
                    <span className="ml-0.5 font-mono text-[11px] leading-none">
                      {status === 'done' ? (
                        <span className="text-[#003c6c] font-bold" title="Done">✓</span>
                      ) : status === 'progress' ? (
                        <span className="text-[#f29813] font-bold" title="In progress">●</span>
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
                  className="cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#f29813] hover:bg-[#d98207] text-white font-sans font-bold text-xs shadow-xs transition active:scale-95"
                >
                  <Swords className="w-3.5 h-3.5" />
                  <span>TEST ARENA</span>
                </button>
              )}
            </div>
          )}
          <div className="text-right leading-tight hidden sm:block">
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#75787b] block">
              Budget
            </span>
            <span className={`font-mono text-xs font-bold ${isOverBudget ? 'text-red-600' : 'text-[#003c6c]'}`}>
              {money(spentUsd)} <span className="text-[#75787b] font-normal">/ {money(availableUsd)}</span>
            </span>
          </div>

          {onResetGame && (
            <button
              type="button"
              onClick={onResetGame}
              title="Reset entire BattleBot challenge"
              className="cursor-pointer flex items-center gap-1.5 rounded-xl border border-[#d8e0ea] bg-white px-2.5 py-1.5 font-sans text-xs font-semibold text-[#75787b] hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition"
            >
              <RotateCcw className="size-3.5" />
              <span className="hidden sm:inline">Reset Game</span>
            </button>
          )}
        </div>
      </header>

      {/* 2. ONE Small Objective Strip (Only rendered on Role Screens, never on Home or Arena) */}
      {activeScreen !== 'team-dashboard' && activeScreen !== 'arena' && checklistSteps.length > 0 && (
        <nav
          aria-label="Role objective"
          className="flex shrink-0 items-center justify-between border-b border-[#d8e0ea] bg-[#f8fafc] px-4 py-1.5 z-20 overflow-x-auto text-xs"
        >
          <div className="flex items-center gap-1.5 flex-wrap">
            {checklistSteps.map((s, i) => (
              <React.Fragment key={s.label}>
                {i > 0 && <span className="text-slate-300 mx-1 font-bold">→</span>}
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold transition ${
                    s.done
                      ? 'bg-blue-50 text-[#003c6c] border border-blue-200'
                      : 'bg-white text-[#75787b] border border-[#d8e0ea]'
                  }`}
                >
                  <span className="font-mono text-[10px] text-[#75787b]">{i + 1}</span>
                  <span>{s.label}</span>
                  {s.done && <span className="text-[#003c6c] font-bold">✓</span>}
                </span>
              </React.Fragment>
            ))}
          </div>
        </nav>
      )}

      {/* 3. Main Workspace */}
      <main className="min-h-0 flex-1 relative overflow-hidden bg-[#f4f6fa]">
        {children}
      </main>
    </div>
  );
};
