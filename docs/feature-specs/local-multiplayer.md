# Local Multiplayer Feature Specification

This document outlines the implementation plan for adding local multiplayer support to Heights Knights, allowing multiple players on the same device (keyboard+mouse + controllers) to play together in online matches.

## Implementation Phases Checklist

### Phase 1: Foundation - Input System & Player Management
**Goal:** Enable multiple input sources (keyboard+mouse + multiple controllers) to be tracked independently

- [x] 1.1 Modify `gamepadManager.js` to support polling multiple controllers independently
  - [x] Add `pollController(index)` method to get input from specific controller
  - [x] Add `getAllConnectedControllers()` to return array of connected gamepads
  - [x] Track controller indices and maintain separate button states per controller
  - [x] Update gamepad connection/disconnection handlers to track all controllers

- [x] 1.2 Create input aggregation system
  - [x] Create `inputManager.js` to handle all input sources (keyboard, mouse, gamepads)
  - [x] Add method to get keyboard+mouse input as a unified input object
  - [x] Add method to assign specific controllers to specific local players
  - [x] Implement input source priority (keyboard overrides for P1, gamepad for others)

- [x] 1.3 Create local player management system
  - [x] Create `localPlayerManager.js` to track multiple local players
  - [x] Define local player data structure (playerId, inputMethod, controllerIndex, name, color)
  - [x] Add methods to add/remove local players
  - [x] Add method to get input for each local player
  - [x] Implement player limit (e.g., max 4 local players)

- [ ] 1.4 Testing Phase 1
  - [ ] Verify multiple controllers can be detected simultaneously
  - [ ] Test keyboard+mouse input collection
  - [ ] Test controller input collection for multiple controllers
  - [ ] Verify no input conflicts between sources

### Phase 2: Menu System & Player Setup
**Goal:** Create UI flow for setting up local multiplayer sessions

- [x] 2.1 Create Play Mode Selection Scene
  - [x] Create `playModeScene.js` for mode selection UI
  - [x] Add "Online Only" option (current behavior)
  - [x] Add "Local Multiplayer" option (keyboard+mouse + controllers)
  - [x] Add navigation and styling
  - [x] Integrate with main menu flow

- [x] 2.2 Create Controller Assignment Scene
  - [x] Create `controllerSetupScene.js` for assigning controllers to players
  - [x] Display available input methods (keyboard, controller 1, controller 2, etc.)
  - [x] Allow players to "claim" input methods by pressing button/key
  - [x] Show player slots (P1, P2, P3, P4) with assigned inputs
  - [x] Add player name/color customization per local player
  - [x] Add "Continue" button (requires at least 1 player)
  - [x] Add "Back" button to return to mode selection

- [x] 2.3 Modify Lobby Scene
  - [x] Update `lobbyScene.js` to display local players separately
  - [x] Show "LOCAL PLAYERS" section with controller icons
  - [x] Show "ONLINE PLAYERS" section
  - [x] Display player count correctly (local + online)
  - [x] Update ready/start logic to account for local players
  - [x] Add visual distinction for local vs remote players

- [x] 2.4 Update Main Menu Flow
  - [x] Modify `main.js` to include new scene transitions
  - [x] Route "Create Room" → Play Mode Selection → Controller Setup → Lobby
  - [x] Route "Join Room" → Play Mode Selection → Controller Setup → Join + Lobby
  - [x] Maintain backward compatibility for quick join (skip to online only)

- [x] 2.5 Testing Phase 2
  - [x] Test navigation through all menu screens
  - [x] Test controller assignment with 1-4 players
  - [x] Test with keyboard+mouse + controllers
  - [x] Verify lobby displays all players correctly

### Phase 3: Network Protocol & Server Updates
**Goal:** Enable server to handle multiple players from a single socket connection

- [x] 3.1 Update Client-Server Protocol
  - [x] Modify `network.js` to send `playerInputs` array instead of single `playerInput`
  - [x] Update input packet format: `{ playerId, socketId, localIndex, vx, vy, angle, ... }`
  - [x] Add `registerLocalPlayers` event to inform server of local player count
  - [x] Update disconnect handling for local players

- [x] 3.2 Update Server Player Management
  - [x] Modify `server.js` to track multiple players per socket
  - [x] Update player data structure to include `socketId` and `localPlayerIndex`
  - [x] Modify `joinRoom` to create multiple player objects for local multiplayer
  - [x] Update room player limit logic (socket count vs player count)

- [x] 3.3 Update Server Game Logic
  - [x] Modify `server/game_logic/player.js` to handle input array
  - [x] Update `handleInput` to process multiple players from same socket
  - [x] Ensure collision detection works for local players
  - [x] Update scoring/kill tracking for local players

- [x] 3.4 Update Server State Sync
  - [x] Ensure `updateLobby` includes all local players
  - [x] Update `gameState` broadcasts to include all players
  - [x] Handle local player disconnection (all disconnect if socket drops)

- [ ] 3.5 Testing Phase 3
  - [ ] Test single local player (backward compatibility)
  - [ ] Test 2 local players sending inputs
  - [ ] Test 4 local players in a match
  - [ ] Test local + online players in same room
  - [ ] Verify server processes all inputs correctly

### Phase 4: Game Rendering & Visual Updates
**Goal:** Render all local players with visual distinction

- [x] 4.1 Update Game Scene Rendering
  - [x] Modify `gameScene.js` to track multiple local player IDs
  - [x] Add visual indicators for "your" local players (subtle outline/glow)
  - [x] Ensure player names and colors are clearly visible for identification

- [x] 4.2 Update HUD for Local Players
  - [x] Modify `hud.js` to show stats for all local players
  - [x] Display weapon/ammo for each local player
  - [x] Show health/shield for each local player
  - [x] Add player identifier (P1, P2, P3, P4) or name to HUD elements

- [x] 4.3 Update Scoreboard
  - [x] Modify `scoreboard.js` to highlight local players
  - [x] Add visual indicator next to local player names (e.g., ⌨️ or 🎮 icon)
  - [x] Ensure local players are easily distinguished from online players

- [ ] 4.4 Testing Phase 4
  - [ ] Test rendering with 1 local player
  - [ ] Test rendering with 2-4 local players
  - [ ] Verify visual indicators are clear and non-intrusive
  - [ ] Verify HUD shows correct info for each local player
  - [ ] Test that players can easily identify themselves by name/color

### Phase 5: Team Mode & Edge Cases
**Goal:** Ensure local multiplayer works with team modes and handle edge cases

- [ ] 5.1 Team Mode Support
  - [ ] Allow local players to be on different teams
  - [ ] Update team assignment UI for local players
  - [ ] Ensure friendly fire settings work for local players
  - [ ] Test team scoring with local players

- [ ] 5.2 Handle Controller Hotplug
  - [ ] Detect controller disconnection during gameplay
  - [ ] Pause affected local player or show warning
  - [ ] Allow controller reassignment in lobby
  - [ ] Test reconnection scenarios

- [ ] 5.3 Handle Edge Cases
  - [ ] Solo local player (backward compatibility)
  - [ ] All players local (no online players)
  - [ ] Local + online in same team
  - [ ] Host disconnect with local players
  - [ ] Local player goes AFK/inactive

- [ ] 5.4 Testing Phase 5
  - [ ] Test team battles with local players
  - [ ] Test controller disconnect scenarios
  - [ ] Test edge case scenarios
  - [ ] Perform full integration testing

### Phase 6: Polish & Optimization
**Goal:** Improve UX, performance, and add quality-of-life features

- [ ] 6.1 UI/UX Improvements
  - [ ] Add controller button prompts in menus
  - [ ] Add sound effects for controller assignment
  - [ ] Improve visual feedback for local player actions
  - [ ] Add "quick setup" option for common configurations

- [ ] 6.2 Performance Optimization
  - [ ] Optimize input polling for multiple controllers
  - [ ] Ensure rendering performance with 4+ local players
  - [ ] Profile and optimize network traffic with multiple inputs

- [ ] 6.3 Documentation
  - [ ] Update README.md with local multiplayer instructions
  - [ ] Document keyboard+mouse + controller setup
  - [ ] Add troubleshooting guide for controller issues
  - [ ] Create video/GIF demos of local multiplayer

- [ ] 6.4 Final Testing
  - [ ] Full playthrough with 2 local + 2 online players
  - [ ] Test all game modes (LMS, Kill-based, Time-based)
  - [ ] Test all weapon types with local players
  - [ ] Stress test with maximum players (4 local + 4 online)

## Key Technical Notes

### Input Method Priority
- **Player 1 (P1)**: Keyboard + Mouse (default)
- **Player 2-4**: Controllers 0-2
- Allow reassignment in setup screen

### Player ID Format
- **Online Player**: `socketId` (e.g., `"abc123"`)
- **Local Player**: `socketId-localIndex` (e.g., `"abc123-0"`, `"abc123-1"`)

### Network Optimization
- Bundle all local player inputs into single packet
- Maintain 60 Hz input polling rate
- Compress input data where possible

### Visual Identification
- Full map always visible (no camera tracking needed)
- Player names displayed above each knight
- Player colors distinguish each player
- Optional subtle outline/glow for local players

## Success Criteria

- ✅ 1 keyboard+mouse player and up to 3 controller players work simultaneously
- ✅ Local and online players can play together seamlessly
- ✅ All game modes work with local multiplayer
- ✅ Clear visual distinction between local and remote players
- ✅ Smooth input handling with no conflicts
- ✅ Controllers can be hot-swapped in lobby
- ✅ Performance remains smooth with 4 local + 4 online players

## Future Enhancements (Post-Launch)

- [ ] Local-only mode (no server connection)
- [ ] Save local player configurations
- [ ] Per-player controller sensitivity settings
- [ ] Rumble/vibration for controller events
- [ ] Spectator mode for eliminated local players
