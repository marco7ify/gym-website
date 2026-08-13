# Layout Selection, Focus Mode, and Placed Equipment Filter

**Date:** 2026-08-12

## Goal

Make layout editing predictable: selecting and clearing equipment must not leave a dark overlay, Focus Canvas must expand the canvas to the full workspace width, and the equipment library must optionally show only items placed in the active layout.

## Root causes

1. Selecting an object always opens the compact inspector drawer. Clearing the selection does not close that drawer, so the drawer backdrop remains visible at compact breakpoints.
2. Focus Canvas hides both sidebars, but a later three-column workspace rule overrides the one-column focus rule. The canvas is therefore constrained to the former left-column width.

## Interaction design

### Selection and compact drawers

- Selecting an object continues to reveal its inspector.
- Clearing a selection also closes the compact inspector drawer and removes its backdrop.
- Clicking the backdrop closes open drawers without changing saved layout data.
- Entering Focus Canvas closes both compact drawers before rendering focus mode.
- Drawer and overlay state remains transient UI state and is never saved into a layout.

### Focus Canvas

- Focus Canvas hides both sidebars and expands the canvas to the full available workspace width.
- The control changes to **Show panels** while focus mode is active.
- Exiting focus mode restores the normal three-column desktop layout or normal compact layout.
- Existing selection is preserved so the user can return to the inspector after leaving focus mode.

### Equipment library scope

- Add a two-option scope control above the existing search and filters:
  - **All equipment**
  - **In this layout**
- **All equipment** remains the default.
- **In this layout** shows each equipment item referenced by at least one instance in the active layout. Existing placed-count badges communicate quantity.
- Search, category, brand, and rack filters apply after the scope filter.
- If no placed equipment matches, the empty state explains whether the layout is empty or the current filters exclude placed items.
- The scope is transient workspace state. Switching layouts recomputes results from the active layout without changing either layout.

## Implementation boundaries

- Extend `layout-editor-core.js` with a pure placed-item scope helper and transient scope default.
- Update `layout.js` to render the scope control and use the placed item IDs from the active layout.
- Update `events.js` so clear-selection and focus-mode actions close compact drawers, and so the scope control updates transient state.
- Add late, higher-specificity focus-mode CSS in `index.html` so it wins over the standard workspace grid.
- Do not change persisted item records, layout instances, 3D rendering, placement validation, or saved layout schemas.

## Testing

- Unit tests cover unique placed-item filtering, empty layouts, and the default workspace scope.
- Browser tests verify:
  - select equipment, clear selection, and confirm the backdrop disappears;
  - Focus Canvas expands rather than shrinks the canvas and Show panels restores it;
  - In this layout removes unplaced items while keeping placed items and placed counts;
  - search still works within the placed-only scope;
  - no relevant browser errors or warnings appear.
- Existing planner, 3D equipment, garage-door, wall-feature, runtime-cache, and syntax checks must remain green.

## Success criteria

- No dark overlay remains after clearing a selection.
- Focus Canvas uses the full workspace width.
- The equipment library can switch between all available equipment and only equipment placed in the active layout.
- No saved equipment or layout data is deleted or rewritten by these controls.
