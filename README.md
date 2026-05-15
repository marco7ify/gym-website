# Gym Wishlist + Layout Planner

An offline, dependency-free web application for planning your home gym. Track equipment, costs, and create detailed floor layouts with proper clearances.

## Features

- **Wishlist Management**: Track equipment with dimensions, prices, and decision scores
- **Layout Planner**: Visual 1-ft grid layout with drag-and-drop equipment placement
- **Smart Clearances**: Multi-side deadspace configuration for realistic spacing
- **Room Shapes**: Support for L-shaped and complex room layouts with room blocks
- **Reserved Areas**: Walkways, doors (with swing clearance), no-go zones, and cutouts
- **Fit Realism**: Ceiling height warnings and power outlet distance checks
- **Flooring Calculator**: Estimates tiles or rolls needed based on room area
- **Multiple Layouts**: Save and switch between different layout configurations
- **Offline Storage**: All data stored in browser localStorage
- **Export/Import**: JSON export for backup and sharing

## File Structure

```
gym website/
├── index.html      - Main HTML structure and CSS
├── app.js          - Core utilities, state management, and data models
├── panels.js       - Panel rendering (wishlist, settings, ingest)
├── layout.js       - Layout panel and SVG rendering
├── events.js       - Event handlers and user interactions
└── render.js       - Main render function and coordination
```

## Key Improvements from Original

1. **Modular Architecture**: Split into 5 focused files instead of one 3000+ line file
2. **Reduced Token Usage**: ~70% reduction in file size for AI context
3. **Better Maintainability**: Each file has a clear purpose
4. **Preserved Functionality**: All original features intact
5. **No Dependencies**: Still works completely offline

## Usage

Simply open `index.html` in a modern web browser. No build step or server required.

### Quick Start

1. **Add Equipment**: Use the "Wishlist" tab to add gym equipment with dimensions and prices
2. **Configure Room**: Go to "Settings" to set your room dimensions and preferences
3. **Create Layout**: Switch to "Layout" tab to place equipment on the grid
4. **Adjust Clearances**: Select equipment to customize deadspace per item
5. **Add Areas**: Mark walkways, doors, and no-go zones for realistic planning

### Tips

- Use "Paste / Auto-add" for quick bulk entry from product pages
- Hold Shift when extending/shrinking areas for 5ft steps instead of 1ft
- Drag resize handles on areas and room blocks to adjust size
- Create multiple layouts to compare different arrangements
- Export your data regularly as backup

## Browser Compatibility

Works in all modern browsers:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Data Storage

All data is stored locally in your browser using localStorage. No data is sent to any server.

Storage keys:
- `gym_v4_*` - All application data

## License

This is a personal project tool. Feel free to use and modify for your own gym planning needs.
