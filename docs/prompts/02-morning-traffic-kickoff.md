# Kickoff prompt — Morning Traffic

Paste everything below the line into Claude Code (from the repo root). Start in plan mode (Shift+Tab) so you can review the plan before any code is written.

---

Build the **Morning Traffic** scenario for BESA Engineering Lab. The requirements are in `docs/specs/morning-traffic.md`, and the project rules are in `CLAUDE.md`. Flooded Campus (`engineering-simulator/src/scenarios/flood/`) is the reference implementation: match its structure, and read spec §12 ("Lessons from Flooded Campus") before you start.

**Before writing code:**
1. Read the spec, `CLAUDE.md`, `src/core/scenario.ts`, and skim `src/scenarios/flood/`.
2. Propose: the lane-network data model, the agent update loop, how snap sites and program cards fit into the `Scenario` interface (spec §11), and the file layout. Keep it short, then wait for my approval.

**Then build in phases. Stop after each phase, summarize what works, and tell me how to try it:**

1. **Engine + balancing tests.** Headless network, agents, intersection control, drop-off, jaywalking rule, metrics. Fixture designs for "nothing placed" and strategies A–D. Iterate on `config.ts` with the tuning table until spec §10 holds. *This is the most important phase.*
2. **3D street world.** Streets, campus, instanced agents moving from the engine, the clock, spill-back clearly visible.
3. **Tools + interaction.** Snap sites, path tools, program cards, properties, undo, live cost.
4. **Test run + results.** Unsafe-crossing flashes, results modal with factual observations, delay map, Rainy Monday unlock.
5. **Start screen with both challenges, polish, full acceptance checklist (spec §13).**

**For every phase:** run `npm run build`, `npm run lint`, and `npm test` in `engineering-simulator/`, and confirm the Flooded Campus tests still pass. Open the app in Chrome (puppeteer-core) and actually exercise the new features, check the console for errors, and fix what you find before stopping. Work on a branch and don't push without asking.

Don't build Earthquake Retrofit, or a placeholder for it.
