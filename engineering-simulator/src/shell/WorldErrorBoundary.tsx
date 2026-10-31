import { AlertTriangle, Bug, RotateCcw, Trash2 } from 'lucide-react'
import { Component, type ErrorInfo, type ReactNode } from 'react'

/** True when the browser refused to give the page a 3D (WebGL) drawing surface. */
const isWebGLError = (e: unknown) => /webgl|context could not be created|creating webgl context/i.test(String((e as Error)?.message ?? e))

/**
 * Catches a scenario's World crashing (most often: the browser won't create a WebGL context)
 * and shows what to do instead of a blank screen. "Try again" remounts the World.
 * In ?dev=true mode, surfaces detailed error messages and component stacks for engineering inspection.
 */
export class WorldErrorBoundary extends Component<
  { children: ReactNode },
  { error: unknown; errorInfo: ErrorInfo | null; attempt: number }
> {
  state = { error: null as unknown, errorInfo: null as ErrorInfo | null, attempt: 0 }

  static getDerivedStateFromError(error: unknown) {
    return { error }
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    console.warn('The challenge view stopped:', error, errorInfo)
    this.setState({ errorInfo })
  }

  render() {
    if (!this.state.error) return <div key={this.state.attempt} className="contents">{this.props.children}</div>
    const webgl = isWebGLError(this.state.error)
    const isDev =
      typeof window !== 'undefined' &&
      (new URLSearchParams(window.location.search).get('dev') === 'true' ||
        new URLSearchParams(window.location.search).has('dev'))

    const err = this.state.error as Error | undefined
    const errorMessage = err?.message || String(this.state.error)

    return (
      <div className="grid h-full place-items-center p-6">
        <div className={`w-full ${isDev ? 'max-w-[680px]' : 'max-w-[520px]'} rounded-2xl bg-white p-6 shadow-xl border border-[#d8e0ea]`}>
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="size-5" />
            <h2 className="font-sans text-xl font-bold text-[#003c6c]">{webgl ? '3D Graphics Acceleration Required' : 'Simulation View Encountered an Error'}</h2>
          </div>
          {webgl ? (
            <>
              <p className="mt-2 text-sm text-[#75787b]">The browser could not initialize hardware-accelerated 3D graphics (WebGL). Your engineering configuration is safely preserved.</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-[#0b1d2e]/80">
                <li>Close resource-heavy browser tabs with 3D models or video streams.</li>
                <li>Ensure hardware acceleration is enabled in Chrome Settings → System.</li>
                <li>Relaunch Chrome or press Try Again below.</li>
              </ol>
            </>
          ) : (
            <p className="mt-2 text-sm text-[#75787b]">Your design configuration is preserved. Press Try Again to reinitialize the viewport.</p>
          )}

          {isDev && !webgl && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50/80 p-3.5 text-xs text-red-950 font-mono">
              <div className="flex items-center gap-1.5 font-bold text-red-800">
                <Bug className="size-3.5" />
                <span>Developer Diagnostic (?dev=true)</span>
              </div>
              <p className="mt-1 font-semibold text-red-900 break-words">
                {err?.name || 'Error'}: {errorMessage}
              </p>
              {err?.stack && (
                <details className="mt-2 rounded border border-red-200 bg-white/80 p-2 text-[10px] text-red-900/90 whitespace-pre-wrap max-h-36 overflow-y-auto">
                  <summary className="cursor-pointer font-bold text-red-700 select-none">Error Stack Trace</summary>
                  <div className="mt-1">{err.stack}</div>
                </details>
              )}
              {this.state.errorInfo?.componentStack && (
                <details className="mt-1.5 rounded border border-red-200 bg-white/80 p-2 text-[10px] text-red-900/90 whitespace-pre-wrap max-h-36 overflow-y-auto">
                  <summary className="cursor-pointer font-bold text-red-700 select-none">React Component Stack</summary>
                  <div className="mt-1">{this.state.errorInfo.componentStack}</div>
                </details>
              )}
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => this.setState((s) => ({ error: null, errorInfo: null, attempt: s.attempt + 1 }))}
              className="btn-press flex items-center gap-2 rounded-xl bg-[#003c6c] px-5 py-2.5 font-sans text-sm font-bold uppercase tracking-wider text-white hover:bg-[#f29813] transition cursor-pointer"
            >
              <RotateCcw className="size-4" /> Try Again
            </button>
            {isDev && (
              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.removeItem('besa_arena_builder_project')
                    this.setState((s) => ({ error: null, errorInfo: null, attempt: s.attempt + 1 }))
                  } catch {
                    // storage unavailable
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 transition cursor-pointer"
              >
                <Trash2 className="size-3.5 text-slate-500" />
                Clear Local Storage & Retry
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }
}
