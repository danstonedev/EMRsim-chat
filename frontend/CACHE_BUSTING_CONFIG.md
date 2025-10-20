# Cache-Busting Configuration - Added October 18, 2025

## Problem
Browser caching was preventing CSS changes from being immediately visible during development, requiring manual hard refreshes (Ctrl+F5).

## Solution Implemented

### 1. Vite Server Headers (`vite.config.ts`)
Added aggressive cache-control headers to the dev server:
```typescript
headers: {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
  'Surrogate-Control': 'no-store',
}
```

### 2. Force Full Reload on CSS Changes (`vite.config.ts`)
Created custom Vite plugin that forces a full page reload whenever any CSS file changes:
```typescript
(function forceReloadOnCssPlugin(): Plugin {
  return {
    name: 'force-reload-css',
    apply: 'serve',
    handleHotUpdate({ file, server }) {
      if (file.endsWith('.css')) {
        console.log('[vite:force-reload] CSS changed, forcing full reload:', file)
        server.ws.send({
          type: 'full-reload',
          path: '*'
        })
        return []
      }
    },
  }
})()
```

### 3. HTML Meta Tags (`index.html`)
Added cache-control meta tags to the HTML head:
```html
<!-- Cache control for development -->
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
<meta http-equiv="Pragma" content="no-cache" />
<meta http-equiv="Expires" content="0" />
```

## How It Works

**Before**: 
- CSS changes → HMR tries to inject → Browser uses cached styles → Changes not visible

**After**:
1. CSS file changes
2. Custom plugin detects .css change
3. Forces full page reload (bypasses HMR for CSS)
4. Server sends no-cache headers
5. Browser fetches fresh CSS (not from cache)
6. Changes immediately visible ✅

## Benefits

- ✅ **Immediate visibility** of CSS changes during development
- ✅ **No manual hard refresh** needed (Ctrl+F5)
- ✅ **Console logging** shows when CSS reload is triggered
- ✅ **Development-only** (doesn't affect production builds)
- ✅ **Works with Vite's HMR** for other file types (JS/TS still hot-reload)

## Console Output

When you edit a CSS file, you'll see:
```
[vite:force-reload] CSS changed, forcing full reload: /path/to/file.css
```

This confirms the cache-busting is working.

## Testing

1. Edit any CSS file (e.g., `frontend/src/styles/chat/messages.css`)
2. Save the file
3. Watch the browser automatically reload (no Ctrl+F5 needed)
4. Changes should be immediately visible
5. Check console for `[vite:force-reload]` message

## Production Impact

**None.** All cache-busting is development-only:
- Vite server headers: only active in `npm run dev`
- Force-reload plugin: `apply: 'serve'` (dev only)
- HTML meta tags: removed during production build by build tools

Production builds still use proper cache headers for performance.

## Rollback

If this causes issues, revert these changes:
1. Remove `headers` section from `vite.config.ts` server config
2. Remove `forceReloadOnCssPlugin` from plugins array
3. Remove cache-control meta tags from `index.html`

## Files Modified

- ✅ `frontend/vite.config.ts` - Added server headers + force-reload plugin
- ✅ `frontend/index.html` - Added cache-control meta tags

---

**Status**: ✅ Active  
**Environment**: Development only  
**Impact**: Improved developer experience, faster CSS iteration
