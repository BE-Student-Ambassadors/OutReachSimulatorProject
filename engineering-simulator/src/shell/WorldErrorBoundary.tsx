import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Component, type ReactNode } from 'react'

/** True when the browser refused to give the page a 3D (WebGL) drawing surface. */
const isWebGLError = (e: unknown) => /webgl|context could not be created|creating webgl context/i.test(String((e as Error)?.message ?? e))

/**
 * Catches a scenario's World crashing (most often: the browser won't create a WebGL context)
 * and shows what to do instead of a blank screen. "Try again" remounts the World.
 */
export class WorldErrorBoundary extends Component<{ children: ReactNode }, { error: unknown; attempt: number }> {
  state = { error: null as unknown, attempt: 0 }

  static getDerivedStateFromError(error: unknown) {
    return { error }
  }

  componentDidCatch(error: unknown) {
    console.warn('The challenge view stopped:', error)
  }

  render() {
    if (!this.state.error) return <div key={this.state.attempt} className="contents">{this.props.children}</div>
    const webgl = isWebGLError(this.state.error)
    return (
      <div className="grid h-full place-items-center p-6">
        <div className="w-full max-w-[520px] rounded-2xl bg-white p-6 shadow-xl border border-[#d8e0ea]">
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
          <button
            type="button"
            onClick={() => this.setState((s) => ({ error: null, attempt: s.attempt + 1 }))}
            className="btn-press mt-5 flex items-center gap-2 rounded-xl bg-[#003c6c] px-5 py-2.5 font-sans text-sm font-bold uppercase tracking-wider text-white hover:bg-[#f29813] transition"
          >
            <RotateCcw className="size-4" /> Try Again
          </button>
        </div>
      </div>
    )
  }
}
