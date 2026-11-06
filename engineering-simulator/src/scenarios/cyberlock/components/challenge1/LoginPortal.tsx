import { useState } from 'react'
import {
  Lock,
  User,
  KeyRound,
  Eye,
  EyeOff,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react'
import { play } from '../../../../shared/audio/sfx'
import { cyberlockApi } from '../../client/apiClient'

interface LoginPortalProps {
  onLoginSuccess: (user: { username: string; name: string; department: string }) => void
}

export function LoginPortal({ onLoginSuccess }: LoginPortalProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showForgotModal, setShowForgotModal] = useState(false)
  const [successAnimation, setSuccessAnimation] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    play('click')

    try {
      const res = await cyberlockApi.login(username, password)
      if (!res.success || !res.user) {
        setError(res.message || 'Invalid username or password.')
        play('fail')
        setLoading(false)
        return
      }

      setSuccessAnimation(true)
      play('chime')
      setTimeout(() => {
        onLoginSuccess(res.user!)
      }, 900)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Network error during authentication.')
      play('fail')
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center py-6 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden animate-fadeIn">
        {/* Header */}
        <div className="bg-[#002b4d] px-6 py-6 text-white text-center border-b border-[#003c6c]">
          <div className="mx-auto size-12 rounded-xl bg-[#003c6c] flex items-center justify-center text-[#fdc700] mb-3 shadow-inner">
            <Lock className="size-6 text-[#f29813]" />
          </div>
          <h2 className="text-xl font-black tracking-tight text-white">
            VaultTech Intranet Portal
          </h2>
          <p className="mt-1 text-xs text-slate-300 font-mono">
            Authorized Personnel Only · Clearance Level 1+
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-7 space-y-4">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700 flex items-start gap-2.5 animate-fadeIn">
              <AlertCircle className="size-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Access Denied</p>
                <p className="mt-0.5 text-red-600">{error}</p>
              </div>
            </div>
          )}

          {successAnimation && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800 flex items-center gap-3 animate-fadeIn">
              <CheckCircle2 className="size-5 text-emerald-600 shrink-0" />
              <div>
                <p className="font-bold text-sm">Authentication Successful!</p>
                <p className="text-emerald-700">Redirecting to Internal Systems Dashboard...</p>
              </div>
            </div>
          )}

          {/* Username */}
          <div>
            <label htmlFor="loginUsername" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Username
            </label>
            <div className="mt-1.5 relative">
              <User className="size-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="loginUsername"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. amorgan"
                required
                className="w-full pl-9 pr-4 py-2.5 text-xs rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-[#003c6c] focus:ring-1 focus:ring-[#003c6c] focus:outline-none transition font-mono"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="loginPassword" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Password
              </label>
              <button
                type="button"
                onClick={() => {
                  play('pop')
                  setShowForgotModal(true)
                }}
                className="text-xs font-semibold text-[#003c6c] hover:underline cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>
            <div className="mt-1.5 relative">
              <KeyRound className="size-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="loginPassword"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                className="w-full pl-9 pr-10 py-2.5 text-xs rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-[#003c6c] focus:ring-1 focus:ring-[#003c6c] focus:outline-none transition font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || successAnimation}
            className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-[#003c6c] hover:bg-[#f29813] px-5 py-3 font-sans text-xs font-bold uppercase tracking-wider text-white shadow-md transition-all active:translate-y-0.5 cursor-pointer disabled:opacity-50"
          >
            <span>{loading ? 'Authenticating...' : 'Sign In to Portal'}</span>
            <ArrowRight className="size-4" />
          </button>
        </form>

        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 text-center text-[11px] text-slate-500 font-mono">
          VaultTech Directory & Identity Provider v4.2
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans animate-fadeIn">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-[#003c6c]">
              <HelpCircle className="size-6 text-[#f29813]" />
              <h3 className="font-bold text-base">Account Security Hint</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              VaultTech directory self-service recovery hint for user{' '}
              <strong className="text-slate-900 font-mono">amorgan</strong> (Alex Morgan):
            </p>

            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-900">
              <span className="block font-bold uppercase text-[10px] tracking-wider text-amber-800 mb-1">
                Security Recovery Prompt
              </span>
              <p className="italic font-medium">"My favorite robot and the year I joined."</p>
            </div>

            <p className="text-[11px] text-slate-500">
              Tip: Explore the public employee directory and company news pages to discover Alex's
              favorite robot and the year Alex joined VaultTech.
            </p>

            <button
              type="button"
              onClick={() => setShowForgotModal(false)}
              className="w-full rounded-xl bg-[#003c6c] hover:bg-[#002b4d] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition cursor-pointer"
            >
              Return to Login
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
