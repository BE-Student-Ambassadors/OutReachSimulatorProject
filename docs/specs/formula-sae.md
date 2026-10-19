# Scenario 2 — Formula SAE (Spec)

Replaces Morning Traffic. Mechanical + electrical + software + business engineering, themed on **Formula SAE**, where university teams design, build and race a small race car.

A team of **4** shares one car. Each student takes one job (anyone can still open any station). Everything they do feeds one car, which is then measured by a Competition Test and raced by every teammate on Race Day.

Code: `engineering-simulator/src/scenarios/fsae/`. All tunable numbers are in `config.ts`. Balancing: `TUNE=1 npx vitest run fsae/sim/tune`.

## 1. Requirements (Competition Test)

| Requirement | Target | Comes mostly from |
|---|---|---|
| Autocross lap time | ≤ 31.8 s | Mechanical (aero, size, welds) + Electrical (motor power) |
| Driverless cones hit | ≤ 2 of 40 | Software (model weights) + Electrical (computer power; headlights at night) |
| Power systems in range | 5 of 5 | Electrical |
| Car is paid for | cost ≤ money raised | Business (sponsors) + everyone's spending |

Systems thinking is built in: e.g. an over-voltage motor makes the car slower; dim headlights don't matter by day but blind the cameras in the Night Test; a wider car grips more but costs more.

Variants: **Competition Test** (day) and **Night Test** (camera visibility follows the headlights).

## 2. Stations

### Mechanical
- **Weld** 8 frame joints in 3D: press and hold a joint, release while the heat meter is in the green window (55–80 %). Cold, overheated and barely-tacked welds are weaker; any joint can be re-welded. Weld quality → frame stiffness → tire grip.
- **Slide the wings** in/out (front and rear, 0–100 %). More out = more downforce and more drag, and moves the front/rear balance.
- **Size the car**: wheelbase (short turns in better in tight corners, long is steadier in fast ones), track width (grip vs mass/drag/cost), ride height (low floor = ground effect; too low scrapes).
- **Wind tunnel**: simulated air streams over the car; reports downforce, drag, front-axle share and handling (understeer / neutral / oversteer) as facts.

### Electrical
Five lines, each with a rated range: drive motor (38–42 V from 48 V), cooling pump (22–26 V from 48 V), headlights (11.5–13 V, 9 V arrives), brake light (11–13 V, 10 V arrives), driverless computer (4.5–5.5 V from 12 V).
- Two slots per line. Parts: **resistor** (dial = ohms; drop = I × R, heat = I² × R shown) and **voltage booster** (dial = added volts). Dials are potentiometer knobs.
- **Nothing breaks.** Over-voltage is shown, not punished with damage: super-duper-bright headlights, a "HOT" motor whose controller limits power, a racing pump. Under-voltage: dim lights, weak motor, a rebooting computer.

### Software (fictional "PitOS" computer)
1. **Collect data**: 4 rounds of "what is different between these two pictures?" (cone vs barrel → shape, gray post → color, party hat → stripe, toy cone → size). Each answer adds a feature input x₁…x₄.
2. **Train weights**: a one-neuron model, score = w₁x₁ + w₂x₂ + w₃x₃ + w₄x₄, cone if score ≥ threshold. Four one-unknown linear equations (e.g. `2·w₁ + 3·w₂ = 13`), each solvable once the earlier weights are known. Each answer shows a factual plug-it-back-in check.
3. **Validate** on 40 unseen pictures (near the decision line), showing per-picture right/wrong and accuracy.
Pictures, equations and weights are seeded per team.

### Business
- A 4-panel **storyboard** on a toy tabletop: drag toys (including a toy version of the car, which zooms when tapped) into each panel and write a caption. Beats: the challenge, the build, race day, why join us.
- **Pitch** to 5 fictional sponsors, each caring about different things (keywords and toys). Interest = story completeness/effort + fit with the sponsor. Offers can be signed or declined and re-pitched.
- Starting money is $6,000; a typical car costs about $13–15k, so sponsors are required.

## 3. Race Day
- Anyone presses **Start a race heat** (day or night). Every teammate's device counts down to the same wall-clock start, then each student drives the team's car on their own laptop (arrow keys / WASD).
- Physics use the team's real numbers (power, mass, grip, downforce, drag). Off-track grass slows the car; each cone hit adds 2 s (the FSAE rule).
- Teammates' earlier laps drive alongside as **ghost cars**; each heat has standings and a **replay** with every lap together.
- Live positions are not streamed (Firestore free-plan write limits); laps sync once, on finishing.

## 4. Guidance
- A **checklist bar** at the top shows the current station's tasks and ticks them off automatically from the shared design; tab headers show each role's progress and who has claimed it.
- In multiplayer each student picks a job on arrival (claims are visible to the team; a job can be swapped).
- Results and observations state facts only (never "add a resistor").

## 5. Multiplayer data
The design is a list of objects, each with `updatedAt`; the shared document merges teammates' writes object by object, keeping the newest. Objects are never removed. Sliders and dials commit once on release (keyboard: after a short pause) so each adjustment is a single write.
