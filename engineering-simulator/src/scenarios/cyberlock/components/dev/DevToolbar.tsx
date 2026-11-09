import { useState } from 'react'
import {
  Wrench,
  ChevronUp,
  ChevronDown,
  X,
  FastForward,
  Eye,
  RotateCcw,
  Layers,
  KeyRound,
} from 'lucide-react'
import { DEV_LOCKBOX_PRESETS } from '../../services/devMode'
import { combinationToHexAscii } from '../../utils/cipherUtils'
import { play } from '../../../../shared/audio/sfx'
import type { ChallengeStage, SessionData, VaultRecord } from '../../types'

interface DevToolbarProps {
  currentStage: ChallengeStage
  session: SessionData | null
  onJumpStage: (stage: ChallengeStage) => void
  onSetSession: (session: SessionData) => void
  onSetRecoveredRecord: (record: VaultRecord | null) => void
  onSetBrowserUrl: (url: string) => void
  onTriggerModal: (modal: 'vuln1' | 'vuln2' | 'vuln3' | 'hint' | 'facilitator') => void
  onResetSession: () => void
  onCloseDevMode: () => void
}

export function DevToolbar({
  currentStage,
  session,
  onJumpStage,
  onSetSession,
  onSetRecoveredRecord,
  onSetBrowserUrl,
  onTriggerModal,
  onResetSession,
  onCloseDevMode,
}: DevToolbarProps) {
  const [collapsed, setCollapsed] = useState(false)

  const activeSerial = session?.serial || 'BESA-0427'
  const currentPreset =
    DEV_LOCKBOX_PRESETS.find((p) => p.serial === activeSerial) || DEV_LOCKBOX_PRESETS[0]

  // Ensure an active session exists when jumping to stages
  const ensureDevSession = (preset = currentPreset) => {
    if (!session || session.serial !== preset.serial) {
      const newSession: SessionData = {
        sessionId: `dev-${Date.now()}`,
        serial: preset.serial,
        teamName: 'Dev Testing Team',
        currentStage,
        completedStages: [],
        revealedHints: [],
        startTime: Date.now(),
        completionTime: null,
        targetRecordId: preset.recordId,
        physicalLockOpened: false,
      }
      onSetSession(newSession)
      return newSession
    }
    return session
  }

  const handleSelectPreset = (serial: string) => {
    const preset = DEV_LOCKBOX_PRESETS.find((p) => p.serial === serial)
    if (!preset) return
    play('click')
    const updatedSession: SessionData = {
      sessionId: `dev-${Date.now()}`,
      serial: preset.serial,
      teamName: session?.teamName || 'Dev Testing Team',
      currentStage,
      completedStages: session?.completedStages || [],
      revealedHints: session?.revealedHints || [],
      startTime: session?.startTime || Date.now(),
      completionTime: session?.completionTime || null,
      targetRecordId: preset.recordId,
      physicalLockOpened: session?.physicalLockOpened || false,
    }
    onSetSession(updatedSession)
    // Also update recovered record with matching hex payload
    onSetRecoveredRecord({
      id: preset.recordId,
      title: `Classified Vault Asset Register (Record #${preset.recordId})`,
      classification: 'Restricted',
      isRestricted: true,
      accessAllowedInUI: false,
      content: 'CONFIDENTIAL VAULT COMBINATION ARCHIVE',
      hexPayload: combinationToHexAscii(preset.combination),
      timestamp: new Date().toISOString(),
    })
  }

  const handleJump = (stage: ChallengeStage) => {
    play('click')
    ensureDevSession()
    if (stage === 'challenge2') {
      onSetBrowserUrl('/portal')
    } else if (stage === 'challenge3' || stage === 'success') {
      onSetRecoveredRecord({
        id: currentPreset.recordId,
        title: `Classified Vault Asset Register (Record #${currentPreset.recordId})`,
        classification: 'Restricted',
        isRestricted: true,
        accessAllowedInUI: false,
        content: 'CONFIDENTIAL VAULT COMBINATION ARCHIVE',
        hexPayload: combinationToHexAscii(currentPreset.combination),
        timestamp: new Date().toISOString(),
      })
    }
    onJumpStage(stage)
  }

  const handleAutoSolveStage = () => {
    play('sparkle')
    ensureDevSession()
    if (currentStage === 'onboarding' || currentStage === 'challenge1') {
      onJumpStage('challenge2')
      onSetBrowserUrl('/portal')
    } else if (currentStage === 'challenge2') {
      onSetRecoveredRecord({
        id: currentPreset.recordId,
        title: `Classified Vault Asset Register (Record #${currentPreset.recordId})`,
        classification: 'Restricted',
        isRestricted: true,
        accessAllowedInUI: false,
        content: 'CONFIDENTIAL VAULT COMBINATION ARCHIVE',
        hexPayload: combinationToHexAscii(currentPreset.combination),
        timestamp: new Date().toISOString(),
      })
      onJumpStage('challenge3')
    } else if (currentStage === 'challenge3') {
      onJumpStage('success')
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 font-sans shadow-2xl transition-all">
      {/* Top Dev Mode Bar Tab */}
      <div className="bg-slate-900 border-t-2 border-amber-500 text-white px-4 py-2 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-mono text-xs font-black uppercase tracking-wider">
            <Wrench className="size-3.5" />
            <span>DEV MODE</span>
          </div>
          <span className="text-xs text-slate-300 hidden sm:inline">
            Stage: <strong className="text-amber-400 font-mono">{currentStage}</strong> · Serial:{' '}
            <strong className="text-amber-400 font-mono">{activeSerial}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Auto-Solve Current Stage */}
          {currentStage !== 'success' && (
            <button
              type="button"
              onClick={handleAutoSolveStage}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono text-xs font-bold transition cursor-pointer"
              title="Instantly solve active challenge stage"
            >
              <FastForward className="size-3.5" />
              <span>Auto-Advance</span>
            </button>
          )}

          {/* Minimize / Expand */}
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title={collapsed ? 'Expand Dev Panel' : 'Collapse Dev Panel'}
          >
            {collapsed ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>

          {/* Exit Dev Mode */}
          <button
            type="button"
            onClick={onCloseDevMode}
            className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800 transition cursor-pointer"
            title="Disable Dev Mode"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Expanded Controls Drawer */}
      {!collapsed && (
        <div className="bg-slate-950 border-t border-slate-800 p-3 sm:p-4 text-xs space-y-3 max-h-[45vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* 1. Jump to Any Stage */}
            <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 space-y-1.5">
              <span className="font-mono text-[10px] text-slate-400 uppercase tracking-wider font-bold block flex items-center gap-1">
                <Layers className="size-3 text-amber-400" />
                Jump to Challenge
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleJump('onboarding')}
                  className={`px-2 py-1.5 rounded font-mono text-[11px] font-semibold border transition cursor-pointer ${
                    currentStage === 'onboarding'
                      ? 'bg-amber-500 text-slate-950 border-amber-400'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  0. Briefing
                </button>
                <button
                  type="button"
                  onClick={() => handleJump('challenge1')}
                  className={`px-2 py-1.5 rounded font-mono text-[11px] font-semibold border transition cursor-pointer ${
                    currentStage === 'challenge1'
                      ? 'bg-amber-500 text-slate-950 border-amber-400'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  1. Login
                </button>
                <button
                  type="button"
                  onClick={() => handleJump('challenge2')}
                  className={`px-2 py-1.5 rounded font-mono text-[11px] font-semibold border transition cursor-pointer ${
                    currentStage === 'challenge2'
                      ? 'bg-amber-500 text-slate-950 border-amber-400'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  2. IDOR / Intranet
                </button>
                <button
                  type="button"
                  onClick={() => handleJump('challenge3')}
                  className={`px-2 py-1.5 rounded font-mono text-[11px] font-semibold border transition cursor-pointer ${
                    currentStage === 'challenge3'
                      ? 'bg-amber-500 text-slate-950 border-amber-400'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  3. Decoder
                </button>
                <button
                  type="button"
                  onClick={() => handleJump('success')}
                  className={`col-span-2 px-2 py-1.5 rounded font-mono text-[11px] font-semibold border transition cursor-pointer ${
                    currentStage === 'success'
                      ? 'bg-amber-500 text-slate-950 border-amber-400'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  ★ Final Debrief
                </button>
              </div>
            </div>

            {/* 2. Target Lockbox Switcher */}
            <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 space-y-1.5">
              <span className="font-mono text-[10px] text-slate-400 uppercase tracking-wider font-bold block flex items-center gap-1">
                <KeyRound className="size-3 text-amber-400" />
                Select Target Lockbox
              </span>
              <div className="space-y-1">
                <select
                  value={activeSerial}
                  onChange={(e) => handleSelectPreset(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-amber-300 font-mono focus:border-amber-500 focus:outline-none"
                >
                  {DEV_LOCKBOX_PRESETS.map((p) => (
                    <option key={p.serial} value={p.serial}>
                      {p.serial} (Record #{p.recordId} · Code: {p.combination})
                    </option>
                  ))}
                </select>
                <div className="text-[10px] font-mono text-slate-400 flex justify-between pt-0.5">
                  <span>Target: #{currentPreset.recordId}</span>
                  <span className="text-amber-300 font-bold">Code: {currentPreset.combination}</span>
                </div>
              </div>
            </div>

            {/* 3. Preview Popups & Modals */}
            <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 space-y-1.5">
              <span className="font-mono text-[10px] text-slate-400 uppercase tracking-wider font-bold block flex items-center gap-1">
                <Eye className="size-3 text-amber-400" />
                Test Modals & Screens
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                <button
                  type="button"
                  onClick={() => onTriggerModal('vuln1')}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono transition cursor-pointer"
                >
                  Popup 1
                </button>
                <button
                  type="button"
                  onClick={() => onTriggerModal('vuln2')}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono transition cursor-pointer"
                >
                  Popup 2
                </button>
                <button
                  type="button"
                  onClick={() => onTriggerModal('vuln3')}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono transition cursor-pointer"
                >
                  Popup 3
                </button>
                <button
                  type="button"
                  onClick={() => onTriggerModal('hint')}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono transition cursor-pointer"
                >
                  Hints Modal
                </button>
                <button
                  type="button"
                  onClick={() => onTriggerModal('facilitator')}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono transition cursor-pointer"
                >
                  Facilitator
                </button>
                <button
                  type="button"
                  onClick={() => {
                    play('chime')
                    onResetSession()
                  }}
                  className="px-2 py-1 rounded bg-red-950/70 hover:bg-red-900 text-red-200 text-[10px] font-mono transition cursor-pointer flex items-center justify-center gap-1"
                >
                  <RotateCcw className="size-2.5" />
                  <span>Reset</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
