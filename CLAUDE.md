# Sequoia Engineering Lab

Browser-based engineering sandbox for a high-school outreach event (Sequoia High School × UC Santa Cruz Engineering). Small groups of students get 10–15 minutes to design, test, fail, and iterate until their design meets measurable requirements.

Full spec for the current scenario: `docs/specs/flooded-campus.md`. Read it before working on gameplay, balancing, or UI.

## Repo layout

- `engineering-simulator/` — the Vite app (React 19, TypeScript, Vite). Run all npm commands from here.
- `docs/specs/` — scenario specs (source of truth for requirements).
- `docs/prompts/` — kickoff prompts used to start each build phase.

## Commands (from `engineering-simulator/`)

- `npm run dev` — dev server
- `npm run build` — type-check + production build (must pass before calling work done)
- `npm run lint` — ESLint
- `npm test` — Vitest balancing + physics tests (~30 s)
- `TUNE=1 npx vitest run tune` — prints a balancing table for all reference strategies
- URL flags: `?play` skips the start screen, `?debug` (or Shift+D) shows grid/elevation info

## Stack decisions

- **Client-side only.** No backend, no Firebase, no Express. Don't add one unless the user asks.
- React + TypeScript + Vite + Tailwind CSS. The world is **3D**: Three.js via `@react-three/fiber` + `@react-three/drei` (CameraControls, Line). Don't use drei `<Html>` (it breaks under React 19 StrictMode); 3D-pinned labels go through `world/Labels.tsx`.
- Look: green and white ("Sequoia green" `forest`, `paper`, `mint`; `rust` for failures). Avoid blue in the UI chrome — water is the only blue. Fonts are bundled (offline-safe): Bricolage Grotesque (display), Instrument Sans (body), IBM Plex Mono (numbers). Theme tokens live in `src/index.css`.
- Target: Chrome on ordinary school laptops at 1366×768 and up. Desktop only; mobile isn't needed.
- Keep dependencies minimal. Ask before adding anything heavy (game engines, physics libraries, state libraries beyond a small store such as Zustand).

## Architecture rules

- **Scenario modules.** Flooded Campus is the only scenario for now, but Morning Traffic (agent-based) and Earthquake Retrofit (structural) will follow. Shared shell code (layout, toolbox, drag/drop, selection, properties panel, budget, objectives, undo/reset, run controls, results modal, scenario select) must not import flood-specific code. Each scenario provides its own tools, map, simulation, and metrics through a common `Scenario` interface.
- **The simulation engine is pure TypeScript.** No React or DOM imports in `src/scenarios/*/sim/`. It must run headlessly so balancing can be tested with Vitest (e.g. "the empty design fails" and "strategy B passes").
- Don't build placeholder or "coming soon" versions of future scenarios.

## Design principles (do not violate)

The message students should come away with: *"Engineering is not finding THE correct answer. Engineering is designing a solution that satisfies requirements under constraints."* Teach through experimentation, not a tutorial: constraints, tradeoffs, systems thinking, iteration, cost vs. performance, resilience.

- **Never tell students how to fix their design.** Results may report facts ("Building B had the deepest flooding: 4.7 in") but never prescriptions ("add a drain near Building B"). This applies to results, tooltips, and component descriptions.
- **Several strategies must be able to pass.** There is no single correct layout.
- **Going over budget never blocks placement.** It only fails the budget requirement.
- No single combined "engineering score". Keep the metrics separate and understandable.
- Iteration speed matters more than realism. A storm test runs for about 15–25 seconds.
- Tone: polished mini engineering simulator. Not CAD software, not a worksheet, not a kids' game.

## Definition of done for any change

`npm run build` and `npm run lint` pass, engine tests pass, the browser console shows no errors, and you have actually exercised the change in the running app.
