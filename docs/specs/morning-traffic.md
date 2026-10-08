# Scenario 2 — Morning Traffic (Spec)

Civil and transportation engineering challenge. Students redesign the streets and drop-off around school so students get to class on time, and do so safely, within budget.

It plugs into the same shell as Flooded Campus: layout, toolbox, budget, requirements panel, undo/reset, run button, results modal, test log, and an advanced test unlocked by passing. Read `docs/specs/flooded-campus.md` §1–4 and §7 for shared behavior. This document only covers what's different.

## 1. The problem in one sentence

Every school morning, about 1,800 students arrive between 7:25 and 8:05. Parent drop-off traffic backs up onto Main Street, buses get stuck in it, and walkers cross wherever they can. Too many students are late, and too many crossings are unsafe.

Story intro (one modal, same style as Flooded Campus):

> **MORNING GRIDLOCK**
> Every morning, traffic around Sequoia High School grinds to a halt.
> Parent drop-off lines spill onto Main Street, buses get stuck, and students dodge cars to make it to class.
> The city has asked your engineering team to redesign how students get to school.
> Get students to class on time and safely, while staying within budget.

## 2. Requirements (always visible)

| Requirement | Target | Definition |
|---|---|---|
| Students on time | ≥ 95% | Share of students who reach a school entrance before the 8:05 bell |
| Unsafe crossings | ≤ 20 | Count of student crossings of a vehicle lane that were unsafe (§6.5) |
| Project cost | ≤ $200,000 | Sum of all placed components and programs |

Same rules as Flooded Campus: cost updates live, the other two show "—" until the first test, and going over budget never blocks placement.

The fourth thing the city cares about, cars queued back onto Main Street, is **not** a separate requirement. It hurts on-time arrival on its own (buses and through-traffic get stuck), and it appears as an observation. Keep it to three requirements.

## 3. Map

A fictional block, not the real Sequoia layout. Built as a **lane network** (directed lane segments plus intersection nodes), not a water grid. Suggested features:

- **Main Street** across the north edge: an arterial with 2 lanes each way and steady through traffic that has nothing to do with school.
- **Oak Avenue**, a residential street on the west side, and **Elm Street** on the east side.
- **School driveway and drop-off loop**: enters from Main Street and exits back onto Main Street, with a short default curb (room for about 4 cars to stop at once).
- **Bus stop** for 6 buses, at the Main Street curb by default. A stopped bus blocks the right lane.
- **Staff parking lot** off Elm Street, with a **side gate** into campus that is closed by default.
- **Front plaza** with the main entrance, plus a **side entrance** near the gate.
- **Neighborhood** to the south and west where walkers and bikers come from. Sidewalks have **gaps**. At least one desire line (the shortest walking route) crosses Main Street mid-block, where there's no crosswalk.
- One existing crosswalk at Main & Oak with no signal.

The starting layout must fail clearly (§10).

## 4. Who's traveling

1,800 students, plus background traffic. For performance, **one simulated agent = a small group** (1 car = 2 students, 1 bus = 75 students, 1 walker agent = 4 students, 1 bike agent = 2 students). Count requirements in students, not agents.

| Mode | Default share | Notes |
|---|---|---|
| Parent drop-off (car) | 40% | Enters, waits for a free curb slot, dwells about 20 s, leaves. May turn left in or out. |
| Bus | 25% | 6 buses on fixed routes and schedules; dwells about 60 s |
| Walk | 20% | Follows the sidewalk graph. Jaywalks when the detour to a crosswalk is too long (§6.4). |
| Bike | 15% | Rides in a bike lane if one exists, otherwise mixed with traffic |

Arrivals follow a curve that peaks between 7:45 and 7:58. Through traffic on Main Street runs all morning.

Programs (§5) can **shift mode share**, for example the carpool program removes cars. Infrastructure can too, but only if it **connects**: a bike lane that doesn't link the neighborhood to campus shifts nobody.

## 5. Toolbox

As in Flooded Campus, all costs and effects live in `config.ts`. Several tools **snap to candidate sites** (highlighted when the tool is armed) so the lane network always stays valid, while still leaving real choices: for example 8 crosswalk sites, 4 intersections, 3 bus-bay sites, and 4 turn-lane approaches.

| Tool | Cost | Placement | Effect |
|---|---|---|---|
| Crosswalk | $4,000 | snap: crossing site | Walkers cross here. Cars must yield, which slows them. |
| Flashing Beacon | $15,000 | snap: on a crosswalk | Drivers yield sooner, so crossings at that crosswalk are safe |
| Traffic Signal | $75,000 | snap: intersection | Fixed cycle with a protected walk phase. Configurable green split (Main vs side street). |
| All-Way Stop | $1,500 | snap: Oak Ave service drive or Elm St side gate | Every car stops. Cheap, but slows things at high volume. |
| Crossing Guard | $6,000 | snap: on a crosswalk | Groups walkers and stops cars, so crossings are safe. Delays cars more than a beacon does. |
| Drop-off Curb | $40 / ft | snap: curb edge (loop, Oak Ave, staff lot) | More stopping slots, so a faster drop-off line |
| Turn Lane | $30,000 | snap: approach | Left-turners wait in their own lane instead of blocking through traffic |
| Bus Bay | $40,000 | snap: bus-bay site | Buses pull out of the lane, so they stop blocking traffic |
| Bike Lane | $35 / ft | snap: street segment | Safer bikes. Shifts some car trips to bikes once it connects the neighborhood to campus. |
| Sidewalk | $60 / ft | snap: sidewalk gap | Walkers take this route instead of the street. Shrinks jaywalking detours. |
| Carpool Program | $20,000 | program card (no map placement) | −15% of car trips |
| Open Side Gate | $8,000 | program card (staffing) | Opens a staff-lot drop-off reached from Elm Street |
| Drop-off Helpers | $6,000 | program card (staff/volunteers) | Students are ready and cars pull forward: stop time 25 s → 14 s |

Configurable property (shown in the properties panel): signal green split (60/40, 50/50, 40/60 Main vs. side). The drop-off stop policy became the **Drop-off Helpers** program card instead of a property.

Snap sites as built: 8 crossing sites, 4 signal intersections, 2 all-way-stop sites, 3 turn-lane sites (left-in, right-in, split exit), 3 bus-bay sites, 5 curb edges, 4 bike segments, 3 sidewalk gaps.

## 6. Simulation

Pure TypeScript in `src/scenarios/traffic/sim/`, deterministic (seeded RNG), headless, testable. **Scientific accuracy matters less than visible, logical cause and effect**, the same as the water simulation.

### 6.1 Time

Simulated clock 7:25 → 8:10 (the bell is at 8:05), at a fixed timestep (e.g. 0.5 s of sim time per tick). On screen, about **20 s** total. The clock is shown large during the test.

### 6.2 Vehicles

- Each car moves along lane segments with a simple car-following rule (accelerate to the speed limit, keep a gap, brake for the car ahead, stop lines, red lights, yielding pedestrians).
- At intersections, follow the rules for the control type: signal phase, stop sign (first come, first served), or yield to the major road.
- Drop-off cars queue for a free curb slot, dwell, then merge out. **If the queue reaches Main Street, it spills back** and blocks a through lane. This is the main visible failure.
- Buses use the same rules. A bus at a curb stop blocks the lane; a bus in a bay doesn't.

### 6.3 Pedestrians and bikes

- Walkers follow the shortest path on the sidewalk graph to their entrance and cross streets only at crossing points.
- A bike rides in a bike lane if available; otherwise in the traffic lane at reduced speed, slowing the cars behind it.

### 6.4 Jaywalking

If the walking detour to the nearest crosswalk is more than ~1.5× the direct route (tunable), the walker crosses mid-block instead. That's the lever that makes sidewalk and crosswalk *placement* matter.

### 6.5 Unsafe crossing (count it exactly like this, and document it in code)

A crossing of a vehicle lane is **unsafe** when, at the moment the walker or bike enters the lane:

- it's mid-block (not at a crosswalk), **or**
- it's at a plain crosswalk with no beacon, guard, or walk signal, and a moving car is within 2 s of the crossing point.

Crossings protected by a walk signal, beacon, or guard are always safe. Each unsafe crossing counts the **students in that agent group**.

### 6.6 On time

A student is on time if their agent reaches an entrance (main or side) before 8:05:00. Students still traveling at the bell count as late.

### 6.7 Metrics to collect

On-time %, unsafe crossings (with location), worst Main Street spill-back (max queue length and minutes spilled), average drop-off wait, each bus's lateness, delay at each intersection, mode split actually used, car idling minutes (optional: idling CO₂ as a stat, not a requirement).

## 7. 3D world

Reuse the Flooded Campus visual language: tabletop 3D, green-and-white UI, water-free.

- Low-poly buildings, streets with lane markings, sidewalks, the plaza, and trees.
- **Instanced meshes** for agents. Cars are colored boxes with cabins; buses are long yellow boxes; walkers are small capsules (one per agent group, slightly scaled up); bikes are thin markers. Hundreds of agents need to stay smooth on a school laptop, so never create one React component per agent.
- During the test, show a large clock, brake lights on stopped cars, and a red flash plus small "!" marker on every unsafe crossing as it happens. The Main Street spill-back should be obvious at a glance.
- Diagnostic overlay after a test (the equivalent of the flood map): **delay map**, with streets tinted by how slow they were, plus pins where unsafe crossings happened.

## 8. Results and observations

The same modal as Flooded Campus. Observations are **facts only**:

- "72 students (4%) arrived after the bell."
- "Cars were queued back onto Main Street for 14 minutes (longest queue: 31 cars)."
- "Most unsafe crossings (38) happened on Main Street between Oak Ave and the school driveway."
- "Bus 3 arrived 9 minutes late."
- "The average drop-off wait was 6.2 minutes."

Never prescribe a fix. "Add a crosswalk on Main Street" is forbidden.

Stats after a pass: total cost, on-time %, unsafe crossings, average drop-off wait, longest queue, bus lateness, mode split, car idling minutes. No combined score.

**Advanced test, "Rainy Monday":** car share +30% (some walkers and bikers get driven instead), cars drive 15% slower, and drop-off dwell is longer.

## 9. Interaction notes

- Snap tools show their candidate sites as pulsing markers when armed. Clicking a site places the tool, and invalid sites don't appear.
- Path tools (curb, bike lane, sidewalk) snap to curb edges and gaps while being drawn. Show length and cost live.
- Program cards toggle on and off in a "Programs" section at the bottom of the toolbox. They count toward cost like anything else, and undo covers them.
- Everything else (select, move where meaningful, properties, delete, undo, reset, locked during test) works as in Flooded Campus.

## 10. Balancing targets

| Design | Expected |
|---|---|
| Nothing placed | Fails both: about 80% on time, 100+ unsafe crossings |
| Random items | Usually fails |
| Everything | Can pass technically but goes over $200k |
| A thoughtful design | Passes |
| Rainy Monday | Most first-pass designs fail |

At least these strategies must be able to pass within budget. Encode each one as a fixture design with a Vitest test, like `flood/sim/strategies.ts`:

- **A: Flow engineering.** Turn lanes (left-in, right-in, split exit) + longer drop-off curb. (A signal at the exit is a real tradeoff: it helps the loop but slows Main Street. The tuned design passes without one.)
- **B: Mode shift.** Bike lane + sidewalk gap fixes + carpool program, so fewer cars.
- **C: Spread the load.** Open the side gate (Elm Street drop-off) + bus bay + a couple of crosswalks.
- **D: Low-cost operations.** Drop-off Helpers + carpool program + crossing guard + all-way stops + curb paint.

Also test: "a crosswalk with no protection on a busy Main Street location slows cars measurably" (the safety-vs-flow tradeoff) and "a bike lane that doesn't connect shifts no trips".

### Phase 1 results (balancing table, `TUNE=1 npx vitest run traffic/sim/tune`)

| Design | Cost | On time | Unsafe | Rainy Monday |
|---|---|---|---|---|
| Nothing placed | $0 | 79% | 846 | 64% |
| Random items | $43k | 88% | 846 | 71% |
| A | $149k | 96.6% | 0 | 82% |
| B | $180k | 100% | 0 | 93% |
| C | $108k | 98.8% | 0 | 69% |
| D | $81k | 96.6% | 0 | 86% |
| Everything | $632k | 100% | 0 | 100% |

## 11. Architecture and shell changes

- New module `src/scenarios/traffic/` with the same shape as `flood/`: `config.ts`, `sim/` (engine, strategies, tests, tune table), `world/` (3D), `index.ts` exporting a `Scenario`, a properties component, and placement rules. Add it to `scenarios/registry.ts`. **The start screen then shows two cards** (no placeholders for Earthquake).
- The shell needs two **generic** additions. Keep them scenario-agnostic:
  - `PlacementMode` gains `'snap'` (tool places onto candidate sites that the World provides) and `'program'` (no map placement; the shell renders it as a toggle card).
  - A live clock during the run. Add an optional `clockLabel()` on `SimRun` so any scenario can show time.
- Never import traffic code from the shell or from flood, or the reverse.

## 12. Lessons from Flooded Campus (follow these)

- **Engine first, with a tuning table.** Build the headless engine and the strategy fixtures before any UI. Print a balancing table (`TUNE=1 npx vitest run tune`) and iterate on `config.ts` numbers until §10 holds. That's what made Flooded Campus pass reliably.
- **Performance:** one storm took about 1 s headless. Keep a whole morning under about 2 s headless so the test suite stays reasonable.
- **Don't use drei `<Html>`.** It breaks under React 19 StrictMode. Use the label approach in `flood/world/Labels.tsx` (a DOM layer moved by a projector inside the Canvas).
- **Camera:** `CameraControls.fitToBox` snaps to axis-aligned views. Use `setLookAt` + `getDistanceToFitSphere`, re-run on canvas resize, and keep `maxDistance` high enough not to clamp.
- **React compiler lint** forbids mutating values from `useMemo` or `useState` in `useFrame`. Mutate through refs to three.js objects instead.
- **Browser testing:** drive the installed Chrome with `puppeteer-core` (SwiftShader flags) from the scratchpad. Use dev-only hooks (`window.__setDesign`, a world→screen projector) guarded by `import.meta.env.DEV`, and check that they're absent in production.
- **Never run npm with sudo.** It caused root-owned files and a broken lockfile last time.

## 13. Acceptance checklist

- [ ] Every tool places, snaps, selects, deletes, and undoes. Program cards toggle and undo.
- [ ] Cost math is right, including per-foot tools and programs.
- [ ] The starting layout fails both performance requirements. Strategies A–D each pass within budget. "Everything" goes over budget.
- [ ] Spill-back onto Main Street is clearly visible in the starting layout and gone in passing designs.
- [ ] Unsafe crossings flash where they happen, and their count matches the results.
- [ ] Rainy Monday unlocks only after a pass.
- [ ] Hundreds of agents stay smooth (about 60 fps) at 1366×768 on a mid-range laptop.
- [ ] Observations never give advice.
- [ ] The start screen shows both challenges. Flooded Campus still works, and its tests still pass.
