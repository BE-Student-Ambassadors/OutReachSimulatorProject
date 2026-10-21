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
        <div className="w-full max-w-[520px] rounded-2xl bg-white p-6 shadow-xl ring-1 ring-line">
          <div className="flex items-center gap-2 text-rust">
            <AlertTriangle className="size-5" />
            <h2 className="font-display text-xl font-bold">{webgl ? 'This browser can’t show 3D right now' : 'Something went wrong in this view'}</h2>
          </div>
          {webgl ? (
            <>
              <p className="mt-2 text-sm text-ink/75">The browser refused to start its 3D graphics (WebGL). Your design is still saved. Things that usually fix it:</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-ink/75">
                <li>Close other tabs with games, maps or video, then press Try again.</li>
                <li>Quit Chrome completely and reopen it (a graphics crash turns 3D off until Chrome restarts).</li>
                <li>
                  In Chrome Settings → System, turn on <span className="font-semibold">Use graphics acceleration when available</span>, then relaunch.
                </li>
              </ol>
            </>
          ) : (
            <p className="mt-2 text-sm text-ink/75">Your design is still saved. Try again, or reload the page.</p>
          )}
          <button
            type="button"
            onClick={() => this.setState((s) => ({ error: null, attempt: s.attempt + 1 }))}
            className="btn-press mt-4 flex items-center gap-2 rounded-xl bg-forest px-5 py-2.5 font-display text-sm font-bold text-white hover:bg-forest-dark"
          >
            <RotateCcw className="size-4" /> Try again
          </button>
        </div>
      </div>
    )
  }
}
