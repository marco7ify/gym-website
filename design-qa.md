# Gym Planner spatial-view design QA

## Evidence

- Approved spatial concept: `/Users/tony/.codex/generated_images/019fed6c-4a4e-7f02-852d-3541ab48b090/exec-8d4856ef-68a1-4752-bdbe-d84560b0504d.png`
- Final 3D environment and controls: `/Users/tony/.codex/visualizations/2026/08/10/019fed6c-4a4e-7f02-852d-3541ab48b090/equipment-environment-controls-final.png`
- Final 80-degree walkthrough: `/Users/tony/.codex/visualizations/2026/08/10/019fed6c-4a4e-7f02-852d-3541ab48b090/walkthrough-fov-floor-wall-final.png`
- Product-photo references inspected: RX3 Tornado Compact Smith Machine, Stair Machine, GAZELLE PRO leg press/hack squat, Maxwell-903BH sauna, RitFit GATOR bench, Ice Barrel 500, HS08 row, seated row, three-tier dumbbell rack, and combo adductor/abductor.
- State: Layout 3, 19.5 × 19.8 × 9 ft, 69 imported wishlist items, 11 placed items, walls on, white walls, rolled-rubber floor, 80-degree walkthrough FOV, ceiling off, clearances on, collisions on, labels off, eye height 5 ft 8 in.

## Findings

- No actionable P0, P1, or P2 issue remains in the requested 3D environment or walkthrough controls.
- [P3] The 11 placed items use machine-specific parametric geometry derived from their saved photos and dimensions. Recognizable details include Smith guide rods, dual weight stacks and bar; stair shrouds, steps and display; treadmill belt and console; Gazelle rails, pads and plate pegs; sauna glazing and wood body; dumbbell tiers and weights; and category-specific benches, rowers, selectorized machines and plunge. They remain simplified reconstructions rather than manufacturer CAD.
- [P3] Exact surface-level replication would require manufacturer-provided GLB/GLTF models or a dedicated photogrammetry/modeling pass. Those assets are not present in the imported backup.
- The approved concept uses a smaller six-item example room. The implementation intentionally keeps the user's imported 11-item, 402-square-foot Layout 3, so scene density and camera sightlines differ from the concept.

## Required fidelity surfaces

- Equipment scale: every model group is positioned and rotated from the saved layout instance and retains the item's measured floor footprint. Added visual detail does not alter the floor-plan dimensions.
- Walls: visible in 3D and walkthrough, with persistent White and Black choices. White uses a warm off-white; Black uses a readable charcoal with matching trim and adjusted scene background.
- Floors: persistent Rolled rubber, Rubber tiles, and Concrete choices. Rolled rubber is continuous and speckled with subtle roll seams; tiles add panel seams; concrete is lighter and mottled.
- Walkthrough lens: persistent Standard 60°, Wide 70°, Wider 80°, and Widest 90° options. New layouts default to Wider 80° while the orbiting 3D preview remains at 54° to avoid preview distortion.
- Walkthrough usability: startup selects a collision-safe floor point and samples open viewing directions; camera position and orientation are restored together; a body-radius wall check prevents clipping; focus loss clears held keys.
- Interface: environmental controls fit the existing View Settings card and retain the application's compact typography, orange state color, semantic labels, keyboard support, and reduced-motion behavior.

## Browser verification

- Verified all three floor choices render and report the correct scene state.
- Verified White and Black wall choices render and persist, then restored White for handoff.
- Verified 60°, 70°, 80°, and 90° FOV choices; restored the new 80° default for handoff.
- Verified all 11 placed equipment instances render as reconstructed 3D models with no photo-plane cutouts.
- Verified the optimized safe-start search opens the walkthrough in about 321 ms in the tested Layout 3 state.
- Verified first-person activation and movement at 80°: one `W` input moved the camera from x 9.775 / z 10.225 to x 9.471 / z 10.082.
- Verified drag-to-look at 80°: yaw changed from 0.2775 to -0.0165.
- Verified the live minimap, reset, exit, eye-height setting, collision toggle, clearance warnings, and WebGL canvas remain available.
- Checked the browser console after the final primary flows: no warnings or errors.

## Visual comparison result

- The final scene preserves the approved information hierarchy: room metrics, spatial modes, a dominant walkthrough action, central 3D workspace, and a right-side settings rail.
- The wall/floor controls are immediately visible and do not crowd the equipment workspace.
- Machine silhouettes and distinguishing color/material cues are substantially closer to the saved equipment photos than the previous generic boxes or flat cutouts.
- The 80° walkthrough materially expands peripheral visibility without the severe edge distortion of an ultra-wide lens.
- Black flooring, white walls, clearance overlays, warnings, and the dark walkthrough guide remain visually separable.

## Follow-up polish

- P3: import manufacturer GLB/GLTF assets when available for exact bolts, cables, upholstery contours and branding while preserving the current measurement-locked outer groups.
- P3: optionally add per-machine model overrides if the wishlist later contains multiple visually different products within the same equipment category.

final result: passed

## 2026-08-11 — Layout 3 wall-decoration verification

- Verified the user's saved Layout 3 at the normal local origin in Plan, Split 2D + 3D, 3D, and Walkthrough. The door-entry view retained the walnut/Gazelle focal wall; the center-training view retained the bottom mirror; the aisle retained the right mirror; and the cardio wall retained its ambient strip. No decoration floated, clipped a door or ceiling, changed equipment placement, or added a walking collision.
- Rendered inspector/UI counts and values were exact: two silver `#cbd5e1` mirrors, one walnut `#8f5f3a` slat panel, two `#ffb36b` 80% frame LEDs, one `#ffd7aa` 65% mirror wash, and one `#ffd7aa` 70% cardio strip. Split, 3D, and Walkthrough each reported 7 features (2 mirror / 1 slat / 4 LED), 4 feature lights, and 0 invalid features.
- Layouts 1 and 2 each rendered zero wall features and retained their own white-wall/rolled-rubber choices. Layout 3 retained black walls, rolled rubber, 11 placed equipment models, and its exact seven-feature design after all QA.
- A full version-12 all-layouts export re-imported successfully at the isolated origin with 3 layouts before duplication; the export contained Layout 1 = 17 equipment / 0 features, Layout 2 = 10 / 0, and Layout 3 = 11 / 7. `settings.aiApiKey` was absent from the downloaded JSON.
- The isolated `Layout 3 (copy)` exercised add, inspector edit, wall switch, resize, recolor, Plan drag, one-inch nudge, delete, and reload persistence. Manually created top-door and missing-left-wall examples displayed their exact warnings; the disposable copies were deleted afterward.
- With 9 LED strips, all 9 emissive geometries continued to render while `data-wall-feature-lights` remained capped at 8. A 71.4-second orbit/walk stress pass remained responsive; walkthrough coordinates changed from x 14.905 / z 2.150 / yaw 2.6180 to x 14.632 / z 2.623 / yaw 2.0927.
- Fresh logic and 3D renderer runners both completed with zero failures. Final saved-layout, imported-copy, persistence, stress, and restored-original console checks reported zero warnings/errors.

final wall-decoration result: passed

## 2026-08-11 — center-preserving equipment rotation verification

- Used isolated `Layout 1 (copy)` staging fixture (20 × 12 ft) with one Functional Trainer; the original Layout 1 was left intact. The selected item began at 3.8 × 4.6 ft and was exercised through the canvas toolbar, inspector Rotate button, floor-plan SVG affordance, and guarded `R` shortcut. The logic runner verifies the shared command's center with a `1/1200 ft` tolerance (0.01 in) and verifies that four rotations restore the exact starting position and orientation. Native toolbar/inspector pointer actions and `R` were observed on the duplicate; Split showed the selected toolbar and the rotated 4.6 × 3.8 ft footprint.
- Reloading the duplicate preserved the rotated 4.6 × 3.8 ft footprint and Split’s Live 3D preview rendered the corresponding orientation. The dedicated SVG-pointer test passed; the in-app browser’s direct SVG pointer delivery did not activate that control, so it is not used as evidence beyond the deterministic browser runner. No external/unlocked browser was available to adjudicate native button Enter/Space, and no synthetic handler was added.
- Conflict matrix is covered by the zero-failure rotation runner: outside-room, reserved-area, door-clearance, equipment-body overlap, an in-staging commit, and a staging-boundary rejection. The in-staging non-square rotation remains fully in the staging strip and preserves its center; a center-preserving candidate that bridges the room-to-staging gap returns the existing outside-room hard conflict and leaves the instance byte-for-byte unchanged. Clearance-only overlap commits with `__invalid:true`, a warning result, and the red-warning status. A clean rotation commits once and produces the selected-item success status.
- Shortcut matrix passed for Plan and Split, and rejects repeat, modifiers, other keys, text inputs, textareas, selects, contenteditable, native and app dialogs, active drag, Walkthrough, pointer lock, 3D-only view, no selection, and the Dashboard. Ten layout-render passes retained exactly one `keydown` listener.
- Desktop and 390 px narrow checks retained both native Rotate controls, the SVG affordance, accessible selected-actions group, and 3D/Split controls without console errors. Normal-app console checks after the desktop, Split, reload, and narrow flows reported zero warnings/errors. Fresh logic, 3D, and runtime-cache runners completed with zero failures.

final center-preserving rotation result: passed

## 2026-08-11 — Layout 3 dedicated-equipment final verification

- Used only the isolated `127.0.0.1:4174` origin and a temporary import of the saved all-layout export; the normal origin and original saved layouts were not changed. Layout 3 Preview reported `inRoomModels=11`, `matchedProfileModels=11`, `dedicatedModels=11`, `builderFailures=0`, `reconstructedModels=0`, `wallFeatures=7`, and `doorModels=1`. The sorted profile and builder lists were identical: `brightway-hs08-row,gazelle-pro,ice-barrel-500,maxwell-903bh,nordictrack-x16,ritfit-gator-bench,rx3-compact-smith,shizhuo-seated-standing-row,syedee-stair-machine,wanjia-combo-adductor,yindun-three-tier-rack`.
- Real-Three regression coverage verified the eight new canonical W×L×H groups within 0.001 ft, each saved world/measured footprint against `instanceDims()`, saved centers and rotation, plus unchanged `__invalid` and reserved-area state. The eight canonical dimensions were Ice `2.5583×4.8000×3.5000`, Stair `2.6667×4.1667×6.8333`, X16 `3.1750×5.8250×6.1083`, GATOR `2.1667×4.8333×4.4167`, HS08 `2.8200×4.2000×6.2800`, Shizhuo `3.6700×5.2100×4.1800`, Wanjia `2.3800×4.9900×4.6100`, and Yindun `2.2200×5.5800×3.2400` ft.
- Split-mode front and rear obliques passed for every new product. Ice retained its angular open well/water; Stair its enclosed tower and distinct treads; X16 its console, deck, rear roller, and door clearance; GATOR its open frame, pads, and raised rollers; HS08 its tall black stack/red yoke/split footplates; Shizhuo its low open chassis/red arms/no tower; Wanjia its open rails, black stack, and paired red arms; and Yindun its empty A-frame rails and visible saddles with no rack weights or generic slabs. Evidence: `.superpowers/sdd/2026-08-11-remaining-equipment-models/screenshots/task5/`.
- The obstruction-aware selected-frame path preserves the established unobstructed front-oblique angle and selects a clear front-side alternative when the saved Yindun rack blocks the Ice Barrel ray. It uses measured placement rectangles only; no equipment moved.
- Walkthrough retained black walls, rolled rubber, door, mirrors, slat panel, LEDs, RX3, Maxwell, and Gazelle. A 76,279 ms orbit/walk pass with 140 movement/look iterations moved the camera from `(14.737,2.441)` to `(17.674,2.648)` at yaw `-3.598`; movement remained responsive with stable shadows, no flicker/z-fighting, repeated warnings, or normal-app console errors.
- The deliberate X16 builder failure regression produced one builder failure and a complete generic treadmill fallback with no stale resources/click targets, then restored the renderer to 11 dedicated models and zero failures. The real-Three dispatcher runner, logic runner, runtime-cache runner, syntax/module checks, and diff check passed. The hidden-iframe cache test emits one known MutationObserver instrumentation message; the normal application console was clean.
- The Stair Machine’s `needs 8.7 ft ceiling` warning is an existing Layout 3 condition from its intersection with the saved 5-ft low-ceiling zone. It remains visible and nonblocking; the equipment was not rearranged or marked invalid.

final dedicated-equipment result: passed
