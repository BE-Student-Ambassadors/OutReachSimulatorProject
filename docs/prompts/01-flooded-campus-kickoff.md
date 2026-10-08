# Kickoff prompt — Flooded Campus

Paste everything below the line into Claude Code (from the repo root). Start in plan mode (Shift+Tab) so you can review the plan before any code is written.

---

Build the **Flooded Campus** scenario for Sequoia Engineering Lab. The full requirements are in `docs/specs/flooded-campus.md` and the project rules are in `CLAUDE.md`. Read both first.

**Before writing code:**
1. Inspect `engineering-simulator/`. It's a fresh Vite + React 19 + TS scaffold. Remove the demo content.
2. Propose the folder structure, the `Scenario` interface (what's shared shell code and what's scenario-specific), the state approach, and how the canvas and React layers split responsibilities. Keep it short, then wait for my approval.

**Then build in phases. Stop after each phase, summarize what works, and tell me how to try it:**

1. **Shell + map.** Tailwind setup, three-column layout, top and bottom bars, campus terrain rendered on canvas, debug grid toggle.
2. **Engine + balancing tests.** Pure-TS water simulation (headless, deterministic). Vitest setup. Fixture designs for "empty fails" and strategies A–D from spec §10. Tune the numbers until the tests match the balancing targets. *This is the most important phase, so don't rush it.*
3. **Tools + interaction.** Toolbox drag/drop, all component types, select, move, delete, properties panel, live budget, undo, reset.
4. **Storm test + results.** Animated storm wired to the engine, results modal with factual observations, max-flood overlay, success state, optimization stats, Advanced Storm unlock.
5. **Start screen, intro, first-run instructions, polish.**

**For every phase:** run `npm run build`, `npm run lint`, and `npm test`, then open the app and actually exercise the new features (use a browser tool if one is available), check the console for errors, and fix what you find before stopping. At the end, work through the acceptance checklist in spec §11 and report each item honestly, including anything that's unverified.

Don't build Morning Traffic or Earthquake Retrofit, or placeholders for them.
