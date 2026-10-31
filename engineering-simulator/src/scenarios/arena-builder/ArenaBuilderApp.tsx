import { useState } from 'react'
import { ArenaBuilderShell } from './components/ArenaBuilderShell'
import { StudioSetupScreen } from './components/studio/StudioSetupScreen'
import { HeroDesignerScreen } from './components/roles/HeroDesignerScreen'
import { BossProgrammerScreen } from './components/roles/BossProgrammerScreen'
import { ArenaDesignerScreen } from './components/roles/ArenaDesignerScreen'
import { BalanceDashboardScreen } from './components/roles/BalanceDashboardScreen'
import { GameIntegrationModal } from './components/integration/GameIntegrationModal'
import { PlayableArenaCanvas } from './components/gameplay/PlayableArenaCanvas'
import { PublishScreen } from './components/publish/PublishScreen'
import { createInitialGameProject } from './data/initialProject'
import { createStarterArenaLayout } from './data/arenaCatalog'
import type { ArenaPartKey } from './teamSync'
import type {
  ActiveTab,
  ArenaLayout,
  BalanceSettings,
  BossConfig,
  HeroConfig,
  PlaytestResult,
  TeamGameProject,
} from './types/project'

interface ArenaBuilderAppProps {
  project: TeamGameProject
  onUpdatePart<K extends ArenaPartKey>(part: K, data: unknown): void
  onResetProject(): void
}

export function ArenaBuilderApp({ project, onUpdatePart, onResetProject }: ArenaBuilderAppProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('studio')
  const [showIntegrationModal, setShowIntegrationModal] = useState(false)
  const [devMode, setDevMode] = useState(() => {
    if (typeof window === 'undefined') return false
    const q = new URLSearchParams(window.location.search)
    return q.has('dev') || q.get('dev') === 'true'
  })

  const updateMeta = (patch: Partial<TeamGameProject>) => {
    onUpdatePart('meta', {
      studioName: patch.studioName ?? project.studioName,
      gameTitle: patch.gameTitle ?? project.gameTitle,
      roleCompletion: patch.roleCompletion ?? project.roleCompletion,
      playtestHistory: patch.playtestHistory ?? project.playtestHistory,
      published: patch.published ?? project.published,
    })
  }

  // Individual role resets
  const handleResetHero = () => {
    const initial = createInitialGameProject()
    onUpdatePart('hero', initial.hero)
    updateMeta({
      roleCompletion: { ...project.roleCompletion, gameplay: false },
    })
  }

  const handleResetBoss = () => {
    const initial = createInitialGameProject()
    onUpdatePart('boss', initial.boss)
    updateMeta({
      roleCompletion: { ...project.roleCompletion, programming: false },
    })
  }

  const handleResetArena = () => {
    onUpdatePart('arena', createStarterArenaLayout())
    updateMeta({
      roleCompletion: { ...project.roleCompletion, arena: false },
    })
  }

  const handleResetBalance = () => {
    const initial = createInitialGameProject()
    onUpdatePart('balance', initial.balance)
    updateMeta({
      roleCompletion: { ...project.roleCompletion, balance: false },
    })
  }

  // Mark role completion
  const setRoleComplete = (role: 'gameplay' | 'programming' | 'arena' | 'balance') => {
    updateMeta({
      roleCompletion: {
        ...project.roleCompletion,
        [role]: true,
      },
    })
  }

  // Combat completion handler
  const handleFinishCombat = (result: PlaytestResult) => {
    const updatedHistory = [...project.playtestHistory, result]
    updateMeta({
      playtestHistory: updatedHistory,
      roleCompletion: {
        ...project.roleCompletion,
        balance: true, // Playing a test satisfies balance test requirement
      },
    })
  }

  const handlePublishGame = () => {
    updateMeta({ published: true })
    setActiveTab('publish')
  }

  return (
    <div className="relative flex h-full w-full flex-col bg-[#f4f6fa] text-[#0b1d2e] antialiased select-none">
      {/* Shell Header */}
      <ArenaBuilderShell
        project={project}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onResetProject={onResetProject}
        devMode={devMode}
        onToggleDevMode={() => setDevMode((d) => !d)}
      />

      {/* Main Workspace Body */}
      <main className="relative min-w-0 flex-1 overflow-hidden">
        {activeTab === 'studio' && (
          <StudioSetupScreen
            project={project}
            onUpdateStudio={(studioName, gameTitle) => updateMeta({ studioName, gameTitle })}
            onSelectTab={setActiveTab}
            onOpenPlaytest={() => {
              const ready =
                devMode ||
                (project.roleCompletion.gameplay &&
                  project.roleCompletion.programming &&
                  project.roleCompletion.arena)
              if (ready) {
                setActiveTab('playtest')
              } else {
                setShowIntegrationModal(true)
              }
            }}
            devMode={devMode}
          />
        )}

        {activeTab === 'gameplay' && (
          <HeroDesignerScreen
            hero={project.hero}
            onUpdateHero={(hero: HeroConfig) => onUpdatePart('hero', hero)}
            onResetHero={handleResetHero}
            onMarkComplete={() => setRoleComplete('gameplay')}
            isComplete={project.roleCompletion.gameplay}
            onNextRole={() => setActiveTab('programming')}
          />
        )}

        {activeTab === 'programming' && (
          <BossProgrammerScreen
            boss={project.boss}
            onUpdateBoss={(boss: BossConfig) => onUpdatePart('boss', boss)}
            onResetBoss={handleResetBoss}
            onMarkComplete={() => setRoleComplete('programming')}
            isComplete={project.roleCompletion.programming}
            onNextRole={() => setActiveTab('arena')}
          />
        )}

        {activeTab === 'arena' && (
          <ArenaDesignerScreen
            arena={project.arena}
            onUpdateArena={(arena: ArenaLayout) => onUpdatePart('arena', arena)}
            onResetArena={handleResetArena}
            onMarkComplete={() => setRoleComplete('arena')}
            isComplete={project.roleCompletion.arena}
            onNextRole={() => setActiveTab('balance')}
          />
        )}

        {activeTab === 'balance' && (
          <BalanceDashboardScreen
            hero={project.hero}
            boss={project.boss}
            balance={project.balance}
            onUpdateBalance={(bal: BalanceSettings) => onUpdatePart('balance', bal)}
            onResetBalance={handleResetBalance}
            playtestHistory={project.playtestHistory}
            onOpenPlaytest={() => setActiveTab('playtest')}
            onMarkComplete={() => setRoleComplete('balance')}
            isComplete={project.roleCompletion.balance}
            onNextRole={() => setActiveTab('playtest')}
          />
        )}

        {activeTab === 'playtest' && (
          <PlayableArenaCanvas
            hero={project.hero}
            boss={project.boss}
            arena={project.arena}
            attemptNumber={project.playtestHistory.length + 1}
            onFinishCombat={handleFinishCombat}
            onNavigate={(tab) => {
              if (tab === 'publish') {
                handlePublishGame()
              } else {
                setActiveTab(tab)
              }
            }}
            devMode={devMode}
          />
        )}

        {activeTab === 'publish' && (
          <PublishScreen
            project={project}
            onPlayFinalGame={() => setActiveTab('playtest')}
            onNavigate={setActiveTab}
            onRestartProject={onResetProject}
          />
        )}
      </main>

      {/* Pre-combat Readiness Modal */}
      <GameIntegrationModal
        project={project}
        isOpen={showIntegrationModal}
        onClose={() => setShowIntegrationModal(false)}
        onLaunchPlaytest={() => setActiveTab('playtest')}
        onNavigate={setActiveTab}
        devMode={devMode}
      />
    </div>
  )
}
