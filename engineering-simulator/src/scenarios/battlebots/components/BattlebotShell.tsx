import {
  Wrench,
  Zap,
  Code2,
  Briefcase,
  Swords,
  Users,
  CheckCircle2,
  Circle,
  RotateCcw,
} from 'lucide-react';
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
}

interface RoleNavTab {
  id: AppScreen;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  roleId?: TeamRole;
  isDone?: boolean;
}

export const BattlebotShell: React.FC<BattlebotShellProps> = ({
  project,
  activeScreen,
  onNavigate,
  onResetTask,
  resetTaskLabel,
  onResetGame,
  checklistSteps,
  spentUsd,
  availableUsd,
  children,
}) => {
  const isOverBudget = spentUsd > availableUsd;

  const tabs: RoleNavTab[] = [
    {
      id: 'mechanical',
      label: 'Mechanical',
      icon: Wrench,
      accent: '#0891b2', // cyan-600
      roleId: 'mechanical',
      isDone: project.mechanical.isCompleted,
    },
    {
      id: 'electrical',
      label: 'Electrical',
      icon: Zap,
      accent: '#d97706', // amber-600
      roleId: 'electrical',
      isDone: project.electrical.isCompleted,
    },
    {
      id: 'software',
      label: 'Software',
      icon: Code2,
      accent: '#6366f1', // indigo-500
      roleId: 'software',
      isDone: project.software.isCompleted,
    },
    {
      id: 'project-lead',
      label: 'Business',
      icon: Briefcase,
      accent: '#059669', // emerald-600
      roleId: 'project-lead',
      isDone: project.projectLead.isCompleted,
    },
    {
      id: 'team-dashboard',
      label: 'Systems & Team',
      icon: Users,
      accent: '#475569', // slate-600
    },
    {
      id: 'arena',
      label: 'Combat Arena',
      icon: Swords,
      accent: '#b91c1c', // red-700
    },
  ];

  return (
    <div className="relative flex h-full w-full flex-col bg-slate-100 text-slate-800 font-sans select-none overflow-hidden">
      {/* 1. Global BESA Engineering Lab Header & Role Navigation Strip */}
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3.5 py-2 z-30 shadow-xs">
        {/* Left: Lab branding & Station Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto min-w-0">
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
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-600">
                  BESA Lab
                </span>
                <span className="inline-block size-1.5 rounded-full bg-emerald-500" />
              </div>
              <span className="block font-display text-sm font-extrabold text-slate-900 truncate max-w-[130px] sm:max-w-[180px]">
                {project.teamName || 'BattleBot Team'}
              </span>
            </div>
          </button>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1.5 shrink-0" aria-label="Discipline Stations">
            {tabs.map((t) => {
              const active = t.id === activeScreen;
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    onNavigate(t.id);
                  }}
                  className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-left transition font-display text-xs font-bold ${
                    active
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'hover:bg-slate-100 text-slate-600'
                  }`}
                >
                  <span
                    className="grid size-6 place-items-center rounded-lg text-white"
                    style={{ backgroundColor: active ? '#ffffff22' : t.accent }}
                  >
                    <Icon className="size-3.5" />
                  </span>
                  <span className="leading-tight">
                    <span className="block">{t.label}</span>
                    {t.isDone !== undefined && (
                      <span
                        className={`block text-[10px] font-normal ${
                          active
                            ? 'text-white/70'
                            : t.isDone
                            ? 'text-emerald-600 font-semibold'
                            : 'text-slate-400'
                        }`}
                      >
                        {t.isDone ? 'done ✓' : 'in progress'}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right: Team Budget + Individual Reset Control */}
        <div className="ml-auto flex shrink-0 items-center gap-3">
          <div className="text-right leading-tight hidden sm:block">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Team money
            </div>
            <div className="font-mono text-xs font-bold">
              <span className={isOverBudget ? 'text-rose-600' : 'text-slate-900'}>
                {money(spentUsd)}
              </span>
              <span className="text-slate-400"> spent / {money(availableUsd)}</span>
            </div>
          </div>

          {onResetTask && (
            <button
              type="button"
              onClick={onResetTask}
              title={resetTaskLabel || 'Reset this task'}
              className="cursor-pointer flex items-center gap-1.5 rounded-xl bg-slate-100 px-2.5 py-1.5 font-display text-xs font-bold text-slate-600 ring-1 ring-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:ring-rose-200 transition"
            >
              <RotateCcw className="size-3.5 text-slate-400 group-hover:text-rose-500" />
              <span className="hidden md:inline">{resetTaskLabel || 'Reset'}</span>
            </button>
          )}

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

      {/* 2. Persistent Horizontal Checklist Strip */}
      {checklistSteps.length > 0 && (
        <nav
          aria-label="Discipline checklist"
          className="flex shrink-0 flex-wrap items-center gap-x-1.5 gap-y-1 border-b border-slate-200 bg-emerald-50/70 px-4 py-2 z-20 overflow-x-auto"
        >
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-800/80 mr-2 shrink-0 hidden sm:inline">
            OBJECTIVES:
          </span>
          <ol className="flex items-center gap-1.5 flex-wrap">
            {checklistSteps.map((s, i) => (
              <li key={s.label} className="flex items-center">
                {i > 0 && <span className="mx-1 h-px w-3 bg-emerald-700/25 shrink-0" />}
                <span
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold shrink-0 transition ${
                    s.done
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-white text-slate-700 ring-1 ring-slate-200'
                  }`}
                >
                  {s.done ? (
                    <CheckCircle2 className="size-3.5 text-white" />
                  ) : (
                    <Circle className="size-3.5 text-slate-300" />
                  )}
                  <span>
                    {i + 1}. {s.label}
                  </span>
                  {s.detail && (
                    <span
                      className={`font-mono text-[11px] ${
                        s.done ? 'text-emerald-100' : 'text-slate-400'
                      }`}
                    >
                      {s.detail}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </nav>
      )}

      {/* 3. Main Station Workspace */}
      <main className="min-h-0 flex-1 relative overflow-hidden bg-slate-50">
        {children}
      </main>
    </div>
  );
};
