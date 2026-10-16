# BESA Engineering Lab — Frontend & Simulation Architecture

This directory (`engineering-simulator/`) contains the React 19 + TypeScript + Vite + Three.js application and the headless simulation engines for **BESA Engineering Lab**.

---

## Tech Stack

- **Framework:** React 19 + TypeScript + Vite 8
- **3D Rendering:** Three.js via `@react-three/fiber` and `@react-three/drei` (`CameraControls`, `Line`)
- **Styling:** Tailwind CSS v4 with custom offline-bundled fonts (`Bricolage Grotesque`, `Instrument Sans`, `IBM Plex Mono`) and forest/paper theme tokens in [`src/index.css`](./src/index.css)
- **Icons:** `lucide-react`
- **State Management:** Local React state + `useReducer` undo history (`src/core/history.ts`) + lightweight Zustand UI store where needed (`src/scenarios/flood/world/uiStore.ts`)
- **Testing:** Vitest for headless physics/balancing tests (`vite.config.ts`) and Firebase Emulator integration tests (`vitest.emulator.config.ts`)

---

## Directory & Important Files Reference

### 1. Application Entry & Routing (`src/`)
| File | Purpose |
| :--- | :--- |
| [`src/main.tsx`](./src/main.tsx) | React DOM root mounting `<App />`. |
| [`src/App.tsx`](./src/App.tsx) | Top-level mode router switching between `StartScreen`, solo `Sandbox` (with `IntroModal`), `StudentFlow` (join multiplayer), and `HostFlow` (instructor dashboard). Also handles URL query flags (`?play`, `?join`, `?host`) and auto-resuming saved multiplayer sessions on refresh. |
| [`src/index.css`](./src/index.css) | Global CSS, `@font-face` declarations, and theme palette (`forest`, `paper`, `mint`, `rust`). |

---

### 2. Core Contracts (`src/core/`)
The `core/` directory defines the boundary between the shared UI shell and individual scenarios. **Nothing in `core/` or `shell/` may import from `scenarios/flood/` or `scenarios/traffic/`.**

| File | Purpose |
| :--- | :--- |
| [`src/core/scenario.ts`](./src/core/scenario.ts) | Defines the central `Scenario<O, R>` contract, `ToolDef`, `PlacementMode` (`point`, `footprint`, `path`, `paint`, `link`, `snap`, `program`), `Requirement<R>`, `SimRun<R>`, `WorldProps<O, R>`, and the multiplayer `GroupSync<O>` interface. |
| [`src/core/history.ts`](./src/core/history.ts) | Generic undo/reset state reducer (`designReducer`) managing `design: O[]`, `past: O[][]`, and `selectedId`. |
| [`src/core/format.ts`](./src/core/format.ts) | Currency (`money`) and numeric formatting helpers. |

---

### 3. Shared Shell UI (`src/shell/`)
The shell renders the surrounding engineering workstation UI for any `Scenario`:

| File | Purpose |
| :--- | :--- |
| [`src/shell/Sandbox.tsx`](./src/shell/Sandbox.tsx) | Main workspace orchestrator. Manages the design history, active tool, live budget calculation, simulation playback loop (`requestAnimationFrame` stepping `SimRun` over ~18 seconds), diagnostic overlay toggle, keyboard shortcuts (`Ctrl/Cmd+Z`, `Delete`/`Backspace`, `Escape`, `Shift+D`), and multiplayer `GroupSync` hooks. |
| [`src/shell/Toolbox.tsx`](./src/shell/Toolbox.tsx) | Left panel displaying placeable tools and toggleable `"program"` cards with prices and factual summaries. |
| [`src/shell/RequirementsPanel.tsx`](./src/shell/RequirementsPanel.tsx) | Right-side panel showing live project cost vs. budget, pass/fail status for each scenario requirement, selected object `Properties` editor, and the test run log. |
| [`src/shell/ResultsModal.tsx`](./src/shell/ResultsModal.tsx) | Post-run modal showing requirement pass/fail badges, factual observations (`scenario.observations(result)`), detailed metrics (`scenario.stats(result, design)`), and the unlock banner for the advanced challenge variant. |
| [`src/shell/IntroModal.tsx`](./src/shell/IntroModal.tsx) | Scenario briefing modal shown before entering a solo challenge. |
| [`src/shell/StartScreen.tsx`](./src/shell/StartScreen.tsx) | Landing page displaying scenario cards (from `scenarios/registry.ts`) plus "Join Session" and "Host Session" multiplayer entry points. |
| [`src/shell/BrandMark.tsx`](./src/shell/BrandMark.tsx) | BESA Engineering Lab logo and header badge. |

---

### 4. Shared 3D Utilities (`src/shared/three/`)
| File | Purpose |
| :--- | :--- |
| [`src/shared/three/CameraRig.tsx`](./src/shared/three/CameraRig.tsx) | Isometric-style `CameraControls` wrapper using `setLookAt` + `getDistanceToFitSphere` (re-fitting automatically on canvas resize). |
| [`src/shared/three/camera.ts`](./src/shared/three/camera.ts) | Camera spherical/bounding-box helper math. |
| [`src/shared/three/Labels.tsx`](./src/shared/three/Labels.tsx) | React 19 StrictMode-safe 3D-to-2D label projection system. Projects 3D world coordinates inside `useFrame` onto HTML DOM elements without using `@react-three/drei`'s `<Html>`. |

---

### 5. Scenarios (`src/scenarios/`)
[`src/scenarios/registry.ts`](./src/scenarios/registry.ts) exports the active list of scenarios (`[floodScenario, trafficScenario]`). Each scenario folder is self-contained:

#### Scenario 1: Flooded Campus (`src/scenarios/flood/`)
Civil & environmental engineering challenge: protect campus buildings and main walkways from stormwater runoff within a \$150,000 budget.

| File | Purpose |
| :--- | :--- |
| [`index.ts`](./src/scenarios/flood/index.ts) | Exports `floodScenario` implementing `Scenario<FloodObject, SimResult>`, defining tools, requirements, variants (`Design Storm` & `Back-to-Back Storms`), factual observations, and summary stats. |
| [`config.ts`](./src/scenarios/flood/config.ts) | All tunable constants: grid dimensions, rainfall curves, Manning roughness, infiltration rates, tool costs, capacities, and requirement thresholds. |
| [`campus.ts`](./src/scenarios/flood/campus.ts) | Static campus layout: terrain elevation model, buildings (`A`, `B`, `C`, `Gym`), paved surfaces, storm sewer trunk line, and existing drains. |
| [`types.ts`](./src/scenarios/flood/types.ts) & [`cost.ts`](./src/scenarios/flood/cost.ts) | Data types for placed stormwater objects (`drain`, `pipe`, `bioswale`, `permeable`, `basin`, `wall`, `garden`, `grade`) and cost calculation. |
| [`rules.ts`](./src/scenarios/flood/rules.ts) & [`geometry.ts`](./src/scenarios/flood/geometry.ts) | Placement validation rules (e.g., preventing placement inside buildings or out of bounds) and 2D grid rasterization helpers. |
| [`sim/engine.ts`](./src/scenarios/flood/sim/engine.ts) | **Headless 2D Shallow-Water Simulation Engine.** Steps rainfall, infiltration, detention storage, drain/pipe capture, and 4-neighbor diffusive overland flow across the grid. |
| [`sim/strategies.ts`](./src/scenarios/flood/sim/strategies.ts) | Reference fixture designs (Strategies A–D, empty, random, over-budget) used for automated balancing verification. |
| [`sim/engine.test.ts`](./src/scenarios/flood/sim/engine.test.ts) & [`sim/tune.test.ts`](./src/scenarios/flood/sim/tune.test.ts) | Vitest physics unit tests and the `TUNE=1` balancing table runner. |
| [`world/FloodWorld.tsx`](./src/scenarios/flood/world/FloodWorld.tsx) | 3D Canvas root for Flooded Campus, coordinating pointer interactions (`point`, `footprint`, `path`, `paint`, `link`), live ghost previews, and water rendering. |
| [`world/Ground.tsx`](./src/scenarios/flood/world/Ground.tsx), [`Objects.tsx`](./src/scenarios/flood/world/Objects.tsx), [`Scenery.tsx`](./src/scenarios/flood/world/Scenery.tsx), [`Atmosphere.tsx`](./src/scenarios/flood/world/Atmosphere.tsx) | 3D terrain mesh, animated water surface/peak flood map overlay, placed stormwater components, low-poly buildings/trees, and rain particles. |

#### Scenario 2: Morning Traffic (`src/scenarios/traffic/`)
Civil & transportation engineering challenge: get $\ge 95\%$ of 1,800 students to school before the 8:05 bell with $\le 20$ unsafe crossings and a $\le \$200,000$ budget.

| File | Purpose |
| :--- | :--- |
| [`index.ts`](./src/scenarios/traffic/index.ts) | Exports `trafficScenario` implementing `Scenario<TrafficObject, TrafficResult>`, defining snap/program tools, requirements, variants (`Morning Rush` & `Rainy Monday`), factual observations, and stats. |
| [`config.ts`](./src/scenarios/traffic/config.ts) | All tunable constants: student total (1,800), mode shares, arrival curves, vehicle speeds/headways, dwell times, jaywalking detour threshold, and tool costs. |
| [`network.ts`](./src/scenarios/traffic/network.ts) & [`sites.ts`](./src/scenarios/traffic/sites.ts) | Directed lane graph (`Main St`, `Oak Ave`, `Elm St`, drop-off loop, staff lot), sidewalk graph, and candidate snap sites for crosswalks, signals, stop signs, turn lanes, bus bays, curbs, bike lanes, and sidewalk gaps. |
| [`types.ts`](./src/scenarios/traffic/types.ts) & [`cost.ts`](./src/scenarios/traffic/cost.ts) | Data types for `TrafficObject` (snap placements + program cards) and cost calculation (flat + per-foot tools). |
| [`sim/engine.ts`](./src/scenarios/traffic/sim/engine.ts) | **Headless Agent-Based Traffic Simulation Engine.** Simulates 7:25–8:10 AM at 0.5 s ticks: mode-split calculation, car-following, intersection controls (signals, all-way stops, yields), curb slot queuing, Main Street spill-back, pedestrian routing, jaywalking, and unsafe crossing detection. |
| [`sim/strategies.ts`](./src/scenarios/traffic/sim/strategies.ts) | Reference fixture designs (Strategies A: Flow Engineering, B: Mode Shift, C: Spread the Load, D: Low-Cost Operations). |
| [`sim/engine.test.ts`](./src/scenarios/traffic/sim/engine.test.ts) & [`sim/tune.test.ts`](./src/scenarios/traffic/sim/tune.test.ts) | Vitest test suite verifying all balancing targets and printing the `TUNE=1` summary table. |
| [`world/TrafficWorld.tsx`](./src/scenarios/traffic/world/TrafficWorld.tsx) | 3D Canvas root for Morning Traffic, rendering snap-site markers, streets, placed infrastructure, and instanced agents. |
| [`world/Agents.tsx`](./src/scenarios/traffic/world/Agents.tsx) | High-performance `InstancedMesh` renderer for cars (with brake lights), buses, pedestrians, bikes, and live red `!` unsafe-crossing flashes. |
| [`world/Streets.tsx`](./src/scenarios/traffic/world/Streets.tsx), [`Placed.tsx`](./src/scenarios/traffic/world/Placed.tsx), [`DelayMap.tsx`](./src/scenarios/traffic/world/DelayMap.tsx) | 3D road geometry, placed traffic control meshes, and post-run diagnostic delay heatmap + unsafe-crossing pins. |

#### Scenario 3: Rocket Team — IREC (`src/scenarios/rocket/`)
Aerospace, mechanical, and mechatronics challenge for a 6-person team split into two 3-person sub-teams (**Payload Sub-Team** and **Rocket Sub-Team**), targeting a 10,000 ft apogee and bullseye payload recovery within a \$120,000 budget.

| File | Purpose |
| :--- | :--- |
| [`index.ts`](./src/scenarios/rocket/index.ts) | Exports `rocketScenario` implementing `Scenario<RocketObject, RocketResult>`, defining the 6 role station tools, team programs, variants (`Full IREC Mission`, `Payload Drop Test`, `Rocket Flight Test`, `Desert Crosswind Finals`), factual observations, and summary stats. |
| [`roles.ts`](./src/scenarios/rocket/roles.ts) | Defines the 6 sub-team roles (`payload-gyro`, `payload-motor`, `payload-tester`, `rocket-mass`, `rocket-material`, `rocket-tester`) and the deterministic 1st/2nd choice **Role Preference Tier List** assignment algorithm (`assignRocketRoles`). |
| [`config.ts`](./src/scenarios/rocket/config.ts) & [`types.ts`](./src/scenarios/rocket/types.ts) | Specs and tunable constants for the 5 payload motors, 3-axis gyroscope calibration, parachute sizes, 6 internal rocket bays, 5 airframe materials, nose cones, fin profiles, and solid motor impulse classes. |
| [`sim/engine.ts`](./src/scenarios/rocket/sim/engine.ts) | **Headless Rocket & Payload Simulation Engine.** Computes $CG$/$CP$ stability in calibers, structural Max-Q limits, apogee altitude, and payload descent physics (`target-landed`, comedic `splatter` when motor is too heavy/chute too late, and `spin-motor-weak` / `spin-gyro-uncalibrated` when out of control), plus live `deployParachute()` triggering. |
| [`sim/strategies.ts`](./src/scenarios/rocket/sim/strategies.ts), [`sim/engine.test.ts`](./src/scenarios/rocket/sim/engine.test.ts), [`sim/tune.test.ts`](./src/scenarios/rocket/sim/tune.test.ts) | Reference passing strategies (Strategies A–D), failure fixtures, role-matching unit tests, and the `TUNE=1` balancing table. |
| [`world/RocketWorld.tsx`](./src/scenarios/rocket/world/RocketWorld.tsx) & [`world/RocketScene.tsx`](./src/scenarios/rocket/world/RocketScene.tsx) | 3D Spaceport America launch/drop range with dynamic chase camera following the rocket to apogee and tracking the falling payload to the bullseye pad (including 32-piece comedic splatter debris and out-of-control spin visuals). |
| [`world/PayloadStations.tsx`](./src/scenarios/rocket/world/PayloadStations.tsx), [`world/RocketStations.tsx`](./src/scenarios/rocket/world/RocketStations.tsx), [`world/RoleTierModal.tsx`](./src/scenarios/rocket/world/RoleTierModal.tsx) | Interactive workstations for the 6 roles (timing-ring gyroscope game, motor selector, drop test rig, drag-and-drop weight bay stack, airframe material selector, launch pad setup) and the 2-choice Role Preference Tier List modal. |

---

### 6. Multiplayer Client (`src/multiplayer/`)
Provides real-time classroom sessions backed by Firebase Auth and Cloud Firestore. (See [`../firebase/README.md`](../firebase/README.md) for backend schema and security rules.)

| File | Purpose |
| :--- | :--- |
| [`firebase.ts`](./src/multiplayer/firebase.ts) | Initializes Firebase App, Auth, and Firestore; connects to local emulators when `VITE_USE_EMULATORS=1`, and provides `signInStudent` (anonymous) and `signInInstructor` (Google OAuth). |
| [`types.ts`](./src/multiplayer/types.ts) | Scenario-agnostic TypeScript interfaces: `Session`, `Player`, `Group`, `SharedDoc`, and `GroupEvent`. |
| [`api.ts`](./src/multiplayer/api.ts) | Firestore operations: `createSession`, `joinSession`, `setChoices`, `makeTeams`, `assignLateJoiner`, `setSessionState`, `pushDesign`, `postEvent`, and `deleteSession`. |
| [`teams.ts`](./src/multiplayer/teams.ts) & [`teams.test.ts`](./src/multiplayer/teams.test.ts) | Pure algorithm (`planTeams`, `placeLate`) that groups students into balanced teams and assigns physical room stations (`1..N`) based on students' ranked challenge preferences. |
| [`hooks.ts`](./src/multiplayer/hooks.ts) | React hooks subscribing to Firestore documents (`useSession`, `usePlayers`, `useGroups`, `useGroupSync`, `useGroupEvents`, `useCountdown`) and implementing the `GroupSync` interface passed to `<Sandbox />`. |
| [`saved.ts`](./src/multiplayer/saved.ts) | `sessionStorage` / `localStorage` persistence so refreshing a tab returns a student or instructor straight back into their active session. |
| [`ui/HostFlow.tsx`](./src/multiplayer/ui/HostFlow.tsx) | Instructor UI: Google sign-in, challenge picker, lobby with 6-digit join code & live player list, team/station generator, round timer, broadcast announcements, and live group leaderboard/spectator view. |
| [`ui/StudentFlow.tsx`](./src/multiplayer/ui/StudentFlow.tsx) | Student UI: 6-digit code + name entry, challenge preference ranking in the lobby, station/teammate assignment banner, and collaborative `<Sandbox sync={groupSync} />`. |

---

## Key Engineering & Rendering Rules

1. **Pure TypeScript Simulations (`src/scenarios/*/sim/`):**
   - Never import React, Three.js, or DOM APIs inside `sim/`.
   - Always use a seeded RNG so identical designs produce identical results across all student devices and in Vitest.
   - Keep headless execution under ~1–2 seconds per full run so test suites stay fast.
2. **React 19 + Three.js Best Practices:**
   - **Never use `@react-three/drei` `<Html>`** — it breaks under React 19 StrictMode. Use [`src/shared/three/Labels.tsx`](./src/shared/three/Labels.tsx) instead.
   - **Never mutate values returned from `useMemo` or `useState` inside `useFrame`** (enforced by `eslint-plugin-react-hooks`). Mutate Three.js objects via `useRef`.
   - **Use `InstancedMesh`** for dynamic agent populations (cars, walkers, rain) to maintain 60 FPS at `1366×768` on school laptops.

---

## Adding a New Scenario

1. Write the specification in `docs/specs/<scenario-name>.md`.
2. Create `src/scenarios/<scenario-name>/`:
   - `config.ts` & `types.ts`
   - `sim/engine.ts` (headless `SimRun<R>` implementation)
   - `sim/strategies.ts`, `sim/engine.test.ts`, and `sim/tune.test.ts`
   - `world/<Scenario>World.tsx` & `<Scenario>Properties.tsx`
   - `index.ts` exporting a `Scenario<O, R>` object
3. Register the scenario in [`src/scenarios/registry.ts`](./src/scenarios/registry.ts). The start screen and multiplayer host challenge selector will pick it up automatically.
