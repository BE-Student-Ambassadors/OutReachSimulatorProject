import { useState, useEffect } from 'react'
import { MissionBriefing } from './components/MissionBriefing'
import { ChallengeTracker } from './components/ChallengeTracker'
import { HintModal } from './components/HintModal'
import { FacilitatorModal } from './components/FacilitatorModal'
import { SimulatedBrowser } from './components/SimulatedBrowser'
import { VaultTechPublicSite } from './components/challenge1/VaultTechPublicSite'
import { Vulnerability1Card } from './components/challenge1/Vulnerability1Card'
import { InternalDashboard } from './components/challenge2/InternalDashboard'
import { Vulnerability2Card } from './components/challenge2/Vulnerability2Card'
import { DecoderWorkspace } from './components/challenge3/DecoderWorkspace'
import { Vulnerability3Card } from './components/challenge3/Vulnerability3Card'
import { FinalSuccessScreen } from './components/FinalSuccessScreen'
import {
  loadSavedSession,
  saveSession,
  clearSavedSession,
  loadSavedScore,
  saveScore,
} from './client/storage'
import { play } from '../../shared/audio/sfx'
import type { ChallengeStage, ScoreState, SessionData, VaultRecord } from './types'

export function CyberlockApp() {
  const [session, setSession] = useState<SessionData | null>(loadSavedSession)
  const [currentStage, setCurrentStage] = useState<ChallengeStage>(
    () => session?.currentStage || 'onboarding',
  )
  const [completedStages, setCompletedStages] = useState<ChallengeStage[]>(
    () => session?.completedStages || [],
  )

  const [scoreState, setScoreState] = useState<ScoreState>(() => {
    const saved = loadSavedScore()
    if (saved) return saved
    return {
      c1Points: 0,
      c2Points: 0,
      c3Points: 0,
      physicalLockBonus: 0,
      hintsUsed: [],
      hintPenalties: 0,
      total: 0,
    }
  })

  // Simulated browser URL in Challenge 2
  const [browserUrl, setBrowserUrl] = useState('/portal')

  // Recovered record from IDOR exploit
  const [recoveredRecord, setRecoveredRecord] = useState<VaultRecord | null>(null)
  const [finalCombination, setFinalCombination] = useState<string>('4826')

  // Modals
  const [showVulnerability1Modal, setShowVulnerability1Modal] = useState(false)
  const [showVulnerability2Modal, setShowVulnerability2Modal] = useState(false)
  const [showVulnerability3Modal, setShowVulnerability3Modal] = useState(false)
  const [showHintModal, setShowHintModal] = useState(false)
  const [showFacilitatorModal, setShowFacilitatorModal] = useState(false)

  // Track elapsed time without impure render calls
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  useEffect(() => {
    if (!session) return
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - session.startTime) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [session])

  // Persist session changes
  useEffect(() => {
    if (session) {
      saveSession({
        ...session,
        currentStage,
        completedStages,
      })
    }
  }, [session, currentStage, completedStages])

  // Persist score changes
  useEffect(() => {
    saveScore(scoreState)
  }, [scoreState])

  const recalculateScore = (
    c1: number,
    c2: number,
    c3: number,
    bonus: number,
    hints: string[],
  ): ScoreState => {
    const penalties = hints.length * 25
    const total = Math.max(0, c1 + c2 + c3 + bonus - penalties)
    return {
      c1Points: c1,
      c2Points: c2,
      c3Points: c3,
      physicalLockBonus: bonus,
      hintsUsed: hints,
      hintPenalties: penalties,
      total,
    }
  }

  // 1. Session start from onboarding
  const handleStartSession = (newSession: SessionData) => {
    setSession(newSession)
    setCurrentStage('challenge1')
    setCompletedStages([])
    setScoreState(recalculateScore(0, 0, 0, 0, []))
  }

  // 2. Challenge 1 Success
  const handleLoginSuccess = () => {
    if (!completedStages.includes('challenge1')) {
      const nextCompleted = [...completedStages, 'challenge1' as ChallengeStage]
      setCompletedStages(nextCompleted)
      setScoreState((prev) =>
        recalculateScore(100, prev.c2Points, prev.c3Points, prev.physicalLockBonus, prev.hintsUsed),
      )
    }
    setShowVulnerability1Modal(true)
  }

  const handleAdvanceToChallenge2 = () => {
    setShowVulnerability1Modal(false)
    setCurrentStage('challenge2')
    setBrowserUrl('/portal')
  }

  // 3. Challenge 2 IDOR payload capture
  const handleCapturePayload = (record: VaultRecord) => {
    setRecoveredRecord(record)
    if (!completedStages.includes('challenge2')) {
      const nextCompleted = [...completedStages, 'challenge2' as ChallengeStage]
      setCompletedStages(nextCompleted)
      setScoreState((prev) =>
        recalculateScore(prev.c1Points, 200, prev.c3Points, prev.physicalLockBonus, prev.hintsUsed),
      )
    }
    setShowVulnerability2Modal(true)
  }

  const handleAdvanceToChallenge3 = () => {
    setShowVulnerability2Modal(false)
    setCurrentStage('challenge3')
  }

  // 4. Challenge 3 Combination unlocked
  const handleUnlockSuccess = (code: string) => {
    setFinalCombination(code)
    if (!completedStages.includes('challenge3')) {
      const nextCompleted = [...completedStages, 'challenge3' as ChallengeStage]
      setCompletedStages(nextCompleted)
      setScoreState((prev) =>
        recalculateScore(prev.c1Points, prev.c2Points, 150, prev.physicalLockBonus, prev.hintsUsed),
      )
    }
    setShowVulnerability3Modal(true)
  }

  const handleAdvanceToSuccess = () => {
    setShowVulnerability3Modal(false)
    setCurrentStage('success')
  }

  // 5. Physical lock verification bonus
  const handleVerifyPhysicalLock = () => {
    setScoreState((prev) =>
      recalculateScore(prev.c1Points, prev.c2Points, prev.c3Points, 50, prev.hintsUsed),
    )
    if (session) {
      setSession({ ...session, physicalLockOpened: true })
    }
  }

  // 6. Hint Reveal
  const handleRevealHint = (hintId: string) => {
    if (!scoreState.hintsUsed.includes(hintId)) {
      const nextHints = [...scoreState.hintsUsed, hintId]
      setScoreState((prev) =>
        recalculateScore(
          prev.c1Points,
          prev.c2Points,
          prev.c3Points,
          prev.physicalLockBonus,
          nextHints,
        ),
      )
    }
  }

  // 7. Reset session
  const handleReset = () => {
    clearSavedSession()
    setSession(null)
    setCurrentStage('onboarding')
    setCompletedStages([])
    setScoreState(recalculateScore(0, 0, 0, 0, []))
    setRecoveredRecord(null)
    setBrowserUrl('/portal')
  }

  // 8. Facilitator Jump Stage
  const handleJumpStage = (stage: ChallengeStage) => {
    setCurrentStage(stage)
    if (stage === 'challenge2' && !completedStages.includes('challenge1')) {
      setCompletedStages(['challenge1'])
      setScoreState((prev) => recalculateScore(100, 0, 0, 0, prev.hintsUsed))
    } else if (stage === 'challenge3') {
      setCompletedStages(['challenge1', 'challenge2'])
      setScoreState((prev) => recalculateScore(100, 200, 0, 0, prev.hintsUsed))
    } else if (stage === 'success') {
      setCompletedStages(['challenge1', 'challenge2', 'challenge3'])
      setScoreState((prev) => recalculateScore(100, 200, 150, 50, prev.hintsUsed))
    }
  }

  return (
    <div className="relative flex flex-col h-full w-full bg-[#f4f6fa] overflow-hidden select-none">
      {/* Top Challenge Tracker (Active during challenges & debrief) */}
      {currentStage !== 'onboarding' && session && (
        <ChallengeTracker
          currentStage={currentStage}
          completedStages={completedStages}
          serial={session.serial}
          teamName={session.teamName}
          startTime={session.startTime}
          score={scoreState.total}
          hintsUsedCount={scoreState.hintsUsed.length}
          onOpenHints={() => {
            play('pop')
            setShowHintModal(true)
          }}
          onOpenFacilitator={() => {
            play('click')
            setShowFacilitatorModal(true)
          }}
        />
      )}

      {/* Main View Area */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {currentStage === 'onboarding' && (
          <MissionBriefing
            onStartSession={handleStartSession}
            onOpenFacilitator={() => setShowFacilitatorModal(true)}
          />
        )}

        {currentStage === 'challenge1' && (
          <div className="h-full">
            <VaultTechPublicSite onLoginSuccess={handleLoginSuccess} />
          </div>
        )}

        {currentStage === 'challenge2' && session && (
          <div className="h-full p-3 sm:p-5">
            <SimulatedBrowser
              url={browserUrl}
              onNavigate={(nextUrl) => {
                play('click')
                setBrowserUrl(nextUrl)
              }}
              title="VaultTech Internal Intranet v4.2"
            >
              <InternalDashboard
                url={browserUrl}
                onNavigateUrl={(u) => setBrowserUrl(u)}
                targetSerial={session.serial}
                targetRecordId={session.targetRecordId}
                sessionId={session.sessionId}
                onCapturePayload={handleCapturePayload}
              />
            </SimulatedBrowser>
          </div>
        )}

        {currentStage === 'challenge3' && session && (
          <DecoderWorkspace
            recoveredRecord={recoveredRecord}
            serial={session.serial}
            sessionId={session.sessionId}
            onUnlockSuccess={handleUnlockSuccess}
          />
        )}

        {currentStage === 'success' && session && (
          <FinalSuccessScreen
            serial={session.serial}
            teamName={session.teamName}
            elapsedSeconds={elapsedSeconds}
            scoreState={scoreState}
            finalCombination={finalCombination}
            onVerifyPhysicalLock={handleVerifyPhysicalLock}
            physicalLockOpened={session.physicalLockOpened}
            onRestart={handleReset}
          />
        )}
      </div>

      {/* Modals */}
      {showVulnerability1Modal && (
        <Vulnerability1Card onContinue={handleAdvanceToChallenge2} />
      )}

      {showVulnerability2Modal && (
        <Vulnerability2Card onContinue={handleAdvanceToChallenge3} />
      )}

      {showVulnerability3Modal && (
        <Vulnerability3Card
          combination={finalCombination}
          onContinue={handleAdvanceToSuccess}
        />
      )}

      {showHintModal && (
        <HintModal
          currentStage={currentStage}
          revealedHints={scoreState.hintsUsed}
          onRevealHint={handleRevealHint}
          onClose={() => setShowHintModal(false)}
        />
      )}

      {showFacilitatorModal && (
        <FacilitatorModal
          onClose={() => setShowFacilitatorModal(false)}
          onJumpStage={handleJumpStage}
          onResetSession={handleReset}
        />
      )}
    </div>
  )
}
