# Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Open the Website
1. Navigate to the `gym website` folder
2. Double-click `index.html`
3. Your browser will open the application

**Alternative**: Right-click `index.html` → Open with → Your browser

---

### Step 2: Add Your First Equipment

1. You'll start on the **Wishlist** tab
2. Fill in the "Add item" form:
   - **Item name**: e.g., "Treadmill"
   - **Dimensions**: Length × Width × Height (in inches)
   - **Price**: Equipment cost
   - **Category**: Select or create custom
   - **Status**: "Researching" (default)

3. Click **Add** button

**Tip**: The form shows a live preview of Decision Score and Total Cost

---

### Step 3: Configure Your Room

1. Click the **Settings** tab
2. Enter your room dimensions:
   - **Room length**: e.g., 20 ft
   - **Room width**: e.g., 12 ft
   - **Ceiling height**: e.g., 9 ft
   - **Default deadspace**: e.g., 2.5 ft (clearance around equipment)

3. Click **Save settings**

**Tip**: Default deadspace is the space around equipment for safe movement

---

### Step 4: Create Your Layout

1. Click the **Layout** tab
2. You'll see a grid representing your room
3. Click **Add** next to any equipment in the right sidebar
4. Equipment appears on the grid
5. **Drag** to move it around
6. **Click** to select and see details

**Tip**: Red border means invalid placement (overlapping or out of bounds)

---

### Step 5: Add Walkways and Doors

1. Still in **Layout** tab
2. Click **Walkway** button to add circulation space
3. Click **Door** button to mark entrances
4. **Drag** to position them
5. **Drag handles** (small squares) to resize

**Tip**: Door swing arcs show clearance needed for door to open

---

## 🎯 Common Tasks

### Add Multiple Items Quickly

1. Go to **Paste / Auto-add** tab
2. Paste equipment specs (one per block, separated by blank lines):
   ```
   Rogue Echo Bike
   $895
   53" x 24" x 52"
   https://www.roguefitness.com/...

   Concept2 Rower
   $1,200
   96" x 24" x 14"
   https://www.concept2.com/...
   ```
3. Click **Parse**
4. Review parsed items
5. Click **Add selected**

**Tip**: The parser extracts name, price, dimensions, and links automatically

---

### Rotate Equipment

1. Select equipment in layout (click on it)
2. Click **Rotate** button in the right panel
3. Equipment rotates 90 degrees

**Tip**: Useful for fitting equipment in tight spaces

---

### Adjust Clearance Per Item

1. Select equipment in layout
2. In right panel, find "Deadspace (ft) override"
3. Enter custom clearance (e.g., 1.5 for less space)
4. Toggle which sides need clearance (Left, Right, Top, Bottom)

**Tip**: Some equipment needs less clearance on certain sides (e.g., wall-mounted)

---

### Create Multiple Layouts

1. In **Layout** tab, find layout dropdown (top right)
2. Click **New** to create new layout
3. Give it a name (e.g., "Option A", "Cardio Zone")
4. Switch between layouts using the dropdown
5. Click **Duplicate** to copy current layout

**Tip**: Compare different arrangements without losing work

---

### Calculate Flooring Needed

1. Go to **Settings** tab
2. Scroll to "Flooring planner"
3. Choose mode: **Tiles** or **Rolls**
4. Enter tile/roll dimensions
5. Set waste percentage (typical: 10%)
6. See calculated tiles/boxes or rolls needed

**Tip**: Add cutout areas in layout to exclude non-gym spaces

---

### Export Your Data

1. Click **Export** button (top right, any tab)
2. JSON file downloads automatically
3. Save somewhere safe (backup)

**Tip**: Export regularly! Data is stored in browser only

---

### Import Previous Data

1. Click **Import** button (top right, any tab)
2. Select your exported JSON file
3. All data loads instantly

**Tip**: Use this to transfer between computers or restore backups

---

## 💡 Pro Tips

### Planning Your Gym

1. **Start with must-haves**: Add essential equipment first
2. **Mark walkways early**: Ensure 3-4 ft aisles for movement
3. **Consider power**: Place powered equipment near outlets
4. **Check ceiling height**: Especially for pull-up bars and overhead presses
5. **Leave expansion room**: Don't fill 100% of space immediately

### Using the Layout

1. **Snap to grid**: Enable in Settings for aligned placement
2. **Use room blocks**: Create L-shaped or complex room layouts
3. **Add no-go zones**: Mark areas with utilities, HVAC, etc.
4. **Door clearance**: Ensure doors can fully open
5. **Test traffic flow**: Walk through layout mentally

### Decision Making

1. **Use decision scores**: Rate fit, quality, and value (1-10)
2. **Track status**: Move items through research → buy → install
3. **Set priorities**: Must-have vs nice-to-have
4. **Compare totals**: Watch "Ready to Buy" total vs budget
5. **Check max fit**: See how many of each item could fit

### Avoiding Issues

1. **Export regularly**: Backup your data weekly
2. **Test placements**: Drag equipment around to find best spots
3. **Verify dimensions**: Double-check manufacturer specs
4. **Consider clearance**: 2-3 ft between machines is standard
5. **Plan for growth**: Leave space for future additions

---

## 🆘 Need Help?

### Something Not Working?
1. Press **F12** to open browser console
2. Check for error messages
3. Read **TROUBLESHOOTING.md** for solutions

### Want to Learn More?
1. **README.md** - Full feature list and usage
2. **ARCHITECTURE.md** - How it works technically
3. **CHANGES.md** - What's new and improved

### Common Questions

**Q: Can I use this on my phone?**
A: Works best on desktop/tablet. Phone screens are too small for layout grid.

**Q: Is my data safe?**
A: Yes! Everything stays in your browser. No data sent anywhere.

**Q: Can I share my layout?**
A: Export to JSON and share the file. Others can import it.

**Q: Can I print my layout?**
A: Use browser's print function or take a screenshot. PDF export coming soon.

**Q: Does this work offline?**
A: Yes! Once loaded, works completely offline.

---

## 🎨 Customization

### Adding Custom Categories

1. In item form, type new category name
2. Click **Add** button next to category field
3. New category appears in dropdown

### Changing Currency

1. Go to **Settings** tab
2. Change "Currency (ISO code)" field
3. Enter code (USD, EUR, GBP, etc.)
4. Click **Save settings**

### Adjusting Grid Snap

1. Go to **Settings** tab
2. Change "Snap increment (ft)" field
3. Set to 0 for no snap, or 0.25/0.5/1.0 for different increments
4. Click **Save settings**

---

## 📊 Understanding the Dashboard

### KPI Cards (Top of Wishlist)

1. **Ready-to-buy total**: Sum of items marked "Ready to Buy"
2. **Planned total**: All items regardless of status
3. **Room**: Your room dimensions and area
4. **Reserved**: Space taken by walkways, doors, etc.
5. **Area estimate**: Rough calculation of equipment space used

### Decision Score

- **Formula**: 40% Fit + 30% Quality + 30% Value
- **Fit**: How well it meets your needs (1-10)
- **Quality**: Build quality and durability (1-10)
- **Value**: Price vs features/quality (1-10)
- **Result**: Weighted average to help prioritize

### Status Workflow

1. **Researching**: Just discovered, learning about it
2. **Shortlist**: Narrowed down, comparing options
3. **Ready to Buy**: Decided, waiting for budget/timing
4. **Ordered**: Purchase made, awaiting delivery
5. **Delivered**: Received, ready to install
6. **Installed**: Set up and in use
7. **Returned/Cancelled**: Didn't work out

---

## 🏁 You're Ready!

You now know enough to:
- ✅ Add equipment to your wishlist
- ✅ Configure your room dimensions
- ✅ Create and arrange a layout
- ✅ Add walkways and doors
- ✅ Calculate flooring needs
- ✅ Export and backup your data

**Start planning your dream gym!** 💪

---

**Pro Tip**: Bookmark this page in your browser for quick reference.
