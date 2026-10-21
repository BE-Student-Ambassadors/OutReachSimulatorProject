# Scenario 2 — Formula SAE (Spec)

Replaces Morning Traffic. Mechanical + electrical + software + business engineering, themed on **Formula SAE**, where university teams design, build and race a small race car.

A team of **1 to 4** (up to the host's max team size) shares one car. The four jobs are split among however many students the team has: with fewer than four, some students take two jobs; with more, jobs are shared (anyone can still open any station). Everything they do feeds one car, which is then measured by a Competition Test and raced by every teammate on Race Day.

Code: `engineering-simulator/src/scenarios/fsae/`. All tunable numbers are in `config.ts`. Balancing: `TUNE=1 npx vitest run fsae/sim/tune`.

## 1. Requirements (Competition Test)

| Requirement | Target | Comes mostly from |
|---|---|---|
| Autocross lap time | ≤ 31.8 s | Mechanical (aero, size, welds) + Electrical (motor power) |
| Driverless lap | ≤ 37.5 s and ≤ 2 cones hit | Software (graph courses cleared) + Electrical (sensors, computer power) + Mechanical (grip, power) |
| Wiring passes inspection | 5 of 5 wires in their rated range on the lap and tied down | Electrical |
| Car is paid for | cost ≤ money raised | Business (sponsor deals and flyers) + everyone's spending (sensors cost money too) |

Systems thinking is built in: e.g. an over-voltage motor makes the car slower; an unpowered driverless computer can't drive; a wider car grips more but costs more.

Variants: **Competition Test** (day) and **Night Test** (same requirements on the floodlit course; the car has standard headlights).

## 2. Stations

### Mechanical
- **Weld** 2 frame joints (main hoop top, a vertical seam; front hoop left, a sideways seam). Clicking a joint flies the camera in to it and opens the welding bench (`world/WeldBench.tsx`, scoring in `sim/weld.ts`), a close-up of the two tubes with a checklist that runs in order:
  1. **Line up the tubes** (problem solving + functional fixedness): the loose tube won't stay where it's put. Let go of it by hand and it slides apart and sags out of line (gauges show gap and mismatch in mm, plus a fact line about what it did). There's no jig, only a **shop shelf** of ordinary things, none made for the job, whose blurbs say what each thing *is*, never what to do with it: angle iron offcut (both tubes cradle in its 90° corner → in line), drill bit / quarter / welding wire (spacers in the gap → the gap holds at their thickness), pencil (too thick: a 7 mm gap), duct tape (holds whatever the hand set; moving the tube tears it), hammer (taps the tube closer in coarse steps). Several combinations reach a solid fit-up (e.g. angle iron + a spacer, careful hand alignment + tape, angle iron + hammer + tape); hand alone doesn't. The result credits what was holding the joint when the clamps went on.
  2. **Clamp both tubes**: click each tube to place a toggle clamp. A clamp right at the seam shades the top of the seam from the torch; a clamp far away (or none) lets the tube pull out of line as the weld cools. Once clamped, the tape and any spacer come out; the angle iron stays under.
  3. **Weld the seam**: the welding helmet drops over the screen (auto-darkening lens: dim green, then dark when the arc strikes). Hold the mouse button at one end of the seam and pull the torch to the other end in **one smooth, continuous stroke**: straight down or straight up on vertical seams, left to right or right to left on sideways seams (front hoop and main hoop sides; `seam` in `JOINTS`). The bead shows as it goes down, but the arc's bright glare deliberately hides the spot right under the torch. Too fast → cold spots / gaps; dwelling → burned through; off the seam → arc marks. Stopping and restarting leaves weak tie-ins; going back over metal that's already welded (turning around, wiggling, a second pass) spits spatter onto the tube and piles up ugly lumps that are weaker and take longer to sand.
  4. **Choose a sanding grit**: 24 / 60 / 120 / 320. 24 cuts fast but scratches the tube; 120 is slow; 320 barely removes metal.
  5. **Sand the bead down**: scrub across the bead; a side-view profile shows how high it stands. Sanding past flush cuts into the 1.6 mm tube wall.
  The joint's strength (0–100 %), a separate **craftsmanship** rating of how the bead looks (neat / uneven / messy: even width, no lumps or spatter; the art of the skill, not part of strength) and a list of facts are only shown at the end. Any joint can be ground out and re-welded: re-welding (from the result, or by clicking an already-welded joint) keeps that joint's fit-up and clamps and goes straight to step 3, with a "Redo the fit-up" link. Weld quality → frame stiffness → tire grip.
- **Choose the front wing design**: flat plate, single element, two element or three element. Each has its own downforce, drag, mass and cost (`FRONT_WINGS` in config). The size never changes, only the design.
- **Slide the rear wing** in/out (0–100 %). More out = more downforce and more drag. Front design + rear setting set the front/rear balance.
- **Size the car**: wheelbase (short turns in better in tight corners, long is steadier in fast ones), track width (grip vs mass/drag/cost), ride height (low floor = ground effect; too low scrapes).
- **Wind tunnel**: simulated air streams over the car; reports downforce, drag, front-axle share and handling (understeer / neutral / oversteer) as facts.

### Electrical (3D wiring harness, `world/ElectricalStation.tsx`, `world/HarnessScene.tsx`, `sim/harness.ts`)
The car's frame in 3D with its two harness wires (at most two cut-and-crimp jobs) and the parts they feed: drive motor (rated 38–42 V, 48 V arrives) and driverless computer (4.5–5.5 V from 12 V). Every part reacts live to its voltage (motor spins and glows when over-voltage, computer screen boots or flickers). Clicking a glowing part flies the camera to its wire. Each wire has its own 5-step checklist:
1. **Cut the wire** anywhere you choose (not within 8 % of either connector). Each stretch is tinted and labeled with what it runs past: **hot** (motor case, battery top), **moving** (suspension, steering column, pedal box) or **clear**. Hot connectors resist 2.5× more; a crimp under 60 % in a moving stretch shakes loose on the lap (fine on the bench). A splice in a clear stretch needs a bigger tie-down plate (6×5, 4 wires vs 5×4, 3 wires). A cut wire carries nothing until it is closed again.
2. **Crimp both ends** (`world/CrimpBench.tsx`): pick the die for the wire gauge (red 22–18, gray 16–14, yellow 12–10 AWG), drag the wire into the stripper (6 mm fills the barrel), hold to squeeze and release in the full-stroke zone (80–93 % of handle travel; past 98 % cracks the barrel). Quality 0–100 % with facts; contact resistance adds a voltage drop (I × R).
3. **Splice in a part**: power resistor (dial = ohms, drop = I × R, heat = I² × R, it glows) or voltage booster (dial = added volts). One part per wire.
4. **Voltage in its rated range** (live multimeter).
5. **Route and tie down** the splice on a Flow-style plate (`world/RouteBoard.tsx`, `sim/routing.ts`): connect every wire pin to pin without crossing and use every tie point. Untied wiring fails inspection.

**Self-driving sensors**: the car comes with a LiDAR already mounted on the front wing pylon and wired to the computer (30 m range, 13 m in tight turns, 0.8 m blind zone; $1,200 + $60 bracket on the bill). Students mount a camera (main hoop / cockpit / nose) and a wheel-speed sensor (front hub / rear hub). Each spot lists its facts (night range, image shake, driven-wheel slip, bracket cost). Then route the two sensor cables to the computer on their own plate. Costs: camera $350, wheel-speed $120, plus brackets.
Nothing breaks: over-voltage is shown, not punished with damage.

### Software (path-planner graph game, `world/SoftwareStation.tsx`, `sim/graph.ts`; race effect in `sim/autonomy.ts`)
The driverless computer's monitor is a graph (in the spirit of *Graphwar*). The car sits at a start point on the left, a target waits on the right, and obstacles ("blobs") sit in between. The student writes y = f(x), clicks **Fire**, and watches the path draw itself and the car follow it.
- **The shot:** the curve is slid up or down so it starts at the car. It must be continuous: it stops where the function breaks (a jump, division by zero, √ of a negative), where it touches an obstacle, or where it leaves the screen. Results are facts ("The path ran into an obstacle at x = −4.8", "The path passed the target 1.3 below it"); earlier shots stay faint on the graph.
- **Function helper** (default): add up to 3 terms (line a·x, parabola a·(x − h)², wave A·sin(B·x + C), bump A·e^(−((x − h)/w)²)) and play with their numbers (slider or typed value). **Type it yourself** (advanced): any function of x with + − × ÷ ^, parentheses, 2x-style multiplication, sin cos tan sqrt abs exp ln log, pi, e. Parsed by our own parser (never `eval`), with plain-language errors.
- **Three courses, unlocked in order:** Easy (Parking lot, 2 obstacles), Medium (Skidpad, 4), Hard (Autocross, 7, tighter gaps). Generated per team from the team seed. Every course is checked solvable with the helper's own terms before it's used, and never clearable with a straight line. Each course records shots and the function that cleared it.
- **Race effect:** courses cleared *in order* set what the planner can drive (`PLANNER_BY_CLEARED`): 0 → no path-planning code, driverless DNF; 1 → crawls the middle of the course and wobbles (~43 s); 2 → partial racing line, 70 % grip (~38 s, still over 37.5 s); 3 → the full racing line at 80 % grip, steady (~35 s, passes day and night with good sensors). Color reading now uses the LiDAR's built-in rule (`LIDAR_COLOR_RULE`).
Speed is still capped by how far the sensors see, and steering error still comes from the wheel-speed sensor and camera shake (Electrical).

### Business (sponsor inbox + flyer studio, `world/BusinessStation.tsx`, `world/FlyerArt.tsx`, `world/paintStore.ts`, `sim/business.ts`)
Same activity as the Rocket Team business station. Six sponsors email an opening offer for one flyer: VoltCell ($3,500), GripLine Tires ($3,000), RoadKing Auto ($2,500), Nimbus Robotics ($4,000), Harbor Credit Union ($2,500), Slice Pizza ($1,500). Accept, or counter once: each sponsor has a hidden limit ($3,000–6,000, ±$500 per team); asking a little over gets a final offer, asking far over ends the talks. After a deal, describe a flyer in words to generate it (colors, pictures such as race car / checkered flag / lightning / food, layouts poster / banner / badge, and a "quoted" headline all change it), decorate it in a paint editor (brush, eraser, stickers, text, undo), and send it in. Payout is 50–150 % of the deal, rising with effort (strokes, colors, stickers, text, prompt detail). Paint stays on the device; the deal, flyer spec, effort and payout sync. Starting money is $6,000; a finished car costs about $15–17k, so taking every opening offer with no work on the flyers is not enough, while two or three well-made flyers are.

## 3. Race Day
- The course is a race venue: grandstands with crowds, barriers, kerbs, sponsor boards, a paddock, and floodlight towers that light it at night.
- Anyone presses **Start a race heat** (day or night). Every teammate's device counts down to the same wall-clock start, then each student drives the team's car on their own laptop (arrow keys / WASD).
- Physics use the team's real numbers (power, mass, grip, downforce, drag). Off-track grass slows the car; each cone hit adds 2 s (the FSAE rule).
- Teammates' earlier laps drive alongside as **ghost cars**; each heat has standings and a **replay** with every lap together.
- Live positions are not streamed (Firestore free-plan write limits); laps sync once, on finishing.

## 4. Guidance
- A **checklist bar** at the top shows the current station's tasks and ticks them off automatically from the shared design; tab headers show each role's progress and who it's assigned to.
- In multiplayer each student ranks a 1st and 2nd job on arrival; the jobs are then split across the team from everyone's picks (`core/roles.ts`), so every job always has someone. Picks can be changed any time, and the split updates when someone joins or the host removes someone.
- Results and observations state facts only (never "add a resistor").

## 5. Multiplayer data
The design is a list of objects, each with `updatedAt`; the shared document merges teammates' writes object by object, keeping the newest. Objects are never removed. Sliders and dials commit once on release (keyboard: after a short pause) so each adjustment is a single write.
