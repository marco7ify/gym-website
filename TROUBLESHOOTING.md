# Troubleshooting Guide

## Common Issues and Solutions

### Website Won't Load

**Symptoms**: Blank page or "Loading..." message that never completes

**Solutions**:
1. **Check Console**: Press F12 to open developer tools and check for errors
2. **File Paths**: Ensure all 6 files are in the same folder
3. **Browser Cache**: Hard refresh with Ctrl+F5 (Cmd+Shift+R on Mac)
4. **File Permissions**: Make sure files aren't read-only
5. **Local File Access**: Some browsers block local file access - try a different browser

### JavaScript Errors

**Symptoms**: Console shows errors like "X is not defined"

**Solutions**:
1. **Script Order**: Verify scripts load in correct order in index.html:
   ```html
   <script src="app.js"></script>
   <script src="panels.js"></script>
   <script src="layout.js"></script>
   <script src="events.js"></script>
   <script src="render.js"></script>
   ```
2. **File Encoding**: Ensure all files are UTF-8 encoded
3. **Complete Files**: Check that no files are truncated or corrupted

### Data Not Saving

**Symptoms**: Changes disappear after refresh

**Solutions**:
1. **localStorage Enabled**: Check browser settings allow localStorage
2. **Private/Incognito**: localStorage doesn't persist in private browsing
3. **Storage Quota**: Clear old data if near browser storage limits
4. **Browser Extensions**: Disable extensions that block storage

### Layout Not Rendering

**Symptoms**: SVG grid is blank or equipment doesn't show

**Solutions**:
1. **Add Equipment First**: Go to Wishlist tab and add at least one item
2. **Room Dimensions**: Check Settings tab has valid room dimensions
3. **SVG Support**: Ensure browser supports SVG (all modern browsers do)
4. **Console Errors**: Check F12 console for rendering errors

### Drag and Drop Not Working

**Symptoms**: Can't move equipment or areas

**Solutions**:
1. **Select First**: Click an item to select it before dragging
2. **Valid Placement**: Red border means invalid placement - try different position
3. **Pointer Events**: Check browser supports pointer events
4. **Touch Devices**: Use mouse on touch devices (touch support limited)

### Export/Import Issues

**Symptoms**: Export creates empty file or import fails

**Solutions**:
1. **File Extension**: Ensure exported file has .json extension
2. **File Size**: Check exported file isn't empty (should be >100 bytes)
3. **JSON Format**: Open exported file in text editor to verify it's valid JSON
4. **Browser Permissions**: Allow file download/upload in browser settings

### Performance Issues

**Symptoms**: Slow rendering or laggy drag operations

**Solutions**:
1. **Too Many Items**: Limit to <50 equipment instances per layout
2. **Complex Shapes**: Simplify room blocks if using many
3. **Browser Resources**: Close other tabs/applications
4. **Hardware Acceleration**: Enable in browser settings
5. **Older Browser**: Update to latest browser version

### Visual Glitches

**Symptoms**: Overlapping text, misaligned elements

**Solutions**:
1. **Zoom Level**: Reset browser zoom to 100% (Ctrl+0)
2. **Window Size**: Resize browser window to trigger re-layout
3. **CSS Loading**: Hard refresh to reload styles
4. **Font Loading**: Wait for system fonts to load

## Browser-Specific Issues

### Chrome/Edge
- **Issue**: CORS errors with file:// protocol
- **Solution**: Use a local server or open via HTTP

### Firefox
- **Issue**: localStorage quota warnings
- **Solution**: Increase storage limit in about:config

### Safari
- **Issue**: Pointer events not working
- **Solution**: Update to Safari 14+ or use Chrome

## Data Recovery

### Lost Data After Browser Update
1. Check browser's localStorage in DevTools (F12 → Application → Local Storage)
2. Look for keys starting with `gym_v4_`
3. Export data immediately if found
4. Consider regular backups via Export feature

### Corrupted Data
1. Open DevTools (F12)
2. Go to Application → Local Storage
3. Delete keys starting with `gym_v4_`
4. Refresh page to start fresh
5. Import from backup if available

## Debug Mode

To enable detailed logging:

1. Open browser console (F12)
2. Type: `localStorage.setItem('gym_debug', 'true')`
3. Refresh page
4. Check console for detailed logs

To disable:
```javascript
localStorage.removeItem('gym_debug')
```

## Getting Help

If issues persist:

1. **Check Console**: F12 → Console tab for errors
2. **Export Data**: Save your data before troubleshooting
3. **Browser Info**: Note browser name and version
4. **Steps to Reproduce**: Document exact steps that cause the issue
5. **Screenshots**: Capture error messages or visual issues

## Known Limitations

1. **Touch Devices**: Limited touch support (use mouse recommended)
2. **Print Layout**: No built-in print stylesheet (use Export instead)
3. **Undo/Redo**: No undo functionality (use multiple layouts)
4. **Collaboration**: Single-user only (no real-time sharing)
5. **Mobile**: Best on desktop/tablet (phone screens too small)

## File Integrity Check

To verify all files are present and correct:

```
gym website/
├── index.html      (~8.5 KB)
├── app.js          (~29 KB)
├── panels.js       (~22 KB)
├── layout.js       (~21 KB)
├── events.js       (~40 KB)
└── render.js       (~9 KB)
```

Total: ~130 KB

If any file is significantly different in size, it may be corrupted.

## Reset to Defaults

To completely reset the application:

1. Open DevTools (F12)
2. Go to Application → Local Storage
3. Delete all keys starting with `gym_v4_`
4. Refresh page

**Warning**: This deletes all your data. Export first!

## Contact

This is an open-source personal project. For issues:
1. Check this troubleshooting guide
2. Review the README.md for usage tips
3. Inspect browser console for specific errors
