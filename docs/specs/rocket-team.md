# Scenario 3 — Rocket Team (IREC Challenge Spec)

Aerospace, mechanical, and mechatronics engineering challenge showcasing the **International Rocketry Engineering Competition (IREC)**.

Each team has **6 players**, split into **2 sub-teams of 3**:
1. **Payload Sub-Team (3 roles):**
   - **Role 1 — Gyroscope Engineer (`payload-gyro`):** Calibrates the 3-axis (Roll, Pitch, Yaw) reaction-wheel gyroscope via an interactive timing-ring click game.
   - **Role 2 — Payload Motor Engineer (`payload-motor`):** Selects the reaction stabilization motor from 5 motor specs balancing torque against weight.
   - **Role 3 — Payload Drop Tester (`payload-tester`):** Configures the drop-test rig (drop altitude, armed parachute altitude, upwind drift lead angle, canopy size) while waiting, triggers the parachute live during the 3D drop, and tests landing on the bullseye target pad.
2. **Rocket Sub-Team (3 roles):**
   - **Role 4 — Weight Distribution Engineer (`rocket-mass`):** Orders the 6 internal rocket bays from Nose to Tail via drag-and-drop so the Center of Gravity ($CG$) sits safely ahead of the Center of Pressure ($CP$) with the nozzle at the tail.
   - **Role 5 — Airframe & Materials Engineer (`rocket-material`):** Chooses the airframe structural material, nose cone aerodynamic profile, and fin geometry to survive Max-Q dynamic pressure and minimize drag.
   - **Role 6 — Rocket Flight Tester (`rocket-tester`):** Configures launch rail angle, motor impulse class, and nose-cone ballast trim to reach the 10,000 ft IREC target apogee window.

---

## 1. Role Preference Tier List (1st & 2nd Choice)

Players can rank up to **2 preferred roles** (`1st Choice` and `2nd Choice`, e.g., wanting to be a Tester 1st and Gyroscope or Weight Distribution 2nd).
The deterministic role matcher (`assignRocketRoles` in `src/scenarios/rocket/roles.ts`) computes the global optimum assignment across the 6 roles so the maximum number of teammates receive their 1st or 2nd choice.

---

## 2. Requirements (always visible)

| Requirement | Target | Definition |
| :--- | :--- | :--- |
| Rocket Apogee (10,000 ft) | `10,000 ± 850 ft` | Peak altitude reached during stable, structurally intact ascent |
| Payload Target Landing | `Intact, ≤ 50 ft` | Payload lands intact (no splatter or spin-out) within 50 ft of bullseye center |
| Project Cost | `≤ $120,000` | Sum of configured payload & rocket hardware plus active team programs |

---

## 3. Physics & Failure Modes

### Payload Sub-Team Outcomes
- **Motor Too Heavy (`splatter`):** Selecting the 9.8 kg *Industrial Cast-Iron Drive 950W* (or deploying the parachute below 550 ft) causes excessive terminal velocity (`> 27.5 ft/s`). On impact, the payload **comedically splatters into 32 colorful flying pieces** across the desert floor.
- **Motor Too Light / Weak (`spin-motor-weak`):** Selecting a motor with insufficient stabilization torque (`< 2.2 N·m` in standard conditions or `< 3.8 N·m` in unreefed crosswind) causes the payload to **spin wildly out of control** during descent.
- **Gyroscope Out of Calibration (`spin-gyro-uncalibrated`):** If the 3-axis gyroscope calibration averages below `75%`, the payload loses attitude lock and **spins out of control** during descent.
- **Bullseye Target Landing (`target-landed`):** With a calibrated gyroscope (`≥ 75%`), a balanced reaction motor (*Aerospace Torque Drive 260W* or *Carbon-Pro Twin Gimbal 380W*), proper parachute deployment altitude (`~1,200 ft`), and upwind lead angle, the payload descends steadily under its canopy and touches down inside the 50 ft bullseye target ring.

### Rocket Sub-Team Outcomes
- **Nozzle Misplaced (`pad-stall`):** If the *Booster Casing & Graphite Nozzle* is not placed at the tail slot (`Slot 6`), the rocket stalls near the pad (`420 ft`).
- **Aerodynamic Instability (`unstable-tumble`):** If heavy bays are placed too far aft so the stability margin $\frac{CP - CG}{D} < 1.1\text{ calibers}$, the rocket cartwheels out of control after leaving the launch rail.
- **Structural Shred at Max-Q (`structural-shred`):** If peak dynamic pressure exceeds the airframe material's structural limit (e.g., *Phenolic Kraft Cardboard* under *N-Class* or *O-Class* thrust), the airframe breaks apart at ~4,350 ft.
- **Nominal Apogee (`nominal-apogee`):** Properly balanced weight order (`1.5–3.0 calibers`), composite/metallic airframe, and tuned motor impulse reach the `10,000 ± 850 ft` IREC target window.
