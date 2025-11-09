# Bot AI Implementation Guide

## Overview
The Heights Knights bot AI system provides intelligent CPU-controlled players that can fill matches and provide challenging opponents. Bots use a hybrid Utility-FSM (Finite State Machine) architecture with weapon-specific tactics and three difficulty levels.

## Quick Start

### Adding Bots via Server CLI

Start the server and use these commands:

```bash
# Add a bot with medium difficulty (default)
addBot <ROOM_CODE>

# Add a bot with specific difficulty
addBot <ROOM_CODE> easy
addBot <ROOM_CODE> hard

# Add a bot with custom name
addBot <ROOM_CODE> medium Sir Lancelot

# List all bots in a room
listBots <ROOM_CODE>

# Remove a bot
removeBot <ROOM_CODE> <BOT_ID>

# Debug bot AI state
debugBot <ROOM_CODE> <BOT_ID>
```

### Bot Limits
- **Maximum 7 bots** can exist at any time
- Bots fill remaining slots: `max_bots = 8 - human_players`
- If a room has 3 humans, you can add up to 5 bots

## Bot Behavior

### Bot Names
Bots are randomly assigned from a pool of 20 medieval names:
- Sir Lancelot, Dame Morgan, Sir Galahad, Lady Guinevere
- Sir Percival, Dame Elaine, Sir Gawain, Lady Viviane
- Sir Tristan, Dame Isolde, Sir Bedivere, Lady Morgana
- Sir Gareth, Dame Lynette, Sir Kay, Lady Enid
- Sir Lamorak, Dame Laudine, Sir Bors, Lady Ragnelle

The name list can be updated in `server/game_logic/bot_ai.js` in the `BOT_NAMES` array.

### Bot Persistence
- Bots stay in the room until explicitly removed with `removeBot` command
- Bots persist across rounds like human players
- Bots are NOT removed when rounds end or matches complete
- If all human players disconnect, the room is deleted (including bots)
- Bots cannot be hosts (host reassignment skips bots)

### Client Display
- Bots appear identical to human players
- No visual indicator distinguishes bots from humans
- Bots have names, colors, teams, and scores like any player

## Difficulty Levels

### Easy
- **Reaction Delay**: 400-600ms
- **Aim Error**: ±17 degrees
- **Decision Rate**: Every 400ms
- **Dash Usage**: 30% chance
- **Attack Accuracy**: 70%
- **Charge Weapons**: 50% charge
- **Movement Prediction**: Disabled

### Medium (Default)
- **Reaction Delay**: 200-350ms
- **Aim Error**: ±9 degrees
- **Decision Rate**: Every 250ms
- **Dash Usage**: 60% chance
- **Attack Accuracy**: 85%
- **Charge Weapons**: 75% charge
- **Movement Prediction**: Enabled

### Hard
- **Reaction Delay**: 100-200ms
- **Aim Error**: ±5 degrees
- **Decision Rate**: Every 150ms
- **Dash Usage**: 80% chance
- **Attack Accuracy**: 95%
- **Charge Weapons**: 90% charge
- **Movement Prediction**: Enabled

## AI Architecture

### Finite State Machine (FSM)

Bots operate in one of 5 states:

1. **IDLE**
   - Default state when no targets or objectives
   - Scans for enemies and powerups
   - Transitions to COMBAT, PICKUP, or PATROL after 3 seconds

2. **COMBAT**
   - Actively engaging an enemy
   - Uses weapon-specific tactics
   - Maintains optimal range for current weapon
   - Strafes perpendicular to target
   - Transitions to EVADE if outnumbered or outgunned

3. **EVADE**
   - Running away from danger
   - Triggered by:
     - Being unarmed vs armed enemy
     - Enemy lunging nearby
     - Multiple enemies close (< 300 units)
     - Standing in grenade/mine radius
   - Lasts 1.5 seconds then reassesses

4. **PICKUP**
   - Moving toward a powerup
   - Aborts if enemy approaches within 300 units
   - Prioritizes weapons if currently using sword

5. **PATROL**
   - Wandering to random map locations
   - Switches to COMBAT if enemy detected within 400 units
   - Prevents idle standing

### Target Selection (Utility System)

Bots score all potential targets and choose the best:

#### Enemy Scoring
- Base score: 100
- Distance penalty: -0.15 per unit
- Angle difference penalty: -15 per radian
- Lunging enemy: -30
- Shielded enemy: -20
- Range advantage bonus: +20 (ranged weapon vs sword)
- Team size advantage: ±15

#### Powerup Scoring
- Base score: 60
- Distance penalty: -0.25 per unit
- Weapon when unarmed: +50
- Weapon-specific values:
  - Shield: +35
  - Laser: +30
  - Minigun: +25
  - Shotgun: +25
  - Grenade: +20
  - Bow: +20
  - Mine: +15
- Already armed penalty: -30

## Weapon-Specific Tactics

### Sword (Default)
- **Range**: 60-80 units
- **Tactic**: Aggressive closing, frequent dashing
- **Behavior**: Dash toward enemies within 150-400 units

### Shotgun
- **Range**: 150-200 units
- **Tactic**: Close-range burst damage
- **Behavior**: Dash to close distance, backpedal if too close

### Bow
- **Range**: 300-500 units
- **Tactic**: Charged long-range shots
- **Behavior**: Maintain distance, charge 50-90% based on difficulty

### Minigun
- **Range**: 300-400 units
- **Tactic**: Sustained fire, strafing
- **Behavior**: Continuous firing with lateral movement

### Laser
- **Range**: 450-600 units
- **Tactic**: Long-range precision
- **Behavior**: Charge before firing, retreat if approached

### Grenade
- **Range**: 350-450 units
- **Tactic**: Area denial, indirect fire
- **Behavior**: Arc shots with 50-90% charge, predict movement

### Mine
- **Range**: 100-150 units
- **Tactic**: Trap placement
- **Behavior**: Place mines in choke points or near powerups

## Movement System

### Combat Strafing
- Strafes perpendicular to target at 40% intensity
- Changes direction every 1 second
- Maintains optimal weapon range
- Backs up if too close (< 70% optimal)
- Advances if too far (> 130% optimal)

### Wall Avoidance
- Predicts 60 units ahead
- Turns 90 degrees if collision detected
- Prevents getting stuck in corners

### Danger Avoidance
- Detects grenades within 100 units
- Detects armed mines within 80 units
- Applies avoidance force inversely proportional to distance
- Combined with movement vector for smooth evasion

### Movement Prediction (Medium/Hard)
- Predicts target position 300ms ahead
- Calculates projectile travel time
- Adjusts aim for moving targets

## Integration Points

### Game Loop (`server/game_logic/game.js`)
```javascript
updateLasers(room);
updateBots(room, deltaTime);  // ← Bot AI runs here
updateKnights(room, deltaTime);
updateProjectiles(room);
// ... rest of updates
```

Bots update before physics so their input (vx, vy, angle) is processed the same frame.

### Bot Creation (`server/server.js`)
```javascript
const bot = createNewPlayer(botId, botName, availColor);
bot.isAI = true;
bot.aiDifficulty = 'medium';
bot.socketId = botId;
```

Bots are standard player objects with `isAI` flag.

### Bot Detection
```javascript
if (player.isAI) {
    // This is a bot
}
```

## Performance Optimization

### Decision Rate Limiting
Bots only make decisions at intervals based on difficulty:
- Easy: 400ms
- Medium: 250ms
- Hard: 150ms

Between decisions, only movement/aiming updates run.

### Efficient Target Scanning
- Filters enemies by team mode and distance
- Caches target until state change
- Avoids redundant distance calculations

### Memory Management
- AI state stored in player object (no separate structures)
- Danger zones recalculated each decision tick
- No memory leaks from circular references

## Debugging

### CLI Commands

```bash
# Show all bots with current state
listBots ABCD

# Detailed bot inspection
debugBot ABCD bot_1699123456789_xyz
```

### Debug Output Example
```
=== Bot Debug: Sir Lancelot [bot_1699123456789_xyz] ===
Difficulty: hard
Position: (450.5, 320.7)
Velocity: (0.85, -0.52)
Angle: -31.4°
Alive: true, Score: 3
Weapon: minigun, Ammo: 12
Shield: true, Active: false

AI State: COMBAT
Target: Dame Morgan
  Position: (520.3, 280.1)
Strafe Direction: 1
Danger Zones: 0
```

### Common Issues

**Bot not moving:**
- Check if `aiTarget` is set
- Verify bot is alive (`isAlive: true`)
- Check velocity values (`vx`, `vy`)

**Bot not attacking:**
- Check weapon cooldown and ammo
- Verify target is in range
- Check attack accuracy roll

**Bot stuck in walls:**
- Wall avoidance should prevent this
- Check `isCollidingWithWall` function
- Verify map has valid spawn points

**Excessive lag with many bots:**
- Decision rate limiting should prevent this
- Check that only 7 bots max are active
- Verify `updateBots` isn't called multiple times

## Technical Details

### File Structure
```
server/
  game_logic/
    bot_ai.js          ← Main bot AI system
    game.js            ← Integration point
    player.js          ← Player object structure
    weapons.js         ← Attack handling
  server.js            ← CLI commands
```

### Dependencies
```javascript
// bot_ai.js imports
const { KNIGHT_RADIUS, WEAPONS, LUNGE_COOLDOWN } = require('../utils/constants');
const { getDistance, isCollidingWithWall } = require('../utils/helpers');
const { handleAttackStart, handleAttackEnd } = require('./weapons');
const { handleLunge } = require('./player');
```

### AI State Properties
```javascript
bot.aiState              // 'IDLE', 'COMBAT', 'EVADE', 'PICKUP', 'PATROL'
bot.aiTarget             // Current target (player or powerup object)
bot.aiDecisionTimer      // Timestamp of last decision
bot.aiReactionDelay      // Simulated reaction time
bot.aiLastStateChange    // When state last changed
bot.aiMemory = {
    lastSeenEnemies: {},     // Enemy tracking
    dangerZones: [],         // Hazard locations
    strafeDirection: 1,      // Current strafe dir
    lastStrafeChange: now    // Last strafe switch
}
```

## Future Enhancements

Potential improvements for bot AI:

1. **Learning System**: Track player tactics and adapt
2. **Personality Types**: Aggressive, Defensive, Sneaky variants
3. **Team Coordination**: Bots coordinate attacks in team mode
4. **Difficulty Auto-Adjustment**: Scale to player skill
5. **Voice Lines**: Add personality with taunts
6. **Loadout Preferences**: Bots prefer certain weapons
7. **Map Knowledge**: Learn best positions on each map
8. **Squad Behavior**: Bots travel in groups

## Credits

Bot AI implementation by GitHub Copilot based on specifications in `ideas.md`.

Architecture: Hybrid Utility-FSM with weapon-specific tactics
Language: Node.js (ES6+)
Framework: Socket.IO multiplayer game server
