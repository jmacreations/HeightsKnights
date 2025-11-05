## Simplified Local Multiplayer Implementation

### Overview
Remove the confusing PLAY_MODE and CONTROLLER_SETUP screens. Instead, ask for input type immediately when joining a room, allow players to enter their names, then allow adding additional local players from the lobby with their own names.

### Implementation Checklist

#### Phase 1: Input Type Selection on Join
- [ ] Create new "Input Selection" screen/modal after clicking "Join Room"
  - Shows prompt: "Choose your input: Press ENTER for keyboard or START on your controller"
  - Listens for keyboard Enter key OR any gamepad button press
  - Automatically detects and sets primary player input type
  - After input detected, shows name input field for primary player
  - Pre-fills with the name from welcome screen (editable)
  - Proceeds to lobby after name confirmed

#### Phase 2: Remove Old Screens
- [ ] Delete/disable PLAY_MODE screen and related code
  - Remove `playModeScene.js` or mark as deprecated
  - Remove references in `uiManager.js`
- [ ] Delete/disable CONTROLLER_SETUP screen
  - Remove `controllerSetupScene.js` or mark as deprecated
  - Clean up related imports and event listeners

#### Phase 3: Update Join Flow
- [ ] Modify "Join Room" button handler in `uiManager.js`
  - After validation, show Input Selection instead of PLAY_MODE
  - Show input type selection prompt
  - After input detected, show name input field
  - Once name confirmed, register primary player with server
  - Navigate directly to LOBBY screen
- [ ] Ensure `localPlayerManager` properly initializes with detected input type and custom name

#### Phase 4: Add Local Players in Lobby
- [ ] Add "+ Add Local Player" button to LOBBY screen
  - Only visible on client-side (not synced to other clients)
  - Positioned below the player list
  - Shows when less than 4 total local players registered
- [ ] Implement inline add player flow in lobby
  - Step 1: Shows prompt: "Press ENTER (keyboard) or START (controller) to join"
  - Step 2: After input detected, shows inline name input field
  - Step 3: Player enters name and presses ENTER/START to confirm
  - Supports mixed inputs (keyboard + multiple controllers)
  - Adds player with custom name to `localPlayerManager` and syncs to server

#### Phase 5: Lobby UI Updates
- [ ] Update player list display to show local players
  - Add visual indicator: 🎮 for controller, ⌨️ for keyboard
  - Show all local players with their custom names
  - Group local players together visually
- [ ] Add ability to edit local player names in lobby (optional)
  - Click on player name to edit inline
  - Only available for local players, not remote ones
- [ ] Add ability to remove local players from lobby
  - Small "×" button next to each local player
  - Only shown for local players, not remote ones

#### Phase 6: Update Create Flow
- [ ] Modify "Create Room" button handler
  - Skip PLAY_MODE screen entirely
  - Go: MENU → MODE_SELECT → MATCH_SETTINGS → Input Selection → LOBBY
  - Same input detection and name entry as join flow

#### Phase 7: Name Input UI Component
- [ ] Create reusable name input component/function
  - Used for both primary player and additional local players
  - Shows input field with label: "Enter your name"
  - Validation: Required, max 12 characters
  - Submit on ENTER key or confirm button
  - Focus input automatically when shown
  - ESC key to cancel (for additional players, not primary)

#### Phase 8: Testing
- [ ] Test join flow with keyboard input and custom name
- [ ] Test join flow with controller input and custom name
- [ ] Test adding additional local players with custom names in lobby
- [ ] Test mixed input types (keyboard + controller)
- [ ] Test maximum player limit (4 players)
- [ ] Test removing local players from lobby
- [ ] Test editing local player names in lobby
- [ ] Test name validation (empty, too long)
- [ ] Verify all game modes work with local multiplayer
- [ ] Test that names persist through game sessions

### Technical Notes
- Maximum 4 local players per client
- Input detection should use existing `gamepadManager` and keyboard event listeners
- Local player registration uses `registerLocalPlayersWithServer()` from `network.js`
- Player IDs format: `socketId-localIndex` (e.g., "abc123-0", "abc123-1")
- Player names stored in `localPlayerManager` and synced with server
- Name validation: 1-12 characters, trimmed whitespace

### Questions Resolved
1. **Max players**: 4 players total per client
2. **Remove players**: Yes, add small "×" button for local players only
3. **Player names**: Custom names entered by each player during join/add flow
4. **Edit names**: Yes, allow inline editing of local player names in lobby
