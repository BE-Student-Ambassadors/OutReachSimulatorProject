# Scenario 1 — Flooded Campus (Spec)

Civil and environmental engineering challenge. Students redesign a campus stormwater system so it survives a storm while staying within budget.

## 1. Player loop

PROBLEM → DESIGN → TEST → OBSERVE FAILURE → MODIFY → TEST AGAIN → MEET REQUIREMENTS → OPTIMIZE

Students should learn by experimenting. The game reports **what** failed and never **how** to fix it.

## 2. Screens and flow

1. **Start screen.** Title "SEQUOIA ENGINEERING LAB", tagline "Can your team engineer a solution?", and one scenario card:
   - FLOODED CAMPUS · Civil + Environmental Engineering
   - "A severe storm is approaching. Protect the school from flooding."
   - [START CHALLENGE]
   - Show only real scenarios. No fake cards.
2. **Story intro** (one modal): "SEVERE STORM WARNING". A major storm is approaching Sequoia High School. The campus's existing drainage system can't handle the expected rainfall, and several classrooms and important facilities are at risk of flooding. Your engineering team has been asked to redesign the campus stormwater system. Protect the school while staying within budget.
3. **First-run instructions** (show once; remember with localStorage):
   1. Drag engineering tools onto the campus.
   2. Stay within your $150,000 budget.
   3. Press RUN STORM TEST.
   4. Use the results to improve your design.
   5. Meet all three requirements.
   [START ENGINEERING]
4. **Sandbox** (main screen, §3).
5. **Results modal** after every test (§8).

## 3. Layout (sandbox)

```
┌──────────────────────────────────────────────────────────────────────┐
│ SEQUOIA ENGINEERING LAB · Flooded Campus   $118,000 / $150,000  ● Ready│  top bar
├────────────┬───────────────────────────────────────┬─────────────────┤
│ TOOLBOX    │                                       │ REQUIREMENTS    │
│ (drag)     │        CAMPUS MAP (visual focus)      │ live metrics    │
│            │                                       │ selected object │
│            │                                       │ properties      │
├────────────┴───────────────────────────────────────┴─────────────────┤
│ Undo   Reset   Delete Selected                     [ RUN STORM TEST ] │  bottom bar
└──────────────────────────────────────────────────────────────────────┘
```

The center map gets most of the screen. Students should understand the UI within about 30 seconds.

## 4. Requirements (always visible on the right)

| Requirement | Target |
|---|---|
| Maximum building flood depth | ≤ 2.0 in |
| Stormwater runoff managed | ≥ 90% |
| Total project cost | ≤ $150,000 |

Show each one with its target, the current or last-test value, and ✅/❌. Cost updates live. Flood depth and runoff show "—" until the first test, then the most recent result.

**Runoff managed** = (water infiltrated + drained + stored + pumped to a valid outlet) ÷ total rainfall. Water left pooled on the surface or flowing off-map onto streets counts as unmanaged. Document the exact formula in code.

## 5. Campus map

A fictional campus, not the real Sequoia layout, containing Classroom Building A, Classroom Building B, Gym, Cafeteria, Parking lot, Courtyard, Athletic field, Roads, Sidewalks, and grassy areas.

- Grid-based terrain (suggested size about 80×50 cells; tune for performance). Each cell has `elevation`, `surface` (asphalt | concrete | grass | field | permeable | rainGarden | building | water), `water`, `permeability`/infiltration rate, `drainCapacity`, and `buildingId?`.
- Subtle elevation differences. Water flows downhill. Render elevation with gentle shading and landscaping, and hide the grid except in debug mode (toggle with `D` or `?debug`).
- The **parking lot** sits upslope and produces heavy runoff.
- **At least one building sits in a low spot** and floods badly by default.
- Existing drainage is clearly inadequate. **An empty design must fail clearly** (for example 5+ in of building flooding and under 60% runoff managed).

## 6. Toolbox components

All costs and stats live in one config file so they're easy to tune.

| Component | Cost | Behavior | Placement |
|---|---|---|---|
| Storm Drain | $5,000 | Removes surface water within a radius at a capped rate. Only works at full capacity when connected to pipes leading to an outlet (an unconnected drain gets a small local sump capacity). | Drag point |
| Drainage Pipe | per length × size (S/M/L) | Carries water from drains to an outlet, pond, or another drain. A larger pipe carries more and costs more. Shows flow while the storm runs. | Click drain → click target, or draw |
| Drainage Channel | per length | Lowers effective elevation along its path, so surface water prefers it. | Draw a path |
| Retention Pond | S $15k / M $25k / L $40k | Stores water up to its capacity, then overflows. Fills visibly. | Drag footprint |
| Rain Garden | $8,000 | Very high infiltration over a small footprint. Most useful near pavement and buildings. | Drag footprint |
| Permeable Pavement | per cell painted | Converts asphalt or concrete cells to high infiltration. Only allowed on paved cells. | Paint brush |
| Pump | S $10k / L $20k | Moves water at a limited rate from its intake cell to a student-chosen discharge point. Discharging onto a bad spot can cause flooding there. | Drag intake, then set discharge |
| Flood Barrier | per length | Blocks surface flow. Diverted water has to go somewhere, so a careless barrier can protect one building and flood another. | Draw a line |
| Trees / Vegetation | $1,000 each (or a grouped landscaping patch at a bundled price) | Small infiltration bonus in a radius. Modest compared with real infrastructure. | Drag point (or patch) |

Off-map outlets (a storm sewer main or creek) sit at fixed edge locations. Pipes and pumps can discharge into them.

## 7. Interaction

- Drag from the toolbox to place. Drag a placed object to move it. Click to select. Delete or Backspace (and the "Delete Selected" button) removes the selection.
- The properties panel for the selected object shows its name, configurable options (size and so on), key stats in real units (for example "Capacity: 42,000 gal"), and cost.
- **Undo** (button + Ctrl/Cmd+Z) covers every design action. **Reset** restores the starting campus after a confirmation.
- Invalid placement (overlapping a building, permeable paint on grass) shows a red ghost and doesn't place. It must never crash.
- Editing is locked while a test runs. Rapid clicking on RUN, Reset, or Undo during a storm must be harmless.
- Budget is shown as `$87,500 / $150,000`. When over budget, show it in red as `$163,000 / $150,000 · OVER BUDGET ❌`, and **keep allowing placement**.

## 8. Simulation

Fixed timestep, deterministic (seeded) and headless. Each tick, in order:

1. Add rainfall to exposed cells (following the storm intensity curve: ramp up, peak, taper).
2. Move surface water to lower neighbors using elevation + water depth (channels lower effective elevation, barriers block edges).
3. Apply infiltration by surface type.
4. Storm drains remove water nearby and push it into the pipe network.
5. Route pipe flow, capped by pipe capacity. Excess backs up at the drain.
6. Fill ponds, and overflow when full.
7. Run pumps at their flow rate from intake to discharge.
8. Record water depth at building cells and track each building's maximum.
9. Accumulate totals for rain, infiltrated, drained, stored, pumped, and unmanaged.

Relative infiltration from lowest to highest: concrete ≈ asphalt (very low) < grass/field (moderate) < permeable pavement (high) < rain garden (very high).

Realism is less important than logical, visible cause and effect.

### Storm test presentation (about 15–25 s total)

Lock editing → darken the sky → animated rain → water spreads and pools (light to deep blue by depth) → ponds fill → drains and pipes show flow → buildings pulse or highlight once water reaches them → the storm ends → results.

Students must **see** their design work or fail. Don't just show numbers.

## 9. Results modal

```
STORM TEST COMPLETE
Maximum Building Flooding   4.7 in    Required ≤ 2.0 in   ❌ FAILED
Runoff Managed              84%       Required ≥ 90%      ❌ FAILED
Project Cost                $124,000  Max $150,000        ✅ PASSED

OVERALL: DESIGN DOES NOT YET MEET ENGINEERING REQUIREMENTS
Observations:
 • Building B experienced the greatest flood depth (4.7 in).
 • Retention pond reached 100% capacity.
[ MODIFY DESIGN ]
```

Observations must be **factual data only**, never advice. Allowed: "Building B experienced the greatest flood depth." Forbidden: "Add a drain near Building B."

After the modal closes, keep a per-cell max-flood heat overlay on the map (toggleable) so students can diagnose problems.

### Success state

When all three requirements pass, show ENGINEERING REQUIREMENTS MET, with ✓ Buildings Protected, ✓ Runoff Managed, ✓ Within Budget, and "YOUR DESIGN PASSED THE STORM TEST." Add a tasteful animation (confetti or similar, brief).

Then offer **[OPTIMIZE DESIGN]**, which returns to the sandbox.

### Optimization stats (shown after a pass and kept per test)

Total cost, max flood depth, runoff managed %, component count, water stored, infiltrated, and drained. Keep a small history of the last few tests so teams can compare designs. **Don't combine these into a single score.**

### Advanced Storm Test

Unlocks after the first pass. Uses 1.5× rainfall intensity, is optional, and is aimed at teams that finish early.

## 10. Balancing targets

| Design | Expected result |
|---|---|
| Nothing placed | Fails badly |
| Random components | Usually fails |
| Buy lots of everything | Can pass technically but goes over budget |
| Thoughtful design | Passes |
| Advanced storm | Most first-pass designs fail. Optimized designs can survive. |

At least these four distinct strategies must be able to pass within budget:

- **A**: many drains + large pipes to an outlet
- **B**: retention pond + permeable pavement
- **C**: drainage channels + rain gardens + a small pipe network
- **D**: a pump + drains + infiltration mix

Encode each one as a fixture design in a Vitest balancing test, along with "empty fails" and "everything is over budget". Expect a typical group to pass after about 2–4 attempts.

## 11. Acceptance checklist

- [ ] Drag/drop, move, select, and delete all work for every component type
- [ ] Undo covers every action. Reset restores the starting campus.
- [ ] Cost math is correct (spot-check length- and area-priced items)
- [ ] The empty design fails. Strategies A–D pass. An over-engineered design fails on budget.
- [ ] Results change meaningfully when the design changes
- [ ] A badly placed barrier can make a different building flood worse
- [ ] Advanced Storm unlocks only after a pass
- [ ] No console errors. The storm animation stays smooth (around 60 fps) on a mid-range laptop.
- [ ] Layout is readable at 1366×768, 1440×900, and 1920×1080
- [ ] Rapid clicking and odd placements (edges, overlaps, stacked objects) don't break anything
- [ ] No result text, tooltip, or description gives a fix
