# Faithful GATOR and Echo Rower Models with Walkthrough Editing

## Summary

Rebuild the saved RitFit GATOR bench and Rogue Echo Rower as recognizable,
lightweight procedural 3D models, then add an explicit Walkthrough Edit mode.
Edit mode lets a user select equipment, rotate it, move it in six-inch or
one-inch steps, and place or edit mirrors, wood slat panels, and LED strips by
clicking the intended wall. The same layout state continues to power Plan,
Split, 3D, and Walkthrough, so every accepted edit appears everywhere and
persists through reload, duplication, export, and import.

Normal first-person navigation remains unchanged when Edit mode is off.

## Goals

- Make the GATOR bench and Echo Rower recognizable from all major viewing
  angles without importing heavy external 3D assets.
- Preserve the saved equipment floor footprints and existing placements.
- Give Walkthrough a deliberate Walk/Edit switch so editing never competes
  with first-person look and movement controls.
- Let users move selected equipment by six inches, with an optional one-inch
  Fine setting, and rotate it by 90 degrees.
- Let users choose Mirror, Wood slat panel, or LED strip and click the exact
  wall location where it should be added.
- Reuse the planner's existing hard-collision, clearance-warning, wall-feature
  normalization, and wall-feature validation rules.
- Provide one-session undo for Walkthrough edits.
- Keep Preview and Walkthrough responsive with the saved dense layouts.

## Non-goals

- No freeform 3D translation gizmo or direct drag-and-drop equipment movement
  in this version.
- No arbitrary-angle equipment rotation; equipment rotation remains 90-degree
  increments so its rectangular footprint remains exact.
- No resizing equipment from Walkthrough.
- No moving doors, outlets, room walls, floor zones, ceiling zones, or garage
  doors from Walkthrough.
- No manufacturer GLB/GLTF dependency, photogrammetry, billboard, or product
  photo plane.
- No animation of the rower's seat, chain, fan, or monitor.
- No multi-level undo history shared across reloads. Undo is limited to edits
  made during the current Walkthrough session.

## Source and measurement contract

### RitFit GATOR 1600LB Adjustable Weight Bench

- Exact saved item: `item_e480f74e83796_19d9488df84`.
- Saved planner envelope: 26 in wide × 58 in long × 53 in high.
- Saved placement remains unchanged in Layouts 1, 2, and 3.
- The embedded 520 × 520 saved product image is the visual reference for the
  selected configuration.
- The current official product measurements are 25.2 in wide × 57.8 in long,
  with a height range of 14.6–51.3 in. The saved 26 × 58 × 53 envelope is the
  conservative planner envelope and remains authoritative for placement.
- Official product-defining details include 50 × 70 mm reinforced steel,
  2.7-in pads, a 25.9 × 11.8-in back pad, 12.6 × 11.8-in seat pad, 9 × 11.8-in
  headrest, 10 back settings, 3 seat settings, 5 headrest settings, enclosed
  adjustment brackets, transport wheels, and a knurled movement handle.
- Reference: [RitFit GATOR official product page](https://www.ritfitsports.com/products/ritfit-gator-adjustable-weight-bench).

### Rogue Echo Rower

- Exact saved item: `item_83e6deed4834c_19d9433a616`.
- Saved footprint: 26 in wide × 99 in long.
- The saved `height:16` describes the official seat height, not the highest
  point of the monitor assembly. It must not squash the procedural model to a
  16-in total height.
- The 26 × 99-in footprint remains authoritative for placement, collision,
  Plan rendering, and export. The dedicated model uses 16 in as the exact seat
  height and derives its monitor/fan silhouette from the official product
  imagery and schematics without changing the saved record.
- Official product-defining details include the heavy-duty aluminum main
  frame and slide rail, large air-resistance fan, flex footplates with
  quick-release straps, nickel-plated chain, rolling seat, rear foot, front
  transport wheels, turf tires used when folded, twin monitor masts, 4.7-in
  LCD console, and integrated phone holder.
- Reference: [Rogue Echo Rower official product page](https://www.roguefitness.com/rogue-echo-rower) and [official exploded schematic](https://assets.roguefitness.com/image/upload/v1744729096/Customer%20Instructions/IP0917%20-%20ECHO%20ROWER/Echo_Rower_Schematic_zdynfp.pdf).

## Architecture

The work is divided into three isolated units.

### 1. Dedicated equipment models

Keep the existing procedural model registry. Rebuild the existing
`ritfit-gator-bench` builder and add an exact `rogue-echo-rower` profile and
builder. Exact-name inference must run before broad `rower` or bench matching.
Only the exact Rogue Fitness / Rogue Echo Rower record receives the new exact
profile; other rowing machines continue using their current profiles.

Both builders use the existing model-kit primitives and stable semantic
metadata. Their rigid structure remains within the saved width and length.
Small non-floor-contact details may visually project within a tightly bounded
allowance only when the official product does so, but this does not change the
planner footprint.

The Echo Rower builder receives a model presentation height separate from the
saved 16-in seat-height datum. The separation is explicit and exact-profile
only; it does not redefine the saved item or generic equipment height rules.

### 2. Walkthrough edit state and commands

Add transient Walkthrough editing state to the current layout view state:

- mode: `walk` or `edit`
- move step: `0.5 ft` or `1/12 ft`
- active wall-add tool: `mirror`, `slat`, `led`, or none
- last accepted Walkthrough edit snapshot for one-step undo
- current Walkthrough edit status and validation message

Keep mutations behind small shared commands rather than editing state directly
from the renderer:

- rotate an equipment instance by 90 degrees
- nudge an equipment instance in world X or Y
- add a wall feature from a resolved wall hit
- patch or remove a selected wall feature
- undo the last accepted Walkthrough edit

Plan and Walkthrough use the same rotation/collision functions. Moving an item
uses the existing room union, hard-placement, and clearance checks. Adding or
editing a wall feature uses the existing wall resolver, normalizer, and
validator.

### 3. Walkthrough selection and wall hit resolution

In Walk mode, the existing canvas behavior remains unchanged: click activates
walking, drag looks around, and WASD/arrow keys move the camera.

In Edit mode:

- pointer lock is released and cannot be reacquired accidentally;
- clicking equipment selects it;
- clicking an existing wall feature selects it;
- when a wall-add tool is active, clicking a real wall surface resolves the
  exact base-room boundary segment, wall side, distance along the wall, and
  mounting height;
- dragging the canvas does not rotate the camera;
- keyboard movement does not move equipment implicitly.

The wall hit resolver must use the same physical room boundary information as
the 3D walls and garage/door openings. It must reject a hit on a door, garage
door, missing wall run, wall extension seam, or non-wall object. A successful
hit converts the 3D intersection into the existing wall-feature data model.

## GATOR visual design

Build the selected inclined configuration shown by the saved reference while
staying inside the saved 26 × 58 × 53-in planner envelope.

### Frame and adjustment system

- Replace the current thin generic rails with a substantial 50 × 70-mm-style
  central spine and welded front/rear stabilizers.
- Use the saved reference orientation: head/back end at local `-Z`, seat/front
  end at local `+Z`.
- Build the rear wide foot, front transport structure, grounded stabilizer
  pads, two transport wheels, and knurled lifting handle.
- Add the distinctive silver enclosed angle plate with ten visible back-angle
  stations and a restrained pivot/locking-pin assembly.
- Use separate seat, back, and headrest supports with believable hinge points.

### Pads and rollers

- Use official pad proportions: 12.6-in seat, 25.9-in back, and 9-in headrest,
  each up to 11.8 in wide and approximately 2.7 in thick.
- Preserve the visible two-inch seat/back gap.
- The selected pose uses an inclined back and raised headrest rather than a
  flat bench.
- Keep four substantial foam rollers on two crossbars at the upper back/head
  area, with correct end caps and supports.
- Add the front foot brace/decline support visible in the saved image.

### Materials

- Textured near-black powder-coated frame.
- Matte black vinyl pads with subtle edge seams.
- Brushed silver adjustment plate and pins.
- Dark rubber feet, wheels, grips, and foam rollers.
- Restrained white RitFit-style badge geometry may be used only if it remains
  lightweight and legible; no external texture is required.

## Rogue Echo Rower visual design

Build the rower in its unfolded training configuration with local front/fan at
`-Z` and rear foot at `+Z`.

### Main frame and rail

- Preserve the exact 26 × 99-in floor footprint.
- Build a low, long aluminum slide rail with a distinct central channel and a
  rear stabilizing foot.
- Place the rolling saddle with its top exactly 16 in above the floor.
- Add paired seat rollers beneath the saddle and a bounded rail stop.
- Add the fold hinge and latch near the fan/footplate assembly without
  modeling a second folded state.

### Fan and user station

- Use a broad circular fan housing with visible radial grille detail and a
  restrained damper control.
- Add the grounded front foot, paired transport wheels, and larger turf tires
  associated with folded transport.
- Add two separate angled flex footplates, heel cups, dark quick-release
  straps, and center spacing.
- Add a nickel-colored chain path, handle rest, and horizontal rowing handle
  with dark grips. The chain is a thin non-collision detail.

### Monitor assembly

- Build paired angled monitor masts anchored at the front frame.
- Use a compact 4.7-in LCD console with a visible dark-cyan display.
- Add the integrated phone holder above or behind the console.
- The console and fan may rise above the saved 16-in seat-height datum, but
  stay within the dedicated model's documented visual envelope and never
  affect its 26 × 99-in collision footprint.

### Materials

- Textured black powder coat and dark anodized aluminum.
- Near-black fan grille, footplates, straps, seat, wheels, and grips.
- Small nickel/chrome accents for chain and axles.
- Subdued dark-cyan display; no per-machine light or external texture.

## Walkthrough interface design

### Walk/Edit switch

The Walkthrough header gains a two-state control:

- **Walk:** current first-person controls and status.
- **Edit:** releases pointer lock, exposes editing tools, changes the canvas
  cursor, and announces that walking is paused.

Switching modes does not reset the camera. Exiting Walkthrough resets transient
edit mode/tool/status/undo state but preserves accepted layout edits.

### Equipment controls

Selecting equipment in Edit mode opens a compact panel containing:

- equipment name;
- Rotate 90°;
- four directional move buttons labeled relative to the room plan: Up,
  Right, Down, Left;
- step selector: 6 in or Fine 1 in;
- current X/Y position and orientation;
- validation/status message.

The controls operate in room coordinates, not camera-relative coordinates, so
the same button always produces the same Plan movement regardless of where the
user is looking. The minimap highlights the selected item and makes this
mapping visible.

### Wall-feature controls

The Edit panel provides three add tools:

- Mirror
- Wood slat panel
- LED strip

After choosing a tool, the canvas and instruction text enter a one-shot
placement state. Hovering a valid wall shows a lightweight placement preview.
Clicking creates the feature and selects it; clicking elsewhere keeps the tool
active and explains why placement was rejected. Escape or a Cancel button
leaves placement mode.

New features reuse the current planner defaults for size, color, brightness,
and minimum dimensions. Their along-wall position is centered at the click and
clamped to the valid wall run. Their bottom/mounting height is derived from the
click and clamped to the available ceiling above the local floor elevation.

Selecting an existing feature exposes the same essential editor used in Layout
Tools:

- type and label;
- wall side;
- along-wall position;
- mounting height;
- width and height;
- color;
- LED brightness;
- nudge along the wall;
- Remove.

The Walkthrough panel may use a compact responsive presentation, but it must
call the same patch/remove functions as the existing inspector.

### Undo Last Edit

Before each accepted Walkthrough mutation, capture only the affected layout
slice and current selection. Undo restores the immediately previous accepted
Walkthrough edit and then clears itself. Rejected edits do not replace the undo
snapshot. The supported actions are equipment move, equipment rotation, wall
feature add, wall feature patch, and wall feature removal.

## Collision and validation behavior

### Equipment

- A candidate that leaves the room union, crosses a solid wall, or physically
  overlaps another equipment body is rejected and the current placement stays
  unchanged.
- A candidate with only clearance/dead-space overlap is accepted, marked
  invalid in the same way as Plan, and reported as a warning.
- A valid candidate is accepted and saved immediately.
- Rotation remains center-preserving and uses the existing planner command: a
  single 90-degree candidate is accepted only when it passes hard-placement
  validation.
- Rejected commands never create an undo snapshot or move the camera.

### Wall features

- A feature may only attach to a real rendered wall run.
- Door, garage-door, missing-wall, ceiling, and feature-dimension constraints
  use the current wall-feature validator.
- A failed wall click or patch leaves the prior feature unchanged and reports
  the first actionable reason.
- Wall features do not become floor obstacles or Walkthrough collision bodies.

## Persistence and data flow

Accepted commands update `state.layout`, then synchronize the active named
layout through the existing render/persistence lifecycle. No separate
Walkthrough copy of the layout is introduced.

The following must round-trip unchanged:

- equipment X/Y coordinates and `rotated` state;
- exact Rogue and RitFit saved dimensions;
- wall-feature kind, wall, along-wall position, mounting height, width, height,
  color, brightness, label, and ID;
- selected layout and all unrelated layouts;
- garage, door, ceiling, floor, outlet, and wall-extension records.

Walkthrough mode, active add tool, status message, and undo snapshot are
transient and are not exported.

## Accessibility and responsive behavior

- The Walk/Edit control exposes its selected state programmatically.
- All editing actions are native buttons with visible focus and at least 44 ×
  44 CSS-pixel pointer targets on narrow screens.
- Equipment movement controls have explicit accessible labels that include the
  active step size.
- Status changes use a polite live region; collision rejections identify the
  reason without relying on color alone.
- Escape cancels wall placement before it closes Walkthrough.
- Edit mode remains usable at approximately 390 CSS pixels wide. The panel may
  collapse into a bottom sheet but cannot cover the entire viewport.
- Walk mode keyboard behavior remains unchanged. Edit mode does not intercept
  text-field input or repurpose WASD as equipment movement.

## Semantic rendered-part contract

Every visible dedicated model mesh receives a stable `partTag`. Repeated parts
also expose `side` and/or `partIndex` where meaningful.

### GATOR tags

- `gator-main-spine`
- `gator-front-stabilizer`
- `gator-rear-stabilizer`
- `gator-foot-pad`
- `gator-transport-wheel`
- `gator-lifting-handle`
- `gator-angle-plate`
- `gator-angle-station`
- `gator-lock-pin`
- `gator-seat-support`
- `gator-back-support`
- `gator-head-support`
- `gator-seat-pad`
- `gator-back-pad`
- `gator-head-pad`
- `gator-roller-crossbar`
- `gator-foam-roller`
- `gator-front-brace`

### Echo Rower tags

- `echo-main-frame`
- `echo-slide-rail`
- `echo-rail-channel`
- `echo-rear-foot`
- `echo-seat`
- `echo-seat-roller`
- `echo-rail-stop`
- `echo-fold-hinge`
- `echo-fold-latch`
- `echo-fan-housing`
- `echo-fan-grille`
- `echo-fan-spoke`
- `echo-damper`
- `echo-front-foot`
- `echo-transport-wheel`
- `echo-turf-tire`
- `echo-footplate`
- `echo-heel-cup`
- `echo-foot-strap`
- `echo-chain`
- `echo-handle-rest`
- `echo-rowing-handle`
- `echo-monitor-mast`
- `echo-console-shell`
- `echo-console-screen`
- `echo-phone-holder`

## Performance and resource limits

### GATOR

- At most 58 visible meshes.
- At most 6 shared materials.
- At most 26 unique geometries through repeated-part sharing.
- No per-machine light or texture.
- Small hardware and adjustment stations do not cast shadows.

### Echo Rower

- At most 72 visible meshes.
- At most 8 shared materials.
- At most 30 unique geometries through repeated-part sharing.
- Fan/spoke radial detail is bounded and does not use transparent stacked
  photo planes.
- No per-machine light or external texture.

Both builders must remain stable across repeated create/destroy cycles. Shared
resources are disposed exactly once through the existing view lifecycle.

## Error handling and fallback

- Exact-profile builder exceptions and null results fall back to the existing
  complete generic bench or rowing-machine model.
- A failed detailed build leaves no staged geometry, click target, material,
  warning duplication, semantic tag, or diagnostic count behind.
- A subsequent clean render restores the dedicated model.
- Walkthrough command failures leave layout data, selection, camera, and undo
  history unchanged while displaying a useful message.
- If the wall resolver cannot confidently identify one physical wall run, it
  rejects the placement instead of guessing.

## Test design

Development follows browser-observed RED → GREEN tests.

### Profile and GATOR model tests

- Only the exact saved RitFit record receives `ritfit-gator-bench`.
- Saved dimensions and all three saved placements remain unchanged.
- Official seat/back/head pad proportions and approximate 2.7-in thickness are
  represented inside the saved envelope.
- Separate seat, back, head pad, supports, pivots, enclosed angle plate, ten
  stations, locking pin, four rollers, two crossbars, transport wheels,
  lifting handle, and stabilizers exist with semantic tags.
- The model touches the floor, uses the expected local front/rear convention,
  and stays inside the saved rigid envelope.

### Echo Rower model tests

- Only the exact Rogue Fitness / Rogue Echo Rower record receives
  `rogue-echo-rower`.
- The exact 26 × 99-in footprint is preserved.
- Seat top is 16 in above the local floor within a small rendering tolerance.
- The dedicated visual height is greater than 16 in without altering the saved
  item height.
- Fan, grille, damper, front/rear feet, aluminum rail, channel, rolling seat,
  flex footplates/straps, chain, handle, transport wheels, turf tires, twin
  monitor masts, 4.7-in display, and phone holder exist with semantic tags.
- The model touches the floor and remains inside its documented rigid visual
  envelope and floor footprint.

### Walk/Edit separation tests

- Walk mode retains pointer-lock, drag-look, WASD, arrows, collision movement,
  and reset behavior.
- Entering Edit mode releases pointer lock and preserves camera pose.
- Edit-mode clicks select equipment/features without activating walk or moving
  the camera.
- Returning to Walk mode preserves the camera pose and clears the active wall
  tool safely.
- Closing/reopening Walkthrough returns to Walk mode with no stale undo/tool.

### Equipment command tests

- Default directional buttons move exactly 6 in in room coordinates.
- Fine mode moves exactly 1 in.
- Rotation is center-preserving and exactly one 90-degree turn per activation.
- A hard-invalid move/rotation is rejected byte-for-byte.
- A clearance-only overlap is accepted with the same warning/invalid state as
  Plan.
- Accepted edits persist through reload, duplicate, full export/import, and
  single-layout export/import.
- One-step undo restores move and rotation state exactly.

### Wall-placement and editing tests

- Each of four base-room walls resolves the correct side, along-wall position,
  mounting height, rotation, and inward normal.
- Mirror, slat, and LED clicks create the correct normalized feature and select
  it.
- Click-centering clamps feature width to the valid wall run.
- Door, garage, missing wall, extension seam, outside-ceiling, and non-wall
  clicks are rejected without mutation.
- Patch, nudge, brightness/color, type, size, and removal reuse existing
  normalization and validation.
- One-step undo restores add, patch, and removal exactly.
- Wall additions round-trip through reload, duplication, and export/import.

### Saved-layout and regression tests

- All existing dedicated models, wall features, doors, garage door, room
  extensions, floor/ceiling zones, and placements remain unchanged.
- Standard generic bench and rower fallbacks still work.
- Existing Plan movement/rotation and Layout Tools wall-feature editing remain
  unchanged.
- Resource, click-target, canvas, event-listener, and diagnostic counts remain
  stable across repeated Preview/Walkthrough create/destroy cycles.

## Browser QA

### Equipment views

For both models capture:

1. Front three-quarter.
2. Exact side elevation.
3. Rear three-quarter.
4. Elevated/top view.
5. Low structural view showing grounded feet and open frame.
6. Walkthrough view at 5 ft 8 in eye height.

The GATOR review must clearly show the pad proportions, angle plate, stations,
rollers, transport hardware, and selected incline. The Echo review must clearly
show the fan, rail length, 16-in seat, footplates/straps, chain/handle, monitor,
and rear foot.

### Walkthrough editing acceptance

- Switch Walk → Edit → Walk without camera reset or accidental movement.
- Select, rotate, move 6 in, move Fine 1 in, trigger a hard rejection, and
  trigger a clearance warning.
- Add each wall-feature kind on valid walls and reject door/garage/missing-wall
  clicks.
- Edit size, mount height, color, LED brightness, nudge, delete, and undo.
- Confirm every accepted edit appears in Plan and 3D and survives reload.
- Verify keyboard focus, live status, Escape cancellation, and approximately
  390-pixel-wide presentation.
- Run at least 30 seconds of Walk mode and 30 seconds of repeated Edit actions;
  canvas/model/resource/feature counts remain stable with no relevant console
  warning or error.

Final acceptance requires fresh zero-failure logic, equipment real-Three,
wall-feature real-Three, garage-door real-Three, and runtime-cache runners, plus
atomic cache-version changes for every modified production and test asset.
