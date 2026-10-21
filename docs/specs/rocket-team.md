# Scenario 3 — Rocket Team

A team (1 to 4 students, up to the host's max team size) builds a hobby rocket on almost no money. Each of the four jobs is a different kind of engineering, and the rocket only flies when all four are done. Jobs are split among however many students the team has from their 1st/2nd picks: with three students, one takes two jobs.

| Role | Station | What they do |
| :--- | :--- | :--- |
| **Electrical** | Electronics workbench (3D) | The rocket lies on a bench with its body tube cut away. **Two breadboards** ("Flow"-style puzzles): the flight computer board (power, igniter, ejection charge) and the sensor board (altimeter, radio). Draw a wire between the two pins of each circuit; wires can't cross, and a finished board uses every hole. Pins come from a seed, so every team's board differs. **Two battery leads** (9 V battery → flight computer, rated 4.5–5.5 V at 0.5 A; → igniter, rated 3–4.5 V at 2 A), each with the FSAE-style splice: cut the lead in 3D (tinted stretches: clear, or moving where a weak crimp shakes loose), crimp both ends on the shared crimp bench, splice in an adjustable resistor (V = I × R) and dial it into range. Out-of-range flight computer → it never runs the program; out-of-range igniter → the motor never lights; a loose computer crimp drops out at liftoff. |
| **Mechanical** | SurplusBay + Workbench | Shop a made-up online marketplace (used/new/handmade listings, seller ratings, specs) for a nose cone, body tube, fin set, motor and parachute. Parcels arrive after a few seconds; then drag every part (plus the kit's shock cord and avionics bay) onto its slot on the blueprint. |
| **Software** | Laptop + flight computer | Drag the USB plug into the flight computer (green light), then fix the RocketScript program: each team gets a different set of typos and syntax slips. The top `SET` lines (`throttle`, `burn_time`, `deploy_altitude`) are called out as theirs to tune. Upload to the rocket. |
| **Business** | Sponsor inbox + flyer studio | Open sponsor emails, accept or counter once (sponsors have hidden limits: a little over gets a final offer, far over ends the talks), describe a flyer in words to generate it, decorate it in a paint editor, and send it in. Payout is 50–150 % of the deal, rising with effort (strokes, colors, stickers, text, prompt detail). |

Each station shows a **checklist** of its steps across the top. It describes what to do, never how to make the rocket work. Anyone can launch from the **Launch Pad** at any time.

## Launch: FPV drones

Every launch plays on every teammate's screen, and each student flies their own FPV drone to watch it (`world/drone.ts`, `world/DroneView.tsx`).

- A 6 s countdown on the pad gives everyone time to get into position; the climb then plays faster than real time, so the rocket outruns the drones.
- Controls: WASD moves (relative to where the camera faces), hold Space for lift (strong thrust up to 58 units/s, a little under the rocket's 65–77 peak; let go and the drone falls with gravity and lands), Shift boosts, arrow keys turn and tilt the camera. A game controller works too (left stick move, right stick look, A or left trigger lift, right trigger boost). C swaps to the tracking camera. Drones start on the ground.
- Mouse look ("shift lock") is on by default: the launcher's view locks right after Launch, teammates' on their first click or key. Ctrl (Chromebooks have the same Ctrl key) or a click on the view locks the cursor to the picture; moving the mouse turns the drone and tilts its camera. Ctrl again (or Esc) frees the cursor until Ctrl or a click. When the flight ends the cursor is always given back for the results. Ctrl toggles on release and only when pressed alone, and a "Leave site?" prompt guards the launch, because Ctrl+W closes the tab and no page can block it.
- Teammates start at different spots around the pad. Drones are not shared live (Firestore free-plan write limits); each student only sees their own.
- R (or the REC button) records the 3D view with the game sound; recording stops when the flight ends. Clips stay in that browser (Launch Pad → Drone footage) with play, download and "rocket in frame %", a fact, never a grade.

## Requirements

| Requirement | Target |
| :--- | :--- |
| Apogee | 1,500 ± 150 ft |
| Safe landing | ≤ 20 ft/s touchdown |
| Money | Parts spent ≤ $40 seed money + sponsor payouts |

Going over budget never blocks a purchase; it only fails the money requirement.

## How the parts of the system connect

- **Ignition** needs: body tube and avionics bay installed, a working uploaded program that runs `IGNITE engine`, the power and igniter circuits, both battery leads in their rated range (and not shaken loose), and a motor in the motor mount.
- **Climb**: thrust (motor × throttle) against weight and drag (nose cone, fins). Fuel lasts longer at lower throttle. A missing fin set makes the rocket tumble; a warped fin corkscrews it; no nose cone adds a lot of drag.
- **Speed limit**: the body tube and fins have rated speeds. Passing the lower one tears the rocket apart.
- **Recovery**: `ON falling` only runs with the altimeter circuit. `DEPLOY parachute` needs the ejection circuit and a parachute in its slot. Opening faster than the canopy's rated speed rips it; with no shock cord it flies off on its own. Canopy size and rocket mass set the touchdown speed.
- **Radio** only carries live telemetry (the HUD shows "no radio signal" without it).

## Strategies that pass (see `sim/strategies.ts`)

- **Mid parts**, one or two sponsors, throttle ≈ 55 %, ~3 s burn, chute at ~1,300 ft.
- **Thrifty parts** (cardboard tube, rated 210 mph): one sponsor, careful throttle ≈ 52 % with a long burn.
- **Premium parts** (fiberglass, pro motor, big chute): three sponsors, low throttle on a big motor.
