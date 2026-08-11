# Equipment Realism, Wall Features, and Rotation Design

**Date:** 2026-08-11
**Status:** Approved direction, ready for written-spec review

## Summary

This upgrade makes the gym planner easier to arrange and more believable in 3D without changing the measurements of the saved layout. It has three coordinated parts:

1. Replace the eight remaining generic equipment shapes in the active layout with dedicated product-shaped 3D models.
2. Add mirrors, wood slat panels, and LED light strips as individually placeable wall features.
3. Add an obvious one-click 90-degree rotation control and an `R` keyboard shortcut for selected equipment.

The implementation remains procedural and local: it builds detailed Three.js geometry from the product references and saved dimensions. It does not require Figma, manufacturer CAD files, or a remote rendering service.

## Goals

- Make every placed product in Layout 3 visually recognizable from its reference image or official product page.
- Keep each product's plan footprint and height aligned with the imported measurements.
- Let the user decide exactly which wall receives a mirror, slat panel, or LED strip and where it sits on that wall.
- Show wall features consistently in Plan, 3D, and Walkthrough modes.
- Make equipment rotation discoverable, fast, center-preserving, and safe.
- Preserve all wall, floor, door, raised-floor, layout import/export, and walkthrough behavior already in the planner.

## Non-goals

- Photogrammetry, manufacturer CAD ingestion, or pixel-perfect replicas of logos and small hardware.
- Live planar mirror reflections. Mirrors use a polished physical material and the existing environment lighting so they look reflective without doubling a scene render for every mirror.
- Curved, freehand, or corner-wrapping LED paths. This version supports straight wall-mounted strips whose width and height are editable.
- Mounting features on arbitrary room-extension faces. This version supports the four named base-room walls and reports when part of a chosen wall is absent because of a room extension or opening.
- Moving wall features freely across the floor. Their movement is constrained to the selected wall.

## Existing Constraints

- Imported dimensions are authoritative. Visual detail must fit the equipment footprint except for small flexible parts such as cable handles.
- Equipment orientation is stored independently from its source length and width. Dedicated models must honor the existing facing and rotation conventions.
- The current layouts include a left-side room extension, so sections of the base left wall are not physical exterior wall segments.
- Doors and garage doors remove wall spans. Wall features must not silently bridge those openings.
- Walkthrough performance must remain usable on the current local browser setup.

## 1. Dedicated Equipment Models

### Profile routing

Each remaining product receives an exact profile key before broader family matching. This prevents a detailed model for one product from being applied to every bench, treadmill, row machine, or storage rack.

The 3D renderer routes each exact profile to its own builder. Each builder uses a normalized local coordinate system, then scales the result to the saved width, depth, and height. The existing placement transform remains responsible for rotation and facing.

### Products and defining geometry

| Product | Saved dimensions | Dedicated visual signature |
| --- | --- | --- |
| Ice Barrel 500 | 30.7 in W × 57.6 in L × 42 in H | Asymmetric stepped black tub, tall rear well, sloped shoulder opening, thick rounded rim, molded entry step, visible water surface, and rear plumbing details |
| Commercial stair machine | 32 in W × 50 in L × 82 in H | Angular black shrouds, continuous stepped belt, broad landscape console, curved handrails, support legs, white edge lighting, and a restrained orange accent |
| NordicTrack X16 treadmill | 38.1 in W × 69.9 in L × 73.3 in H | Incline-capable chassis, cushioned running belt, front lift/motor enclosure, sweeping handrails, and a pivot-mounted 16-inch display |
| RitFit GATOR adjustable bench | 26 in W × 58 in L × 53 in H | Triangular spine, separate seat and tapered back/head pads, silver angle ladder, front leg rollers, and wide stabilizer feet |
| HS08 seated row | 2.82 ft W × 4.2 ft L × 6.28 ft H | Tall selector tower, dark shroud, red overhead pivot yoke, independent arms, chest pad, seat, split footplates, and narrow base |
| Seated/standing row | 3.67 ft W × 5.21 ft L × 4.18 ft H | Low plate-loaded frame, textured foot platform, inclined chest/seat assembly, independent arms, weight horns, and contrasting dark/red members |
| Combination adductor | 2.38 ft W × 4.99 ft L × 4.61 ft H | Selector tower, low seat and backrest, red pivot arms, thigh rollers, hand grips, and foot supports |
| Three-tier storage rack | 2.22 ft W × 5.58 ft L × 3.24 ft H | Gray A-frame ends, three angled rails, and distinct empty equipment saddles instead of automatically generated dumbbells |

### Modeling rules

- Structural frames use separate tubes, plates, joints, pads, screens, rollers, belts, stacks, and housings rather than one large silhouette block.
- Repeated details are instanced or built with lightweight shared geometries where practical.
- Product colors and material roughness follow the saved reference image. Chrome, rubber, upholstery, powder coat, glass, water, and display surfaces receive distinct materials.
- The model's rigid geometry stays within the saved plan footprint. Small cable handles and hand grips may extend slightly when that is needed for a recognizable silhouette.
- Collision continues to use the measured rectangular footprint. Decorative geometry never changes placement validity or reserved square footage.
- The product name and exact profile remain available in renderer metadata so automated checks can confirm that a dedicated builder was used.

## 2. Placeable Wall Features

### User workflow

The Layout Tools panel gains a **Wall finishes & lighting** section with three buttons:

- Add mirror
- Add wood slat panel
- Add LED strip

Adding a feature creates it on the top wall with a sensible default size, selects it, and opens its inspector. In Plan mode the user can drag it along its current wall. In the inspector the user can choose another wall and enter exact placement measurements.

The selected wall-feature inspector contains:

- Type and label
- Wall: top, right, bottom, or left
- Along-wall position in feet and inches
- Mounting height from the local finished floor in feet and inches
- Width and height in feet and inches
- Color, labeled for the selected type
- Brightness percentage for LED strips only
- Small nudge controls for accurate movement along the wall
- Remove control

For top and bottom walls, the along-wall position is measured from the room's left edge. For left and right walls, it is measured from the room's top edge. The interface states this rule beside the measurement.

### Data model

Each layout stores wall features separately from floor areas:

```js
wallFeatures: [{
  id,
  kind: "mirror" | "slat" | "led",
  label,
  wall: "top" | "right" | "bottom" | "left",
  startFt,
  startIn,
  bottomFt,
  bottomIn,
  widthFt,
  widthIn,
  heightFt,
  heightIn,
  color,
  brightnessPct
}],
selectedWallFeatureId: null
```

Wall features do not reuse reserved floor areas because they do not subtract floor space or block equipment placement. Existing layout duplication and full/layout-only import/export retain the array. Normalization supplies an empty array for older files, sanitizes six-digit hex colors, clamps brightness to 0–100, and clamps dimensions and placement to the chosen wall and ceiling.

Default values:

| Type | Along wall | Mount height | Size | Color | Brightness |
| --- | ---: | ---: | ---: | --- | ---: |
| Mirror | 1 ft | 1 ft 6 in | 6 ft × 5 ft | cool silver | n/a |
| Slat panel | 1 ft | 0 ft | 6 ft × 8 ft | warm walnut | n/a |
| LED strip | 1 ft | 7 ft 6 in | 8 ft × 1 in | warm white | 75% |

### Plan representation and editing

Wall features render after room geometry and before equipment so equipment selection remains predictable.

- Mirror: cyan/silver double line with an `M` marker.
- Slat panel: warm wood-colored strip with repeated dark hatch marks and a `SLAT` marker.
- LED strip: translucent colored glow line beneath a narrow bright line and an `LED` marker.
- Selected feature: high-contrast outline and dimension overlay.
- Invalid feature: red outline plus a plain-language warning in the inspector.

Pointer movement is one-dimensional. Top and bottom features follow horizontal pointer movement; left and right features follow vertical movement. Dragging never changes the chosen wall or mounting height. Exact vertical placement remains in the inspector because it cannot be represented reliably in a top-down view.

### 3D representation

Every feature is attached to the interior face of its selected wall and is raised from the finished floor at the center of its run. The existing raised-floor lookup determines the local floor elevation.

- **Mirror:** thin backer, slim frame, and polished physical-material face. It reflects the scene environment and lighting but does not create a separate live render pass.
- **Slat panel:** dark felt backer with evenly spaced vertical wood slats. Slat count is bounded so wide panels remain detailed without creating excessive geometry.
- **LED strip:** slim channel and diffuser with an emissive material using the selected color and brightness. Each strip can contribute one shadowless local light, with a global cap of eight active feature lights.

Wall features share the existing Walls visibility toggle and appear in both 3D Preview and Walkthrough. They add no new walkthrough collision because the existing wall margin already keeps the camera farther from the wall than their shallow depth.

### Wall validity

A feature is invalid when any part of its run:

- overlaps a standard door or garage-door opening on the same wall,
- spans a missing base-wall segment created by a room extension,
- extends beyond the chosen wall,
- sits below the local floor, or
- rises above the ceiling.

The editor clamps simple boundary and ceiling overflows. Door and missing-wall conflicts remain visible, are outlined in red, and produce a warning so the user can adjust or remove the feature. Invalid wall features are not rendered as floating objects in 3D.

## 3. Fast Equipment Rotation

### Controls

When equipment is selected in Plan mode, the interface shows:

- A large **Rotate 90°** button in a small toolbar directly above the plan canvas.
- A matching **Rotate 90°** button near the top of the selected-item inspector.
- The `R` keyboard shortcut.

The buttons expose an accessible name, a minimum 44-pixel target, and `aria-keyshortcuts="R"`. The shortcut is ignored while the user is typing in an input, textarea, or select; while a dialog is open; during a drag; in Walkthrough/pointer-lock mode; or when a modifier key is pressed.

### Rotation behavior

A single rotation command is used by the canvas toolbar, inspector button, keyboard shortcut, and any existing plan rotation glyph. It performs these steps:

1. Read the selected instance's current measured footprint and center point.
2. Swap the placed width and depth.
3. Recalculate the top-left position so the center point does not move.
4. Validate the rotated footprint against the room, openings, hard reserved zones, and placement rules.
5. Reject a hard-invalid rotation and leave the item unchanged, with a short status message explaining why.
6. Commit a valid rotation.
7. Commit a soft clearance conflict but mark it red and report the conflict, matching the planner's existing warning behavior.
8. Save and re-render Plan, 3D, and Walkthrough views.

This removes the current top-left pivot jump and ensures every rotation entry point applies the same validation rules.

## Persistence and Compatibility

- The export schema version advances from 11 to 12.
- Older exports load with `wallFeatures: []` and no selected feature.
- New exports retain wall features and continue to redact the API-key field.
- Layout duplication copies wall features as part of the architectural shell.
- Creating a new layout from the current shell copies wall features, matching the existing treatment of walls, doors, and floor zones.
- Equipment instances keep their existing IDs, source measurements, position, facing, and model overrides.

## Performance and Failure Handling

- Procedural models reuse materials and geometries where repeated detail is visually identical.
- Decorative parts that do not need shadows disable shadow casting.
- LED point lights are capped globally at eight; additional strips retain emissive glow without another light.
- Invalid wall features remain editable in Plan mode and do not create detached 3D meshes.
- A missing reference image falls back to the exact product profile and measured procedural model, never to an image cutout.
- A builder failure falls back to the existing family model and reports a renderer warning instead of preventing the scene from loading.

## Verification and Acceptance Criteria

### Equipment

- All eleven products in Layout 3 use their intended dedicated builders: the three already upgraded and the eight in this specification.
- Each new model matches its saved width, depth, and height within the existing renderer tolerance.
- Product orientation agrees across Plan, 3D Preview, and Walkthrough.
- No new model changes collision footprint, reserved area, or saved measurement values.
- No model has a solid placeholder slab where the reference shows an open frame.

### Wall features

- The user can add, select, edit, drag, nudge, move between walls, and remove each feature type.
- Feet-and-inches values round-trip through save, reload, duplicate, export, and import.
- Each type appears correctly on all four base walls in Plan, 3D Preview, and Walkthrough.
- Mirror, slat, and LED colors update immediately; LED brightness updates glow and respects the light cap.
- Door overlaps and the current left-wall extension gap produce a visible warning and no floating 3D mesh.
- Wall features do not affect floor square footage, equipment placement, or walkthrough collision.

### Rotation

- Selecting equipment reveals both visible rotation buttons.
- Button, `R` shortcut, and any plan glyph call the same command.
- Rotation preserves the selected item's center.
- Valid rotations save immediately and update every view.
- Hard-invalid rotations are rejected without moving the item.
- Soft clearance conflicts remain placed and receive the existing red warning state.
- Typing `R` in form fields does not rotate equipment.

### Regression checks

- Layouts 1, 2, and 3 still load without console errors.
- Plan-only mode does not leak the 2D editing canvas into 3D Preview.
- Doors, wall colors, floor materials, raised platforms, and walkthrough controls remain functional.
- Imported API keys are never written into a newly exported file.

## Implementation Order

1. Add the normalized wall-feature schema and compatibility migration.
2. Add shared wall-feature placement and validation helpers.
3. Build Plan rendering, selection, dragging, inspector editing, and accessibility.
4. Build mirror, slat, and LED 3D geometry and renderer metadata.
5. Consolidate equipment rotation into the shared center-preserving command and add visible controls/shortcut.
6. Add exact product profiles and the eight dedicated equipment builders.
7. Run syntax, automated DOM/renderer assertions, export/import round-trip checks, and browser walkthrough verification across all layouts.
