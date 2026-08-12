# Garage Door and Left-Wall Refresh Design

**Date:** 2026-08-11
**Status:** Approved

## Summary

Layout 3 currently treats its bottom wall as a decorative wall, with a mirror, walnut slats, and LED accents. The real room uses that wall as a garage door. This change replaces the bottom-wall decoration with a centered, closed 16-foot traditional raised-panel garage door and moves the functional finishes to the usable left wall:

- one continuous mirror behind the Stair Machine and three-tier dumbbell rack,
- walnut slats behind the Ice Barrel cold plunge,
- the associated warm LED accents moved with those finishes,
- the existing right-wall mirror and top-wall cardio LED retained.

The garage door will appear as a clear architectural opening in Plan mode and as a complete physical door in 3D Preview and Walkthrough. The update changes only Layout 3's known starter architecture and decoration. It does not move equipment or reset other layouts.

## Approved Decisions

- **Opening:** centered 16 ft 0 in garage door in the 19 ft 10 in bottom wall.
- **Side returns:** 1 ft 11 in of wall remain on each side.
- **Door style:** traditional matte-black raised-panel sectional door, matching the middle visual concept selected by the user.
- **Door state:** closed in 3D and Walkthrough.
- **Walls and floor:** black walls and rolled black rubber remain.
- **Mirror:** move to the left wall behind the Stair Machine and dumbbell rack.
- **Slats:** move to the left wall behind the Ice Barrel.
- **Lighting:** move the mirror/slat accent lights with their corresponding features; retain the top cardio light.

## Goals

- Make the bottom wall immediately recognizable as a real garage door in every spatial view.
- Preserve the saved room dimensions and the user's 11 equipment placements.
- Put the training mirror where it is useful for the stepper and dumbbell area.
- Put walnut slats behind the cold plunge without crossing the missing left-wall segment.
- Keep all wall features individually selectable, movable, resizable, recolorable, and removable after migration.
- Update an existing saved or re-imported Layout 3 once without duplicating the door or repeatedly restoring deleted decoration.
- Preserve existing placement, collision, import/export, framing, and Walkthrough behavior.
- Keep the two machines already positioned against the garage wall valid; the new door is architectural, not a newly imposed operating-clearance zone.

## Non-goals

- Opening, closing, or animating the garage door.
- Simulating an exterior driveway or permitting the Walkthrough camera to leave the room.
- Repositioning any equipment.
- Resolving the existing Stair Machine low-ceiling conflict.
- Adding manufacturer-specific branding or photogrammetry.
- Adding editor choices for other garage-door visual styles in this change. The selected raised-panel style is the rendered default.
- Replacing the existing standard hinged-door model.

## Existing Conditions

### Room and architectural shell

- Base room: 19 ft 10 in wide × 19 ft 6 in long × 9 ft high.
- Bottom wall: full 19 ft 10 in base-room boundary.
- Left-wall extension begins at 14 ft 3 in from the top and removes the original base left wall below that point.
- A 4-inch raised-floor zone covers the top 3 feet of the room.
- Existing low-ceiling zones remain unchanged.

### Equipment adjacent to the left wall

| Equipment | Saved wall run |
| --- | ---: |
| Stair Machine | 0 ft 0 in–2 ft 8 in |
| Three-tier dumbbell rack | 3 ft 0 in–about 8 ft 7 in |
| Ice Barrel 500 | 9 ft 0 in–about 13 ft 10 in |

### Current rendering gap

The planner already recognizes `garagedoor` as an area that removes a matching wall span and can reserve floor space according to global settings. The user's current export has garage-door blocking disabled. However, 3D currently builds only standard hinged doors. A garage-door area therefore becomes an empty opening instead of a physical sectional door.

Existing wall-feature validation already rejects a mirror, slat panel, or LED strip that overlaps a standard door or garage-door opening. Once the bottom garage area is present, the old bottom-wall features will correctly be invalid; the migration moves them instead of leaving them in that state.

## Exact Layout 3 Arrangement

### Garage door area

The door uses the existing reserved-area coordinate model and a stable ID, `area_l3_bottom_garage_v1`:

| Field | Value |
| --- | ---: |
| Kind | `garagedoor` |
| Label | `16 ft raised-panel garage door` |
| X | 1 ft 11 in |
| Y | 18 ft 6 in |
| Plan width | 16 ft 0 in |
| Plan depth | 1 ft 0 in |
| Physical door height | 7 ft 0 in |
| Style | traditional raised panel |
| State | closed |

The 1-foot plan depth is an editor selection footprint, not the physical panel thickness or an operating-clearance zone. The 3D door slab is approximately 2 inches thick and sits at the bottom-wall opening. The Gazelle and Combo Adductor/Abductor already occupy part of this last foot of the room; they remain in their saved positions and remain valid.

Garage areas retain the common area fields and add normalized rendering metadata:

```js
garageDoorHeightFt: 7,
garageDoorHeightIn: 0,
garageDoorStyle: "raised-panel",
garageDoorColor: "#191b1d",
blocksPlacement: false,
subtractsSpace: false
```

The two placement flags make this seeded garage area architectural-only. They override global reserved-area settings for this area, so importing the layout under different preferences cannot silently invalidate the saved equipment. A future user who wants operational door clearance can add a separate no-go area. Other garage areas continue to follow the planner's existing global reserved-area settings. Older garage areas receive the rendering values as defaults but do not automatically receive the two `false` placement overrides. The style fields are persisted for deterministic rendering, but this change does not add a style picker to the inspector.

### Left-wall finishes

| Feature | Along-wall start | Mount height | Size | Finish | Brightness |
| --- | ---: | ---: | ---: | --- | ---: |
| Primary training mirror | 0 ft 0 in | 1 ft 0 in | 8 ft 9 in × 7 ft 6 in | cool silver `#cbd5e1` | n/a |
| Mirror wash LED | 0 ft 0 in | 8 ft 7 in | 8 ft 9 in × 1 in | warm white `#ffd7aa` | 65% |
| Cold-plunge slat wall | 9 ft 0 in | 0 ft 0 in | 5 ft 0 in × 8 ft 6 in | walnut `#8f5f3a` | n/a |
| Slat frame LED, upper run edge | 8 ft 11 in | 0 ft 4 in | 1 in × 8 ft 0 in | warm `#ffb36b` | 80% |
| Slat frame LED, lower run edge | 14 ft 1 in | 0 ft 4 in | 1 in × 8 ft 0 in | warm `#ffb36b` | 80% |

For left-wall features, “along-wall” is measured from the room's top edge. The slat wall ends at 14 ft 0 in, three inches before the left-wall extension begins. The final LED ends at 14 ft 2 in, one inch before that same boundary.

The mirror remains one continuous, level panel. Its 1-foot mounting height is measured from the base slab datum. Behind the 4-inch raised platform at the Stair Machine, the visible gap above the local finished floor is therefore 8 inches; beyond the platform it is 12 inches. This avoids splitting or stepping the mirror at the platform transition.

### Retained features

- Right-wall secondary aisle mirror: unchanged.
- Top-wall cardio ambient LED: unchanged.

### Removed bottom-wall features

No mirror, slat panel, or LED remains mounted on the garage-door wall. The known starter IDs are relocated or retired as part of the one-time Layout 3 migration; unrelated user-created features are untouched.

## Plan View

The garage-door area remains selectable and resizable, but its symbol becomes architectural rather than a generic amber rectangle.

- Draw a heavy line at the actual wall opening.
- Draw four sectional bands parallel to the wall.
- Divide those bands into four raised-panel bays, producing the selected 4 × 4 traditional pattern.
- Keep a light amber architectural selection tint inside the 1-foot editor footprint, while clearly indicating that this seeded door does not reserve operating clearance.
- Label it “Garage door” without a swing arc.
- Use a stronger selection outline and existing resize handles when selected.
- Preserve keyboard/pointer area selection and the selected-area inspector.

The bottom-wall feature symbols disappear after migration. The left-wall mirror, slats, and LEDs use the existing wall-feature symbols and one-dimensional dragging behavior.

## 3D Garage Door Model

### Main assembly

The door is a dedicated architectural group registered under the garage area ID so a garage area selected in Plan can be framed in 3D.

- Closed 16 ft × 7 ft sectional slab aligned with the bottom wall.
- Four horizontal door sections.
- Four raised rectangular panels per section, for 16 visible panels total.
- Matte charcoal-black powder-coated finish that remains distinguishable from the black wall through roughness, shallow relief, and edge highlights.
- Dark recessed panel centers and subtly brighter beveled borders.
- Realistic approximately 2-inch slab thickness.
- Black side jambs and head frame.
- Compressible black bottom weather seal and a thin threshold.
- Centered low-profile pull handle and restrained hinge/roller hardware.

### Garage hardware

The inside view includes the parts that make the wall read as a working garage door:

- vertical side tracks,
- curved transitions into ceiling tracks,
- short horizontal overhead tracks,
- torsion bar and spring above the header,
- center opener rail and compact opener motor near the ceiling.

Hardware uses bounded detail and shared materials so it improves realism without creating an excessive number of meshes or shadow casters. Small hardware does not affect equipment collision.

### Wall and opening behavior

- The existing boundary segmentation continues to remove only the 16-foot opening.
- The 1 ft 11 in black wall returns remain visible on both sides.
- The model fills the opening up to 7 feet.
- Existing wall material fills the 2-foot header region above the door to the 9-foot ceiling.
- Garage geometry follows the detected touched wall, so future top, bottom, left, or right garage-door areas render with the correct orientation rather than relying only on rectangle aspect ratio.

## Walkthrough, Collision, and Minimap

- Walkthrough shows the complete closed door and hardware.
- The camera remains inside the room using the existing room-union boundary rule.
- The garage door receives no hinged-leaf swing collider and no swing arc.
- The seeded 1-foot editor footprint does not block or invalidate the Gazelle or Combo Adductor/Abductor. The closed door and room boundary still prevent the Walkthrough camera from leaving the room.
- The minimap draws a thick garage-door segment at the opening, distinct from the standard hinged-door leaf.
- Wall-feature collision remains unnecessary because the mirror, LEDs, and slats are shallower than the existing wall clearance margin.

## Data, Migration, and Persistence

### One-time Layout 3 design revision

Layout 3 receives `garageWallRevision: 1` to identify this approved architectural refresh. A shared signature-based migration helper is called by named-layout loading, full import, and legacy single-layout import. It targets the 19 ft 10 in × 19 ft 6 in room with the known Layout 3 equipment/feature signature; the layout name is supporting evidence, not the only key. It must not modify an unrelated layout that happens to share the name. On first normalization of a matching older Layout 3:

1. Reuse a pre-existing bottom-wall garage area when its center and run match the intended 16-foot opening within a small tolerance; otherwise add the stable 16-foot garage-door area. Top/side garage areas and clearly different manual bottom openings are preserved.
2. Relocate the known primary mirror and mirror-wash IDs to the left-wall values above when those records still match the old starter signature.
3. Relocate the known slat panel and two frame-LED IDs to the left-wall values above when those records still match the old starter signature.
4. Retain the known right mirror and top cardio LED.
5. Preserve all equipment, room geometry, floor/ceiling zones, the standard entry door, outlets, and unrelated user-created wall features.
6. Preserve a pre-refresh feature that uses a known ID but has materially different user-customized values; surface the normal garage-overlap warning instead of overwriting it.
7. Do not recreate a known starter feature that is already absent before migration.
8. Record the revision so later normalization does not re-add a garage door or restore a feature the user subsequently deletes.

The migration is idempotent: running it repeatedly produces the same result and no duplicate IDs.

### Import/export behavior

- Full and layout-only exports retain the garage area, relocated wall features, and revision marker.
- The export schema advances from version 12 to version 13.
- Re-importing an old pre-refresh Layout 3 applies the migration once.
- Legacy single-layout imports use the same signature-based migration instead of bypassing the named-layout path.
- Re-importing a refreshed Layout 3 preserves user changes and does not re-seed removed features.
- Layouts 1 and 2 receive no garage door or decoration changes.
- Layout duplication copies the current architectural state exactly.
- API-key export redaction remains unchanged.

## Failure Handling

- A garage area that does not touch a physical room boundary remains visible as a Plan area, is not rendered as a floating 3D door, and produces a clear warning.
- A garage door that spans a missing base-wall segment is reported instead of silently floating.
- If garage model construction fails, the renderer keeps the rest of the scene available, reports one fallback warning, and restores a simple closed panel rather than leaving a walk-through hole.
- Invalid wall features remain editable in Plan mode and do not render as detached 3D meshes.
- A deleted post-migration feature stays deleted.

## Accessibility and Controls

- The Plan garage-door group exposes an accessible name and selected state.
- Area selection and resizing retain the existing keyboard and pointer paths.
- The 3D group uses the same selected-area focus metadata as the standard door.
- The selected-area inspector continues to expose exact X, Y, width, and depth values.
- Garage doors do not show standard-door hinge, swing, or radius controls because those fields do not apply.

## Verification and Acceptance Criteria

### Migration and data

- The complete old Layout 3 starter fixture migrates to exactly one garage area, two mirrors, one slat panel, and four LEDs.
- In the complete old starter fixture, the five known bottom-wall decoration records are relocated or retired with no remaining bottom-wall feature.
- Running normalization twice produces byte-equivalent architecture and no duplicate IDs.
- Deleting a migrated feature and reloading does not restore it.
- A pre-refresh missing or customized known feature is not silently recreated or overwritten.
- A matching manually added bottom garage area is reused; unrelated garage areas are preserved.
- Full and legacy single-layout import routes apply the same migration.
- Layouts 1 and 2 remain unchanged.
- Export/import round-trips the refreshed architecture.

### Plan

- The garage door occupies x = 1 ft 11 in through 17 ft 11 in on the bottom wall.
- The 4 × 4 raised-panel symbol is visible and selectable.
- No standard-door swing arc appears.
- The garage selection footprint is architectural-only and does not invalidate the two existing machines against that wall.
- Adding a separate no-go area remains the explicit way to reserve operational clearance.
- Left-wall mirror/slat/LED symbols are valid and stop before the missing wall segment.

### 3D Preview and Walkthrough

- Exactly one raised-panel garage model fills the bottom opening.
- Both 1 ft 11 in side wall returns and the 2-foot overhead wall infill remain visible.
- Four sections, 16 raised panels, jambs, seal, handle, tracks, torsion hardware, and opener rail are present.
- Selecting the garage area in Plan and invoking “Frame selected” focuses its 3D model.
- The minimap shows the garage segment.
- No garage swing collider is created.
- The Gazelle and Combo Adductor/Abductor retain their saved positions and valid state.
- The mirror spans the stepper/dumbbell wall run and the slats span the cold-plunge run.
- Black walls, rolled rubber, right mirror, and top cardio LED remain.
- Preview and Walkthrough produce no console errors or warnings attributable to the refresh.

### Regression and performance

- Standard hinged-door rendering and collision remain unchanged.
- Garage doors on horizontal and vertical boundaries orient correctly.
- An off-wall garage area fails safely without floating geometry.
- Wall-feature overlap validation still rejects features crossing either standard or garage openings.
- Per-area `blocksPlacement` and `subtractsSpace` overrides affect only the seeded architectural garage area; ordinary reserved areas retain current behavior.
- The existing 11 dedicated equipment models still render and frame correctly.
- A 60-second orbit and Walkthrough check shows no runaway geometry, light, or event-listener growth.

## Known Existing Warning

The Stair Machine overlaps a saved 5-foot low-ceiling zone while requiring substantially more height. This is a pre-existing equipment-clearance warning. The mirror and garage-door refresh do not worsen or resolve it, and the equipment remains in its saved position as requested.

## Alternatives Considered

### Full-width 19 ft 10 in door

Rejected because the user selected a standard centered 16-foot door and wants visible side wall returns.

### Modern flush sectional door

Rejected for this iteration after visual comparison; the user selected the traditional raised-panel option.

### Frosted-glass full-view door

Rejected for this iteration after visual comparison. It would introduce a brighter translucent focal wall and a different privacy/material treatment than requested.

### Split mirror around the top-left corner

Not selected. A single continuous left-wall mirror better serves both the stepper and dumbbell rack and is easier to position and edit.
