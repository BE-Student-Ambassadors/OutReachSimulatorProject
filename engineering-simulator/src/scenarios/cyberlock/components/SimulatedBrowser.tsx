import { useState, type ReactNode } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Lock,
  Globe,
  ShieldCheck,
} from 'lucide-react'

interface SimulatedBrowserProps {
  url: string
  onNavigate: (url: string) => void
  title?: string
  children: ReactNode
}

export function SimulatedBrowser({
  url,
  onNavigate,
  title = 'VaultTech Internal Network',
  children,
}: SimulatedBrowserProps) {
  const [prevUrl, setPrevUrl] = useState(url)
  const [inputUrl, setInputUrl] = useState(url)
  const [isSecure] = useState(true)

  if (prevUrl !== url) {
    setPrevUrl(url)
    setInputUrl(url)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (inputUrl.trim()) {
      onNavigate(inputUrl.trim())
    }
  }

  return (
    <div className="flex flex-col h-full rounded-xl border border-slate-700/60 bg-slate-900 shadow-2xl overflow-hidden font-sans">
      {/* Top Browser Chrome Window Bar */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-slate-950 border-b border-slate-800 select-none">
        <div className="flex items-center gap-2">
          {/* Traffic light window controls */}
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
          </div>

          <div className="h-4 w-px bg-slate-800 mx-1.5" />

          {/* Active Tab */}
          <div className="flex items-center gap-2 px-3 py-1 bg-slate-850 rounded-t-lg border-t-2 border-t-amber-500 border-x border-slate-800 text-xs font-medium text-slate-200">
            <ShieldCheck className="size-3.5 text-amber-400" />
            <span className="max-w-[200px] truncate">{title}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
          <span className="inline-block px-1.5 py-0.5 rounded bg-slate-800 text-emerald-400 font-semibold">
            SECURE SANDBOX
          </span>
        </div>
      </div>

      {/* Navigation Controls & Address Bar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-1 text-slate-400">
          <button
            type="button"
            onClick={() => onNavigate('/portal')}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
            title="Back to portal home"
          >
            <ArrowLeft className="size-4" />
          </button>
          <button
            type="button"
            disabled
            className="p-1 rounded text-slate-600 cursor-not-allowed"
            title="Forward"
          >
            <ArrowRight className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => onNavigate(url)}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
            title="Reload current page"
          >
            <RotateCw className="size-3.5" />
          </button>
        </div>

        {/* Editable URL Bar */}
        <form onSubmit={handleSubmit} className="flex-1 flex items-center">
          <div className="w-full flex items-center rounded-lg bg-slate-950 border border-slate-700/80 px-2.5 py-1 text-xs text-slate-200 focus-within:border-amber-500 focus-within:ring-1 focus-within:ring-amber-500 transition">
            {isSecure ? (
              <Lock className="size-3.5 text-emerald-400 shrink-0 mr-2" />
            ) : (
              <Globe className="size-3.5 text-slate-400 shrink-0 mr-2" />
            )}
            <span className="text-slate-500 font-mono text-[11px] select-none mr-0.5">
              https://internal.vaulttech.corp
            </span>
            <input
              type="text"
              value={inputUrl.startsWith('https://internal.vaulttech.corp') ? inputUrl.replace('https://internal.vaulttech.corp', '') : inputUrl}
              onChange={(e) => {
                const val = e.target.value
                setInputUrl(val.startsWith('/') ? val : '/' + val)
              }}
              placeholder="/portal"
              className="flex-1 bg-transparent font-mono text-xs text-amber-300 focus:outline-none"
              title="Simulated Browser URL Bar (Press Enter to navigate)"
            />
            <button
              type="submit"
              className="ml-2 px-2 py-0.5 rounded bg-slate-800 hover:bg-amber-600 hover:text-white text-[10px] font-mono text-slate-300 transition cursor-pointer"
            >
              GO
            </button>
          </div>
        </form>
      </div>

      {/* Browser Viewport */}
      <div className="flex-1 overflow-auto bg-slate-950 text-slate-100 min-h-0">
        {children}
      </div>
    </div>
  )
}
