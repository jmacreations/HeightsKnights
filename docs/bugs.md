# Bugs & Cleanup

## Unused Files (Can Be Deleted)

### Old Menu System Files
1. **`public/js/scenes/playModeScene.js`** - Entire file unused
   - Replaced by INPUT_SELECTION screen
   - Only referenced by controllerSetupScene.js (also unused)
   - Functions: `initPlayModeScene()`, `getPlayModeContext()`

2. **`public/js/scenes/controllerSetupScene.js`** - Entire file unused
   - Replaced by INPUT_SELECTION screen and setupAddLocalPlayerUI()
   - Functions: `initControllerSetupScene()`, `cleanupControllerSetupScene()`
   - References unused `window.pendingRoomCode`

## Unused Global Variables

### In `public/js/main.js`
1. **`window.urlRoomCode`** - Set but only used once in main.js
   - Could be scoped locally instead of global
   - Currently: `window.urlRoomCode = getURLRoomCode()` then copied to `window.joiningRoomCode`
   - Recommendation: Remove global, use local variable

### Variables Still Used (Keep)
- `window.playerName` - Used in uiManager, matchSettingsScene for display
- `window.joiningRoomCode` - Used in INPUT_SELECTION flow
- `window.pendingRoomSettings` - Used in create room flow

## Cleanup Recommendations

### High Priority
1. **Delete**: `public/js/scenes/playModeScene.js`
2. **Delete**: `public/js/scenes/controllerSetupScene.js`
3. **Refactor**: Remove `window.urlRoomCode` global, use local variable in main.js

### Low Priority
- No other unused code detected in current flow
- All new INPUT_SELECTION and lobby player management code is actively used