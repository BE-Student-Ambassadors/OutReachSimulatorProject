# Scenario 3 — Rocket Team

A team of **4** builds a hobby rocket on almost no money. Each seat is a different kind of engineering, and the rocket only flies when all four have done their part.

| Role | Station | What they do |
| :--- | :--- | :--- |
| **Electrical** | Breadboard | A "Flow"-style puzzle: draw a wire between the two pins of each circuit (power, igniter, ejection charge, altimeter, radio). Wires can't cross, and a finished board uses every hole. Pins come from a seed, so every team's board differs. |
| **Mechanical** | SurplusBay + Workbench | Shop a made-up online marketplace (used/new/handmade listings, seller ratings, specs) for a nose cone, body tube, fin set, motor and parachute. Parcels arrive after a few seconds; then drag every part (plus the kit's shock cord and avionics bay) onto its slot on the blueprint. |
| **Software** | Laptop + flight computer | Drag the USB plug into the flight computer (green light), then fix the RocketScript program: each team gets a different set of typos and syntax slips. The top `SET` lines (`throttle`, `burn_time`, `deploy_altitude`) are called out as theirs to tune. Upload to the rocket. |
| **Business** | Sponsor inbox + flyer studio | Open sponsor emails, accept or counter once (sponsors have hidden limits: a little over gets a final offer, far over ends the talks), describe a flyer in words to generate it, decorate it in a paint editor, and send it in. Payout is 50–150 % of the deal, rising with effort (strokes, colors, stickers, text, prompt detail). |

Each station shows a **checklist** of its steps across the top. It describes what to do, never how to make the rocket work. Anyone can launch from the **Launch Pad** at any time.

## Requirements

| Requirement | Target |
| :--- | :--- |
| Apogee | 1,500 ± 150 ft |
| Safe landing | ≤ 20 ft/s touchdown |
| Money | Parts spent ≤ $40 seed money + sponsor payouts |

Going over budget never blocks a purchase; it only fails the money requirement.

## How the parts of the system connect

- **Ignition** needs: body tube and avionics bay installed, a working uploaded program that runs `IGNITE engine`, the power and igniter circuits, and a motor in the motor mount.
- **Climb**: thrust (motor × throttle) against weight and drag (nose cone, fins). Fuel lasts longer at lower throttle. A missing fin set makes the rocket tumble; a warped fin corkscrews it; no nose cone adds a lot of drag.
- **Speed limit**: the body tube and fins have rated speeds. Passing the lower one tears the rocket apart.
- **Recovery**: `ON falling` only runs with the altimeter circuit. `DEPLOY parachute` needs the ejection circuit and a parachute in its slot. Opening faster than the canopy's rated speed rips it; with no shock cord it flies off on its own. Canopy size and rocket mass set the touchdown speed.
- **Radio** only carries live telemetry (the HUD shows "no radio signal" without it).

## Strategies that pass (see `sim/strategies.ts`)

- **Mid parts**, one or two sponsors, throttle ≈ 55 %, ~3 s burn, chute at ~1,300 ft.
- **Thrifty parts** (cardboard tube, rated 210 mph): one sponsor, careful throttle ≈ 52 % with a long burn.
- **Premium parts** (fiberglass, pro motor, big chute): three sponsors, low throttle on a big motor.
