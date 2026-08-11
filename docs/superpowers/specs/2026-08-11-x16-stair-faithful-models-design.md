# Faithful NordicTrack X16 and Stair Machine Models

## Summary

Replace the existing simplified procedural models for the saved NordicTrack X16 Treadmill and syedee Stair Machine with product-faithful procedural assemblies. The rebuild changes only the internal 3D geometry. It preserves every saved measurement, placement, orientation, collision footprint, warning, and fallback behavior.

Layout Tools and the rest of the planner UI are explicitly out of scope.

## Goals

- Make both machines recognizable from front, side, rear, elevated, and walkthrough views.
- Treat the saved product photo and current official product reference as the visual authority.
- Keep the exact saved outer envelopes and all Layout 3 placement data unchanged.
- Keep rendering lightweight enough for the existing 11-machine walkthrough.
- Make actual rendered parts testable through semantic mesh metadata.
- Retain a complete generic fallback if either dedicated builder fails.

## Non-goals

- No manufacturer GLB/GLTF download or new external asset dependency.
- No photogrammetry, photo-plane, or billboard geometry.
- No equipment movement, resizing, or collision-policy changes.
- No changes to Layout Tools, wall finishes, the garage design, or the Stair Machine ceiling warning.
- No brand decal on the Stair Machine. Its saved record says syedee while the embedded reference visibly says LAVAFLOW; the physical form is authoritative, but the conflicting wordmark is not.

## Source and measurement contract

### NordicTrack X16 Treadmill

- Saved envelope: 38.1 in wide × 69.9 in long × 73.3 in high.
- Saved placement: x 6.5 ft, y 0, `rotated:true`, `__invalid:false` in Layout 3.
- Canonical model front remains local `-Z`; the saved placement rotation remains unchanged.
- Official product reference: NordicTrack X16 Treadmill.
- Product-defining dimensions: 22 × 60 in walking belt, 13.66 in rear step-up, and approximately 16 in diagonal pivoting display.

### syedee Stair Machine

- Saved envelope: 32 in wide × 50 in long × 82 in high.
- Saved placement: x 0, y 0, `rotated:true`, `__invalid:false` in Layout 3.
- Canonical model front/console remains local `-Z`; entry remains local `+Z`.
- The embedded 520 × 520 product image is the visual reference.
- The existing nonblocking `needs 8.7 ft ceiling` warning remains exactly as-is. The model is not squashed or moved to clear the saved five-foot ceiling zone.

## Architecture

Keep the existing exact profile keys and dispatch path:

- `nordictrack-x16`
- `syedee-stair-machine`

Rebuild the two dedicated builders in `equipment-models.js`. `app.js` profile inference, saved state, group placement, collision footprints, and generic fallbacks do not change.

Extend the existing primitive option path so `box`, `beam`, `tube`, and `cylinder` can copy stable semantic fields into real Three.js mesh `userData`:

- `partTag`
- `side`
- `partIndex`

Add one small reusable extruded-panel primitive for the Stair Machine's thin pentagonal side shrouds. It creates and registers one disposable geometry, adds the mesh to normal click targeting, and accepts the same semantic metadata. It must not introduce a general modeling framework or unrelated renderer refactor.

## NordicTrack X16 visual design

Build entirely inside the canonical 38.1 × 69.9 × 73.3 in envelope.

### Walking platform and base

- Use an exact 22 × 60 in dark rubber belt.
- Use a 31.5 in-wide, roughly 64–65 in-long deck shell with the walking surface anchored to the 13.66 in rear step-up.
- Pose the static deck at approximately +6 degrees around local X so the local `-Z` console end is higher than the local `+Z` rear entry end. The current reversed incline is removed.
- Add two ribbed dark-graphite foot rails around 3.25–3.5 in wide and 61–62 in long.
- Add visible front and rear transverse rollers approximately 22.5 in wide and 2.5–3 in in diameter.
- Add two grounded longitudinal base rails, crossmembers, leveling feet/rear wheels, and a central lift actuator/scissor. No visible component may float above the floor.

### Front structure and controls

- Replace the tall thin center mast with two substantial incline uprights and a short central pivot neck.
- Replace chrome-looking rails with thick segmented matte-black molded handles and lower armrests.
- Handles must reach approximately 72–73.3 in while remaining inside the saved height.
- Replace the block motor hood with a low, faceted 28–30 in-wide housing integrated into the deck/front mechanism.
- Add a broad 31–33 in console bridge, a restrained control/speaker strip, and one small red stop control.
- Keep the visible display near 13.9 × 7.8 in inside a roughly 15 × 9 in bezel. Reduce the visible slab depth to about 0.7–1.0 in for the panel and 1.1–1.5 in for the bezel.

### Materials

- Matte black powder-coated structure.
- Near-black rubber belt.
- Slightly lighter graphite deck, foot rails, console, and hood.
- Subdued dark-cyan emissive display.
- One restrained red stop-control accent.
- No dominant chrome material and no machine-authored light or texture.

## Stair Machine visual design

Build entirely inside the canonical 32 × 50 × 82 in envelope.

### Stair belt and entry

- Use exactly eight ordered treads and seven risers to form a continuous rotating-stair silhouette.
- Target tread proportions around `.60w × .018h × .145d`, with the cascade rising toward local `-Z`.
- Add a low rear entry step, two open side base rails, and front/rear cross feet.
- Keep visible floor beneath the framed base instead of using one bulky center plinth.

### Side shells

- Replace the current tilted rectangular side blocks with paired thin pentagonal shrouds.
- Use this normalized local `(z,y)` profile as the starting shape:
  - `(.46d,.035h)`
  - `(.46d,.16h)`
  - `(.27d,.18h)`
  - `(-.27d,.61h)`
  - `(-.43d,.61h)`
  - `(-.43d,.035h)`
- Keep the outer faces inside `±.48w` and add a restrained inset face per side.
- Trace the lower/perimeter shell with cool-white emissive strips and add one short orange upper diagonal per side. Emissive accents do not cast or receive shadows.

### Console and rails

- Use a broad landscape console housing around `.70w × .20h × .055d`, centered near `y=.86h`, `z=-.415d`, with a slight viewing tilt.
- Inset a `.60w × .135h` subdued cyan display into the front face. The visible screen must remain inside the larger housing.
- Use a central mast/pivot structure that visually supports the console.
- Build a substantial black rail path on both sides:
  - `(.30w,.22h,.34d)`
  - `(.39w,.55h,.05d)`
  - `(.36w,.76h,-.22d)`
  - `(.27w,.79h,-.35d)`
- Use approximately `.022w` tube radius and 12–14 radial segments, plus short forward grips below the console.

### Materials

- Near-black matte shrouds and rubber treads.
- Dark charcoal inset panels.
- Slightly glossier black structural frame and rails.
- Subdued cyan display.
- Cool-white perimeter light with restrained orange accent.
- No brand text or external texture.

## Semantic rendered-part contract

Every visible dedicated-root mesh must expose a stable `partTag`. Paired or repeated parts also expose `side` and/or `partIndex`.

### X16 tags

- `x16-belt`
- `x16-deck-shell`
- `x16-foot-rail`
- `x16-front-roller`
- `x16-rear-roller`
- `x16-base-rail`
- `x16-crossmember`
- `x16-leveling-foot`
- `x16-incline-upright`
- `x16-lift-actuator`
- `x16-motor-hood`
- `x16-console-shell`
- `x16-console-controls`
- `x16-stop-key`
- `x16-display-bezel`
- `x16-display-panel`
- `x16-pivot-neck`
- `x16-handrail`

### Stair tags

- `stair-tread`
- `stair-riser`
- `stair-side-shroud`
- `stair-shroud-inset`
- `stair-entry-step`
- `stair-base-rail`
- `stair-cross-foot`
- `stair-console-mast`
- `stair-console-housing`
- `stair-console-screen`
- `stair-handrail`
- `stair-white-edge-light`
- `stair-orange-accent`

## Performance and resource limits

### X16

- At most 32 visible builder meshes.
- At most 6 shared materials.
- About 1,200 triangles or fewer.
- Cylinder/tube radial segments capped at 12, with 16 permitted only where a roller or pivot visibly benefits.
- No per-machine light and no texture.

### Stair Machine

- At most 56 visible builder meshes.
- At most 8 shared materials.
- At most 24 unique geometries.
- Tube radial segments capped at 12–14.
- No per-machine light and no external texture.

All geometry and materials must remain stable across two create/destroy cycles and be disposed exactly once through the existing view lifecycle. Only structural parts cast shadows; screens, accents, treads, risers, and small hardware do not.

## Error handling and fallback

- Existing exact profile dispatch remains unchanged.
- A dedicated-builder exception or null result continues to produce the complete existing generic treadmill or stair-climber fallback.
- A failed detailed build must not leave staged geometry, click targets, resources, diagnostic counts, or semantic tags behind.
- The next render after a forced failure must restore the exact dedicated model with zero builder failures.

## Test design

Follow strict browser-observed RED → GREEN development.

### X16 assertions

- Exact 22 × 60 in belt.
- Rear tread top equals 13.66 in within 0.02 ft.
- Local `-Z` tread end is higher than local `+Z` for the accepted static pose.
- Front-only parts remain at local `z<0`; rear roller remains at `z>0`.
- Two foot rails, two base rails, two main uprights, both rollers, hood, console, display/bezel, pivot, lift actuator, and paired handles exist with semantic tags.
- Display diagonal is 15.8–16.2 in; visible panel depth is at most 1.25 in.
- Handle maximum Y is 72–73.3 in.
- Visible AABB uses at least 90% of width, 93% of length, and 98% of height, touches the floor, and never escapes the measured envelope.
- X16 rails use dark structure material, not bright chrome.

### Stair assertions

- Exactly eight ordered treads and seven risers.
- Exactly two side shrouds and two inset faces.
- One rear entry step, paired open base rails/cross feet, two complete handrail paths, one landscape screen inside a larger console housing, paired white edge-light sets, and paired orange accents.
- Every visible mesh has a semantic tag.
- Console screen is emissive, landscape-oriented, bounded by its housing, and does not cast shadows.
- Polygon vertices, lights, rails, and every visible part remain within the 32 × 50 × 82 in envelope.

### Saved-layout and regression assertions

- X16 and Stair saved instance records remain byte-for-byte unchanged.
- Canonical footprints, world footprints, centers, `rotationY=π/2`, `visualRotationY=0`, and `__invalid:false` remain unchanged.
- X16 local front `-Z` still transforms to world `-X`.
- Stair entry still faces the open room and the ceiling warning appears exactly once.
- All 11 Layout 3 dedicated models render, builder failures stay zero, garage/wall features remain unchanged, and standard fallbacks still pass forced-failure tests.
- Resource, click-target, listener, canvas, and diagnostics counts remain stable across repeated create/destroy cycles.

## Browser QA

Capture unobstructed selected-only evidence for both machines:

1. Front three-quarter.
2. Exact side elevation.
3. Rear-entry three-quarter.
4. Elevated/top view.
5. Saved Layout 3 walkthrough at 5 ft 8 in eye height.
6. Opposite side with walls hidden when needed to prove the full silhouette.

For the Stair Machine, also use a low entry view to judge the step, risers, and rail reach. For the X16, use a low rear-deck view to judge the 22 × 60 in belt, roller, and floor contact.

Final acceptance requires:

- Product-faithful silhouettes from all major angles.
- No clipping, floating, envelope escape, or changed placement.
- Stable Preview and Walkthrough movement.
- No relevant console warning/error.
- Fresh logic, equipment real-Three, wall-feature, garage-door, and runtime-cache runners at zero failures.
- Atomic cache-version updates for every changed production/test asset.

