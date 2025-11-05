# Bugs & Cleanup

## Cleanup Completed ✅

### Deleted Files
1. ✅ **`public/js/scenes/playModeScene.js`** - DELETED
   - Replaced by INPUT_SELECTION screen
   - Functions: `initPlayModeScene()`, `getPlayModeContext()`

2. ✅ **`public/js/scenes/controllerSetupScene.js`** - DELETED
   - Replaced by INPUT_SELECTION screen and setupAddLocalPlayerUI()
   - Functions: `initControllerSetupScene()`, `cleanupControllerSetupScene()`

### Refactored Code
1. ✅ **`window.urlRoomCode`** - REFACTORED
   - Changed from global variable to local variable in main.js
   - URL parsing now done inline in main() function
   - Room code directly assigned to `window.joiningRoomCode` when needed

## Summary
All unused code from the old menu flow has been cleaned up. The new INPUT_SELECTION flow is now the only implementation for player setup and input detection.