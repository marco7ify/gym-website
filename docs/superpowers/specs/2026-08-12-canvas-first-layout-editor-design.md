# Canvas-First Layout Editor Redesign

**Date:** 2026-08-12  
**Status:** Approved visual direction, ready for written-spec review

## Summary

The Layout page will become a stable, canvas-first workspace with three regions:

1. A searchable, independently scrollable equipment library on the left.
2. The existing Plan, Split 2D + 3D, and 3D canvas in the center.
3. A sticky contextual inspector on the right.

Selecting an object on the plan will replace the inspector contents without moving the page or requiring the user to scroll past the equipment library. Common placement controls stay near the selected object. Full equipment-record editing remains available through a separate, grouped editor with persistent Save and Cancel actions.

The redesign preserves the current Gym Planner visual language and all existing layout data, calculations, placement rules, 3D behavior, walkthrough behavior, and import/export behavior.

## Problem Statement

The current Layout page appends the selected-object editor beneath the equipment list. As the catalog grows, the controls move farther away from the canvas. The selected equipment panel is already over 1,100 pixels tall in a minimal data set, and the full equipment form is over 3,500 pixels tall. Its Save button can begin more than 3,600 pixels below the form's top.

This creates four connected problems:

- Selecting equipment can require substantial scrolling before editing it.
- The equipment library, placement editor, and layout tools compete in one long document flow.
- Editing an equipment record requires leaving the Layout page and losing visual context.
- Nested page and panel scrolling makes it hard to know which area will move.

## Goals

- Keep the canvas and selected-object controls visible at the same time on desktop.
- Make selection changes update in place without page jumps.
- Keep high-frequency placement actions within one interaction of the canvas.
- Let users add, search, filter, and inspect equipment without leaving the Layout page.
- Separate placement editing from full equipment-record editing.
- Preserve scroll positions and selection across ordinary re-renders.
- Provide clear selected, saved, warning, and invalid states without relying only on color.
- Make the core workflow usable with keyboard navigation and at narrower viewport widths.

## Non-goals

- Replacing the existing SVG plan renderer or Three.js scene.
- Changing room geometry, equipment measurements, collision rules, clearances, staging, comparison sets, or layout persistence.
- Redesigning the Wishlist, Ready to Buy, Settings, or import/export flows beyond the shared equipment-details editor required by this work.
- Adding multi-selection, alignment tools, undo/redo history, or freeform canvas zoom and pan in this iteration.
- Replacing the current application architecture with a framework.

## Information Architecture

### Desktop workspace

At wide desktop sizes, the Layout page uses three persistent columns:

| Region | Purpose | Default width |
| --- | --- | ---: |
| Equipment library | Find, filter, expand, compare, and add items | 260 px |
| Canvas workspace | Plan, Split, 3D, staging, comparison sets, and walkthrough entry | Flexible, minimum 520 px |
| Context inspector | Edit the current selection or show page-level tools | 320 px |

The workspace height is bounded by the viewport below the app header and summary cards. The equipment list and inspector body scroll independently. The canvas remains visible and does not move when either side region scrolls.

The existing summary cards remain above the workspace. Room dimensions move out of the left column and become a compact canvas-toolbar action because they describe the canvas rather than the equipment catalog.

### Equipment library

The left region contains, in order:

1. **Equipment library** heading and item count.
2. Search field matching item name and brand.
3. Existing category and brand filters, with rack-specific filters appearing only when relevant.
4. Scrollable equipment cards.

Each equipment card shows its name, optional brand, footprint, placed count, price, expand state, quick-add button, and compare toggle. Expanding a card reveals its existing general and exercise information, but expansion does not push the selected-object inspector down the page.

The quick-add button creates and selects a new placement using the existing placement rules. The library retains its search, filter, expansion, and scroll state after adding or selecting an object.

### Canvas workspace

The center region retains the existing Plan, Split 2D + 3D, and 3D modes. Its top controls are reorganized into two compact rows:

- Primary row: view mode, active layout, Focus canvas, and Enter walkthrough.
- Secondary row: staging size and compare-set controls.

When an equipment instance is selected, a slim status row above the plan names the selection, shows the relevant placement state—saved, warning, or invalid—and exposes Rotate 90°. For other selection types, the row shows the selection name and state without duplicating the full inspector.

Focus canvas hides both side regions and expands the center region. Exiting focus mode restores the previous library and inspector scroll positions.

### Context inspector

The right region is contextual:

- With equipment selected, it shows the equipment placement inspector.
- With an area, outlet, wall extension, ceiling zone, floor zone, flooring piece, or future selectable object selected, it shows that object's existing editor.
- With no selection, it shows page-level Layout and View settings in collapsible sections.

Selecting a different object replaces only the inspector contents. It does not scroll the document, move the canvas, or reset the equipment library.

## Equipment Placement Inspector

The equipment inspector prioritizes controls by frequency.

### Header

- Equipment name and brand.
- Saved, warning, or invalid status with text and icon treatment.
- Close selection control that clears the selection without removing the placement.

### Quick actions

- Rotate 90°.
- Duplicate placement.
- Center in available room space, using existing placement validation.
- Remove from this layout, visually separated as destructive.

Duplicate placement creates a new instance near the source using the same placement-finding behavior as quick-add, selects it, and leaves the original unchanged. Centering is rejected with a plain-language message if the centered footprint is hard-invalid.

### Position and size

- X and Y position, respecting the current feet or inches editor setting.
- Read-only measured footprint.
- Rotation state.
- Exact placement warning when the footprint or clearance conflicts with existing rules.

### Clearance and checks

- Deadspace override.
- Deadspace sides.
- Clearance visibility.
- Ceiling check.
- Power/outlet-distance check.
- Product link when present.

### Advanced placement sections

Existing 3D model calibration, reference detail, facing, local GLB model, and GLB orientation controls move into collapsed sections below the common placement controls. They remain available but no longer precede position and clearance fields.

### Full equipment details

An **Edit equipment details** button opens the full equipment-record editor without navigating away from Layout. The editor uses the same draft, validation, and save logic as Wishlist editing so the two surfaces cannot produce different records.

On desktop, the full editor is a right-side overlay wider than the placement inspector. On narrow screens, it becomes a full-screen dialog. Its content is grouped into collapsible sections:

1. Basics: name, brand, category, status, priority, quantity.
2. Measurements and fit.
3. Price, power, and product link.
4. Rack or attachment details when applicable.
5. Images and 3D model settings.
6. Exercise and body-part tags.
7. Notes and color.

The editor header and footer remain visible while its body scrolls. Cancel and Save are always reachable. Save is disabled when required values are invalid and displays a nearby explanation. Cancel discards unsaved draft changes after confirmation only when the draft differs from the saved record.

Saving updates the equipment record, closes the full editor, preserves the selected placement, refreshes Plan and 3D representations, and returns focus to the **Edit equipment details** button.

## Page-Level Tools

When nothing is selected, the right inspector contains these collapsed-by-default groups:

- **Layout:** switch, create, duplicate, rename, and delete layouts.
- **View settings:** wall color, floor, field of view, eye height, walls, ceiling, clearances, collisions, and labels.
- **Add to plan:** room dimensions, reserved areas, outlets, wall extensions, ceiling zones, floor zones, and flooring.
- **Editor preferences:** feet/inches, grid contrast, and dimension overlays.

The most recently opened group is retained for the session. Selecting an object temporarily replaces these groups; clearing selection restores them and their prior open state.

## Interaction and State Behavior

### Selection

- Clicking a plan object selects it and updates the inspector immediately.
- Clicking empty plan space clears the selection and restores page-level tools.
- Clicking an equipment-library card expands or collapses that card; it does not select an existing placement.
- Adding an item selects the new placement.
- The selected plan object has a visible outline plus a textual status row and inspector heading.

### Persistence

Placement fields continue to save through the existing state and persistence flow after a valid change. The inspector shows a brief **Saved** state after persistence. Hard-invalid edits are rejected and restore the last valid value. Soft clearance conflicts are saved and shown as warnings, matching existing placement behavior.

The UI retains these transient values during the session:

- Equipment-library search and filters.
- Expanded equipment card and card tab.
- Equipment-library scroll position.
- Inspector scroll position per selection type.
- Open page-tool and advanced inspector sections.
- Focus canvas state.

Only durable layout and equipment data are exported. Transient workspace state is not added to the export schema.

### Feedback and errors

- Successful placement changes show a small Saved status without a disruptive toast.
- Hard-invalid placement changes show an inline explanation and preserve the prior valid state.
- Soft conflicts show a warning status and retain the user's change.
- Failed equipment-record saves keep the full editor open, preserve the draft, focus the first invalid field, and show a summary linked to the affected field.
- Removing an instance remains immediate, matching the current behavior; the item remains in the equipment library so it can be re-added.
- Empty search results explain which filters are active and provide a Clear filters action.

## Responsive Behavior

### Wide desktop: 1180 px and above

Use the three-column workspace. The library and inspector are persistent and independently scrollable.

### Compact desktop and tablet: 760–1179 px

The canvas occupies the page width. Equipment library and inspector open as mutually exclusive side drawers. A compact toolbar shows **Equipment** and **Inspector** buttons with selection and placed-count badges. Opening a drawer does not reset the canvas or the other drawer's scroll state.

### Mobile: below 760 px

The canvas remains the primary surface. Equipment opens as a full-height sheet. Selecting an object opens a bottom sheet with a collapsed summary and quick actions; expanding it reveals all placement fields. Full equipment details use a full-screen dialog with sticky Save and Cancel actions.

The page avoids simultaneous document scrolling and drawer scrolling. Touch targets are at least 44 by 44 CSS pixels.

## Accessibility Requirements

- All library, toolbar, inspector, drawer, and dialog controls are keyboard reachable in a logical order.
- Plan objects retain or gain meaningful accessible names such as `Select Functional trainer`.
- Selection, saved, warning, invalid, expanded, and active states are conveyed with text or semantics in addition to color.
- Icon-only buttons have accessible names and visible tooltips on hover or focus.
- Drawers and the full editor manage focus, support Escape to close, restore focus to their trigger, and prevent focus from moving behind a modal surface.
- Inputs have persistent labels and associated error text.
- Status changes use a polite live region; destructive confirmations receive immediate focus.
- The layout supports 200% browser zoom without hiding core actions.
- Reduced-motion preferences disable nonessential drawer and status animations.

## Architecture and Implementation Boundaries

The existing no-framework structure remains in place:

- `layout.js` owns workspace composition, equipment-library rendering, contextual inspectors, and plan markup.
- `events.js` owns selection, drawer, editor, search/filter, quick action, and field events.
- `render.js` continues coordinating renders and expands its existing scroll/focus restoration to the new library and inspector containers.
- `panels.js` exposes reusable equipment-form section renderers so Wishlist and Layout use one form definition.
- `app.js` owns transient workspace defaults and pure helpers for filtering, inspector routing, placement duplication, and centering.
- `index.html` owns the responsive workspace, drawer, dialog, state, and focus styles.

Rendering functions should be split by responsibility rather than adding the entire redesign to `layoutPanel()`. At minimum, implementation should isolate:

- `layoutEquipmentLibrary()`
- `layoutCanvasWorkspace()`
- `layoutContextInspector()`
- `layoutPageTools()`
- `equipmentDetailsEditor()`

Existing selection-specific panel functions remain usable and are reordered or composed inside the contextual inspector.

## Testing Strategy

### Automated behavior tests

Add browser-independent tests for pure state and markup helpers where practical:

- Library search and combined filters.
- Context inspector routing for every selection type.
- Placement duplication and centering success/failure behavior.
- Draft dirty-state detection and cancel behavior.
- Durable versus transient persistence.

### Rendered workflow tests

Exercise these flows in the browser:

1. Open Layout, search for equipment, quick-add it, and confirm it is selected.
2. Select equipment near the top and bottom of the plan and confirm the page does not jump.
3. Change X/Y, rotate, duplicate, edit clearance, and remove a placement.
4. Open full equipment details, edit a record, save, and confirm Plan and 3D update while selection remains.
5. Cancel a dirty equipment draft and confirm the saved record is unchanged.
6. Switch among Plan, Split, 3D, focus mode, layouts, and selection types.
7. Verify library and inspector scroll retention across re-renders.
8. Verify compact drawer and mobile bottom-sheet behavior.
9. Verify keyboard navigation, Escape, focus restoration, live status, and 200% zoom.

### Regression checks

- Existing room, area, outlet, wall extension, ceiling zone, floor zone, flooring, staging, compare, 3D, walkthrough, layout library, import, and export flows remain functional.
- No selected-object action changes the authoritative item dimensions unexpectedly.
- No relevant console errors or framework overlays appear.
- The first viewport contains the canvas and a clear route to equipment and inspector controls at every supported breakpoint.

## Acceptance Criteria

- Selecting any plan object reveals its relevant controls without requiring document scrolling.
- The canvas remains visible while the desktop equipment library or inspector scrolls.
- A user can search, filter, add, select, reposition, rotate, duplicate, adjust clearance, edit equipment details, and remove equipment without leaving Layout.
- Placement changes persist and report saved, warning, or invalid status accurately.
- Full equipment editing always exposes Save and Cancel and shares its form logic with Wishlist.
- Library and inspector scroll positions do not reset during ordinary edits.
- Focus canvas hides and restores side regions without losing their state.
- Desktop, compact, and mobile layouts avoid overlapping controls and scroll traps.
- Keyboard and screen-reader users can identify the current selection and complete the core workflow.
- All existing layout data remains compatible; no export-schema change is required for this redesign.

## Delivery Sequence

1. Extract reusable equipment-form sections and add state/helper tests.
2. Build the three-region desktop workspace and contextual inspector routing.
3. Reorder equipment placement controls and add duplicate/center behavior.
4. Add the in-layout full equipment-details editor.
5. Add compact drawers, mobile bottom sheet, and accessibility behavior.
6. Run regression and rendered workflow verification across desktop and mobile viewports.
