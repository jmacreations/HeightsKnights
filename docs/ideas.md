## GAME Settings


## DEATHMATCH
### Potential Enhancements
- [x] Map selection
  - [x] refactor code to allow for importing of map json files in a directory. Include instructions in the readme.md for designing map json files.
- [x] Map design elements
  - [x] non-destructable walls are black like the outer wall of the map. Use a N on the map design to indicate a Non-Destructable wall.
  - [x] respawning destructable walls (re-appears after 10-15s AND if there is not a player in the space for the last 1 sec, otherwise wait for 1 sec and try respawn wall block) 
  - [x] respawning walls blink for 1sec and are 50% opcity before appearing.
  - Implementation notes:
    - Destructible walls enter a destroyed state and are tracked for respawn; they return after a randomized 10–15s delay if no player has been within ~1.5× wall size for the last 1s.
    - During the final 1s before reappearing, the wall previews with a 50% opacity blink (200ms cadence) to warn players.
    - Non‑destructible walls (map tile 'N') are rendered solid black and cannot be damaged by any weapon.

- [ ] Custom match settings
  - These would be accessible via a gear icon when in the lobby of a game mode for the host only. For all players, beside the lobby screen would show the game type and the settings for the game type (Win Type, Score Target, Individual or Team, Weapon List, Friendly Fire on/Off if a team match)
  - Win type
    - [x] Time based - Player with the most points when the timer runs out. Infinite lives, auto respawn.
    - [x] Kill based (first to x kills wins) auto respawn.
    - [x] Last knight standing each round you get 1 life and the last knight to remian gets a point. First to the set points wins.
  - [x] Score target (time or kills) Currently defaulted to 5 for Last night standing.
  - [ ] Play Type (Individual or Team)
  - [x] Weapon selections (disable certain weapons). Allow the player to select (checkbox) the weapons to be included in the round. Can exclude all weapons to set a "sword only" match. Sword cannot be disbled.
  - [ ] Friendly Fire ON/OFF (team based only)
- [x] Randomised spawn points
- [x] Respawn invulnerability window (1.5sec)

- NEW POWERUPS
    - 
- NEW WEAPONS
    - [x] Grenade, powerup the throw strength similar to bow weapon. Grenade can bounce off walls to its landing point. 1sec fuse (fuse length adjustable in the weapon constants)

MENU SETTINGS
- [x] "Leave game" button when in game for non-host players should not take all players back to the lobby unless there is only one player left in the room. It should simply remove the player from the room and let the rest play on.
- [x] Host should be given the option at the end of a game to "Exit to Lobby" or "Play Again". Play again should just reset the points and let the players start again in a new round.
- [x] Non-host players at the end of the game should only be given the option to "Leave Game"
- [x] Leave Game and End Game options in game should move to a modal window that pauses the game for all players and allows the host to pick from the two options "Leave Game" or "Exit to Lobby"
- [x] Rename "End Game" option to "Exit to Lobby"
- [x] Menu is not a button on screen and only accessible by pressing Esc key. (non-host and host alike)
- [x] Leave game option for all players should ask to confirm "Are you sure?"
- [x] Pause state should show to players. Dim the screen with a message "PAUSED"
- [x] Host pausing the game should also pause the round start countdown. This will prevent the round from starting while the host is in the menu.


# TEAM BATTLE GAME MODE
1. Team Assignment & Management
- Team selection in lobby (auto-balance, manual assignment by host)
- Display team colors/names in UI
- Minimum/maximum players per team enforcement
2. Game State & Scoring
- Track team scores (kills, objectives, etc.)
- Attribute kills and points to teams
- Team-based win conditions (first to X points, most points at end, etc.)
3. UI/UX Updates
- Show team scores and player lists in-game HUD
- Indicate teammates visually (color, icons, etc.)
- Friendly fire indicator and toggle (host setting)
4. Spawn & Respawn Logic
- Team-based spawn points
- Prevent spawning near enemy players if possible
5. Networking & Sync
- Sync team assignments and scores across all clients
- Handle reconnects and late joins with correct team assignment
6. Game Logic Changes
- Prevent damage to teammates if friendly fire is off
- Adjust powerups/weapons if needed for team play
7. Edge Cases & Balancing
- Handle unbalanced teams (auto-balance, handicaps, or warnings)
- Prevent match start if teams are too uneven
8. Testing & QA
Test with various player counts and disconnect/reconnect scenarios
Ensure UI and scoring work correctly for teams
Optional Enhancements:

Team chat or communication tools
Team-based achievements or stats

---
## TASK CHECKLIST

### Team Battle Mode
- [ ] Team selection in lobby (auto-balance/manual by host)
- [ ] Display team colors/names in UI (Red/Blue)
- [ ] Enforce min/max players per team (Host setting)
- [ ] Track team scores and attribute points/kills
- [ ] Implement team-based win conditions
- [ ] Show team scores in HUD
- [ ] Indicate teammates visually
- [ ] Add Friendly Fire toggle and logic (Host only game settings)
- [ ] Team-based spawn points and spawn logic
- [ ] Prevent spawning near enemies
- [ ] Sync team assignments and scores across clients
- [ ] Prevent damage to teammates if friendly fire is off
- [ ] Adjust powerups/weapons for team play
- [ ] Handle unbalanced teams (auto-balance, handicaps, warnings)
  - [ ] Calculate team size difference
  - [ ] Apply speed multiplier to smaller team: `speedMultiplier = 1 + (teamSizeDifference * 0.10)`
  - [ ] Apply respawn delay reduction to smaller team: `respawnMultiplier = 1 - (teamSizeDifference * 0.10)`
  - [ ] Cap maximum bonus (e.g., 30-40% to prevent extreme cases)
  - [ ] Display speed/respawn bonuses in UI for transparency