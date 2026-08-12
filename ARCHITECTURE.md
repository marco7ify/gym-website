# Architecture Overview

## File Dependencies

```
index.html
    │
    ├─→ layout-editor-core.js (Pure layout-editor helpers)
    │   ├─ Search and filter rules
    │   ├─ Selection routing
    │   ├─ Placement cloning and centering
    │   ├─ Draft comparison
    │   └─ Responsive drawer state
    │
    ├─→ app.js (Core)
    │   ├─ Utilities ($, $$, uid, safeNum, etc.)
    │   ├─ Constants (CATEGORIES, STATUSES, etc.)
    │   ├─ State Management (state object)
    │   ├─ Storage (loadJSON, saveJSON, persist)
    │   ├─ Calculations (room, footprint, etc.)
    │   └─ Geometry (rectsOverlap, pointInRoom, etc.)
    │
    ├─→ panels.js (UI Rendering)
    │   ├─ wishlistPanel()
    │   ├─ readyPanel()
    │   ├─ settingsPanel()
    │   ├─ ingestPanel()
    │   ├─ itemForm()
    │   └─ groupTable()
    │
    ├─→ layout.js (Layout Rendering)
    │   ├─ layoutPanel()
    │   ├─ selectedEquipmentPanel()
    │   ├─ selectedAreaPanel()
    │   ├─ selectedOutletPanel()
    │   ├─ selectedRoomBlockPanel()
    │   ├─ addInstance()
    │   └─ addArea()
    │
    ├─→ events.js (Event Handling)
    │   ├─ wireTop() - Export/Import
    │   ├─ wireTab() - Tab switching
    │   ├─ wireMain() - All interactions
    │   │   ├─ Click handlers
    │   │   ├─ Input handlers
    │   │   └─ SVG pointer events
    │   └─ readDraftFromForm()
    │
    └─→ render.js (Render Coordination)
        ├─ render() - Main render function
        ├─ captureFocus() - Focus preservation
        ├─ restoreFocus() - Focus restoration
        └─ DOMContentLoaded - App initialization
```

## Data Flow

```
User Action
    ↓
Event Handler (events.js)
    ↓
State Update (app.js)
    ↓
Persist to localStorage (app.js)
    ↓
Render Function (render.js)
    ↓
Panel Rendering (panels.js / layout.js)
    ↓
DOM Update
    ↓
User Sees Change
```

## Module Responsibilities

### index.html
**Purpose**: Structure and Presentation
- HTML skeleton
- CSS styling
- Script loading order

**Exports**: None (entry point)

**Imports**: All JS modules

---

### app.js
**Purpose**: Core Logic and State
- Utility functions
- Constants and defaults
- State management
- Storage operations
- Mathematical calculations
- Geometry helpers

**Exports**:
- `$`, `$$` - DOM selectors
- `uid` - Unique ID generator
- `safeNum`, `clamp`, `round1` - Math utilities
- `state` - Global state object
- `room()` - Room calculations
- `footprint()` - Equipment dimensions
- `persist()` - Save to localStorage
- All geometry functions

**Imports**: None (foundation)

---

### panels.js
**Purpose**: UI Panel Rendering
- Wishlist panel
- Settings panel
- Ingest/parse panel
- Ready-to-buy panel
- Form rendering
- Table rendering

**Exports**:
- `wishlistPanel()`
- `readyPanel()`
- `settingsPanel()`
- `ingestPanel()`
- `itemForm()`
- `groupTable()`
- `ingestRow()`
- `tipsPanel()`

**Imports**: app.js (utilities, state)

---

### layout.js
**Purpose**: Layout Panel and SVG
- Canvas-first three-region workspace rendering
- Independently scrolling equipment library and contextual inspector
- In-layout equipment-details sheet using the shared `itemForm()`
- SVG grid generation
- Equipment visualization
- Area rendering
- Selection panels
- Instance management

**Exports**:
- `layoutPanel()`
- `selectedEquipmentPanel()`
- `selectedAreaPanel()`
- `selectedOutletPanel()`
- `selectedRoomBlockPanel()`
- `addInstance()`
- `addArea()`

**Imports**: 
- app.js (utilities, state, geometry)
- panels.js (field, tipsPanel)
- layout-editor-core.js (pure workspace behavior)

---

### events.js
**Purpose**: User Interactions
- Click event handlers
- Input change handlers
- Drag and drop logic
- SVG pointer events
- Form submissions
- Data validation

**Exports**:
- `wireTop()` - Top-level events
- `wireTab()` - Tab switching
- `wireMain()` - Main interactions
- `readDraftFromForm()` - Form data

**Imports**:
- app.js (state, utilities, geometry)
- layout.js (addInstance, addArea)

---

### render.js
**Purpose**: Render Coordination
- Main render function
- Focus management
- Scroll preservation
- Panel selection
- App initialization

**Exports**:
- `render()` - Main render
- `captureFocus()` - Save focus state
- `restoreFocus()` - Restore focus
- `tabBtn()` - Tab button
- `kpiCard()` - KPI card
- `mainPanel()` - Panel router
- `field()` - Form field
- `countPlaced()` - Instance counter

**Imports**:
- app.js (state, utilities)
- panels.js (all panel functions)
- layout.js (layoutPanel)
- events.js (all wire functions)

## State Management

```javascript
state = {
  // UI State
  tab: "wishlist" | "ready" | "layout" | "ingest" | "settings",
  editingId: string | null,
  draft: ItemObject,
  layoutWorkspace: {
    // Transient UI state only; never persisted or exported.
    search: string,
    libraryDrawerOpen: boolean,
    inspectorDrawerOpen: boolean,
    detailsEditorOpen: boolean,
    detailsEditorItemId: string | null,
    detailsEditorBaseline: ItemObject | null,
    discardEditorConfirmOpen: boolean,
    openPageTool: string,
    status: {kind, message} | null,
  },
  
  // Data
  settings: SettingsObject,
  categories: string[],
  items: ItemObject[],
  
  // Layouts
  layouts: LayoutObject[],
  activeLayoutId: string,
  layout: {
    instances: InstanceObject[],
    areas: AreaObject[],
    outlets: OutletObject[],
    roomBlocks: RoomBlockObject[],
    selectedInstId: string | null,
    selectedAreaId: string | null,
    selectedOutletId: string | null,
    selectedRoomBlockId: string | null,
  },
  
  // Ingest
  ingestText: string,
  ingestParsed: ParsedObject[],
  ingestErr: string,
  
  // Drag State
  drag: {
    active: boolean,
    type: string | null,
    id: string | null,
    start: {x, y},
    origin: {x, y},
    invalid: boolean,
  },
  
  // Cache
  _roomCache: { key: string, area: number } | null,
}
```

## Event Flow Examples

### Adding Equipment
```
User clicks "Add" button
    ↓
events.js: saveItemBtn click handler
    ↓
events.js: readDraftFromForm()
    ↓
app.js: state.items.push(newItem)
    ↓
app.js: persist()
    ↓
render.js: render()
    ↓
panels.js: wishlistPanel()
    ↓
DOM updated with new item
```

### Dragging Equipment
```
User mousedown on equipment
    ↓
events.js: svg.onpointerdown
    ↓
app.js: state.drag = {active:true, ...}
    ↓
render.js: render()
    ↓
User mousemove
    ↓
events.js: svg.onpointermove
    ↓
app.js: state.layout.instances[i].xFt += dx
    ↓
render.js: render()
    ↓
layout.js: layoutPanel() with updated position
    ↓
User mouseup
    ↓
events.js: svg.onpointerup
    ↓
app.js: validate placement, snap back if invalid
    ↓
app.js: persist()
    ↓
render.js: render()
```

### Switching Layouts
```
User selects different layout
    ↓
events.js: layout_select change handler
    ↓
app.js: state.setActiveLayout(id)
    ↓
app.js: save current layout to library
    ↓
app.js: load selected layout from library
    ↓
app.js: persist()
    ↓
render.js: render()
    ↓
layout.js: layoutPanel() with new layout
```

## Render Cycle

```
render() called
    ↓
1. Capture current focus (input field, cursor position)
    ↓
2. Capture current scroll position
    ↓
3. Compute derived data (rows, groups, room)
    ↓
4. Build HTML string
    │   ├─ KPI cards
    │   ├─ Active panel (wishlist/layout/settings/etc)
    │   └─ Footer
    ↓
5. Set app.innerHTML (DOM update)
    ↓
6. Wire event handlers
    │   ├─ wireTop() - Export/Import
    │   ├─ wireTab() - Tab switching
    │   └─ wireMain() - All interactions
    ↓
7. Restore scroll position (requestAnimationFrame)
    ↓
8. Restore focus (requestAnimationFrame)
```

## Performance Considerations

### Render Optimization
- **Focus Preservation**: Prevents input field blur on re-render
- **Scroll Preservation**: Maintains scroll position
- **Selective Rendering**: Only active panel rendered
- **Event Delegation**: Single listener for multiple elements

### Calculation Caching
- **Room Area**: Cached with invalidation on room changes
- **Computed Rows**: Recalculated only on data changes
- **Geometry**: Pure functions with no side effects

### Storage Efficiency
- **Debounced Saves**: Only on actual changes
- **Normalized Data**: No redundancy
- **Compressed Format**: Minimal JSON structure

## Security Considerations

### Data Safety
- **localStorage Only**: No network requests
- **No Eval**: No dynamic code execution
- **Sanitized HTML**: All user input escaped
- **Type Safety**: Input validation throughout

### Privacy
- **Offline First**: No data leaves browser
- **No Tracking**: No analytics or telemetry
- **No Cookies**: Pure localStorage
- **Export Control**: User controls all data

## Testing Strategy

### Manual Testing
1. Add/edit/delete equipment
2. Create/modify layouts
3. Drag and drop operations
4. Export/import data
5. Switch between layouts
6. Configure settings

### Browser Testing
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

### Edge Cases
- Empty state (no items)
- Large datasets (50+ items)
- Complex room shapes
- Invalid placements
- Storage quota exceeded

## Deployment

### Requirements
- Modern web browser
- JavaScript enabled
- localStorage available
- ~2MB storage space

### Installation
1. Copy all 6 files to a folder
2. Open index.html in browser
3. Start using immediately

### Updates
- Replace individual files
- Data format compatible
- No migration needed
