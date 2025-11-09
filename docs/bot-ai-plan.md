# Bot AI Implementation Plan

## Clarification Questions - ANSWERED

### 1. Player Object Structure
**Answer:** Players are plain JavaScript objects with properties:
```javascript
{
    id: "socketId-0",
    name: "Player Name",
    color: "#4ade80",
    teamId: "blue" | null,
    x: 100, y: 100,           // Position
    vx: 0, vy: 0,             // Velocity (normalized direction)
    angle: 0,                  // Facing angle in radians
    isAlive: true,
    health: 100,               // Implied (one-shot kills, so health is binary)
    score: 0,
    weapon: { type, cooldown, ammo, ... }, // Current weapon object from WEAPONS
    lastAttackTime: 0,
    isLunging: false,
    lungeEndTime: 0,
    lastLungeTime: 0,
    hasShield: false,
    shieldActive: false,
    shieldEnergy: 0,
    bowChargeStartTime: 0,
    grenadeChargeStartTime: 0,
    laserChargeTime: 0,
    parryEndTime: 0,
    isInvulnerable: false,
    invulnerableUntil: 0,
    respawnTime: 0
}
```

### 2. Game Loop & Input Processing
**Answer:** 
- Server runs at **30 FPS** (1000/30 ms = ~33ms per tick)
- Main loop: `setInterval` in `server/server.js` calls `gameLoop(room, deltaTime)`
- `gameLoop()` updates: lasers → knights → projectiles → sword slashes → mines → powerups → wall respawns
- **Input is state-based**: Players set `vx`, `vy` (velocity), and `angle` properties
- Actions triggered by calling functions: `handleAttackStart()`, `handleAttackEnd()`, `handleLunge()`
- **No input queue** - AI can directly mutate player properties each tick

### 3. Projectiles & Collisions
**Answer:**
- Projectiles stored in `room.projectiles[]` array
- Each projectile: `{ x, y, vx, vy, damage, ownerId, type, ... }`
- Collision detection:
  - `isCollidingWithWall(pos, walls, buffer)` - Circle-rectangle collision
  - `getDistance(a, b)` - Euclidean distance between two entities
- Hit detection happens in `updateProjectiles()` and `updateSwordSlashes()`
- One-shot kill system (except shields)

### 4. Map Data Representation
**Answer:**
- Maps loaded from JSON files in `server/maps/` (e.g., `classic.json`)
- Map structure:
```javascript
{
    id: "classic",
    name: "Classic Arena",
    width: 1600,
    height: 1200,
    walls: [{ x, y, width, height, destructible: bool, health }],
    powerupSpawns: [{ x, y }],
    spawnPoints: [{ x, y }]
}
```
- Walls have `destructible` flag and `health` property
- Room stores: `room.walls[]`, `room.powerupLocations[]`, `room.spawnPoints[]`
- **No grid system** - continuous 2D space

### 5. Teams in Team Modes
**Answer:**
```javascript
room.teams = [
    { id: 'red', name: 'Red Team', color: '#ff4444', score: 0 },
    { id: 'blue', name: 'Blue Team', color: '#4444ff', score: 0 }
];
```
- Player has `teamId: 'red' | 'blue' | null`
- Team assignment in `assignTeamToPlayer()` function
- Friendly fire controlled by `room.matchSettings.friendlyFire`

### 6. Action Triggering
**Answer:**
- **Dash/Lunge**: `handleLunge(player)` - Sets `isLunging = true`, `lungeEndTime`, cooldown
- **Attack Start**: `handleAttackStart(player, room)` - Charges bow/grenade, or instant attack
- **Attack Release**: `handleAttackEnd(player, room)` - Releases charged weapons
- **Movement**: Set `player.vx`, `player.vy` to normalized direction vector (-1 to 1)
- **Aim**: Set `player.angle` to radians (0 = right, π/2 = down, π = left, 3π/2 = up)

### 7. Shield & Weapon Pickups
**Answer:**
- Pickups in `room.powerups[]`: `{ x, y, type: 'bow' | 'shotgun' | 'shield' | ... }`
- Collection: Automatic in `updateKnights()` when player within `KNIGHT_RADIUS` of powerup
- Weapon pickup: Replaces `player.weapon` with new weapon object
- Shield pickup: Sets `hasShield = true`, `shieldEnergy = SHIELD_MAX_ENERGY (5000ms)`
- Shield drains over time, blocks one hit

---

## Bot AI Architecture

### Approach: **Utility-Based AI with FSM Fallback**

**Why not pure FSM?**
- FSM can be rigid for complex decisions (e.g., "Should I grab this powerup or chase this enemy?")
- Utility AI allows weighted decision-making

**Why not pure Utility?**
- Harder to debug, can feel "floaty"
- FSM provides clear state transitions for understandable behavior

**Hybrid Solution:**
- **High-level FSM** for broad states: IDLE, COMBAT, EVADE, PICKUP, PATROL
- **Utility scoring** within states for target selection and action choices

---

## Bot Player Structure

```javascript
// Extend player object with AI properties
{
    ...regularPlayerProperties,
    isAI: true,
    aiDifficulty: 'easy' | 'medium' | 'hard',
    aiState: 'IDLE',
    aiTarget: null,           // Current target (player or powerup)
    aiDecisionTimer: 0,       // Time until next decision evaluation
    aiReactionDelay: 0,       // Simulated human reaction time
    aiLastStateChange: 0,
    aiMemory: {
        lastSeenEnemies: {},  // Track last known positions
        dangerZones: [],      // Areas to avoid (grenades, mines)
        pathingBlocked: false
    }
}
```

---

## FSM States

### 1. **IDLE**
- **Entry:** No immediate threats or objectives
- **Behavior:** Patrol map, look for pickups
- **Transitions:**
  - → COMBAT if enemy detected within attack range
  - → PICKUP if valuable powerup nearby
  - → PATROL if no activity for 2 seconds

### 2. **COMBAT**
- **Entry:** Enemy in range and should engage
- **Behavior:** 
  - Close distance if out of range
  - Strafe around enemy
  - Fire weapon
  - Dodge projectiles
  - Use dash offensively
- **Transitions:**
  - → EVADE if low health/disadvantaged
  - → PICKUP if high-value powerup very close
  - → IDLE if enemy dies or out of range

### 3. **EVADE**
- **Entry:** In danger (low health, outnumbered, grenade nearby)
- **Behavior:**
  - Move away from threats
  - Use dash defensively
  - Circle around cover
- **Transitions:**
  - → COMBAT if threat eliminated
  - → IDLE if safe for 1 second

### 4. **PICKUP**
- **Entry:** Valuable powerup detected
- **Behavior:**
  - Path to powerup
  - Check for ambushes
- **Transitions:**
  - → COMBAT if enemy interrupts
  - → IDLE when pickup collected or unreachable

### 5. **PATROL**
- **Entry:** No action for extended period
- **Behavior:**
  - Move between random map points
  - Scan for enemies
- **Transitions:**
  - → COMBAT if enemy detected
  - → PICKUP if powerup nearby

---

## Utility Functions

### Target Selection
```javascript
function selectTarget(bot, room) {
    const enemies = getEnemies(bot, room);
    const powerups = room.powerups;
    
    let bestScore = -Infinity;
    let bestTarget = null;
    
    // Score enemies
    enemies.forEach(enemy => {
        const dist = getDistance(bot, enemy);
        const angle = Math.atan2(enemy.y - bot.y, enemy.x - bot.x);
        const angleDiff = Math.abs(bot.angle - angle);
        
        let score = 100;
        score -= dist * 0.1;              // Closer = better
        score -= angleDiff * 20;          // Already facing = better
        score += enemy.isLunging ? -30 : 0; // Avoid lunging enemies
        score += enemy.hasShield ? -20 : 0;
        
        // Team mode: prioritize weak enemies
        if (room.matchSettings?.playType === 'team') {
            const teamCount = getTeamCount(bot, room);
            score += teamCount > getTeamCount(enemy, room) ? 20 : -20;
        }
        
        if (score > bestScore) {
            bestScore = score;
            bestTarget = { type: 'enemy', entity: enemy };
        }
    });
    
    // Score powerups
    powerups.forEach(powerup => {
        const dist = getDistance(bot, powerup);
        let score = 50;
        score -= dist * 0.2;
        
        // Weapon preference
        if (bot.weapon.type === 'sword' && powerup.type !== 'shield') {
            score += 40; // Really want a weapon
        }
        if (powerup.type === 'shield') score += 30;
        if (powerup.type === 'laser') score += 25;
        if (powerup.type === 'minigun') score += 20;
        
        if (score > bestScore) {
            bestScore = score;
            bestTarget = { type: 'powerup', entity: powerup };
        }
    });
    
    return bestTarget;
}
```

---

## Difficulty System

### Easy
- **Reaction Delay:** 400-600ms
- **Aim Error:** ±0.3 radians (~17°)
- **Decision Rate:** Re-evaluate every 400ms
- **Dash Usage:** Only defensive, 30% chance when in danger
- **Attack Timing:** 70% accuracy

### Medium
- **Reaction Delay:** 200-350ms
- **Aim Error:** ±0.15 radians (~9°)
- **Decision Rate:** Re-evaluate every 250ms
- **Dash Usage:** Offensive + defensive, 60% chance
- **Attack Timing:** 85% accuracy

### Hard
- **Reaction Delay:** 100-200ms
- **Aim Error:** ±0.08 radians (~5°)
- **Decision Rate:** Re-evaluate every 150ms
- **Dash Usage:** Strategic, 80% chance, predicts enemy movement
- **Attack Timing:** 95% accuracy

---

## Combat Behaviors

### Weapon-Specific Tactics

**Sword:**
- Close distance aggressively
- Circle strafe
- Dash into range
- Time swings with enemy reload

**Bow:**
- Maintain medium range (200-400 units)
- Charge shots to 70-90% (difficulty dependent)
- Strafe perpendicular to enemy
- Release early if enemy dashes

**Shotgun:**
- Close to 150 units
- Face enemy directly
- Manage recoil

**Laser:**
- Long range (400+ units)
- Charge fully
- Pre-aim enemy path
- Stand still while charging

**Minigun:**
- Medium range (250-350 units)
- Continuous fire
- Accept speed penalty
- Suppress enemy movement

**Grenade:**
- Indirect fire
- Aim at walls for bounces
- Lead moving targets
- Use for area denial

**Mine:**
- Place in chokepoints
- Trap powerups
- Defensive retreat tool

---

## Movement & Pathing

### Basic Steering
```javascript
function updateBotMovement(bot, target) {
    const dx = target.x - bot.x;
    const dy = target.y - bot.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    
    // Normalize direction
    bot.vx = dx / dist;
    bot.vy = dy / dist;
    
    // Add strafing for combat
    if (bot.aiState === 'COMBAT') {
        const perpX = -dy / dist;
        const perpY = dx / dist;
        const strafeIntensity = 0.3 + (bot.aiDifficulty === 'hard' ? 0.2 : 0);
        bot.vx += perpX * strafeIntensity * (Math.random() > 0.5 ? 1 : -1);
        bot.vy += perpY * strafeIntensity * (Math.random() > 0.5 ? 1 : -1);
        
        // Re-normalize
        const mag = Math.sqrt(bot.vx*bot.vx + bot.vy*bot.vy);
        bot.vx /= mag;
        bot.vy /= mag;
    }
}
```

### Obstacle Avoidance
```javascript
function avoidWalls(bot, room) {
    const lookAhead = 50; // Check 50 units ahead
    const futurePos = {
        x: bot.x + bot.vx * lookAhead,
        y: bot.y + bot.vy * lookAhead
    };
    
    if (isCollidingWithWall(futurePos, room.walls)) {
        // Turn perpendicular
        const temp = bot.vx;
        bot.vx = -bot.vy;
        bot.vy = temp;
    }
}
```

---

## Integration Points

### 1. Bot Creation (Server Command)
```javascript
// In server/server.js CLI handler
if (command === 'addBot') {
    const roomCode = args[1]?.toUpperCase();
    const difficulty = args[2] || 'medium';
    const name = args[3] || `Bot ${Object.keys(room.players).length + 1}`;
    
    const botId = `BOT-${Date.now()}`;
    const bot = createNewPlayer(botId, name, availableColors[playerCount]);
    bot.isAI = true;
    bot.aiDifficulty = difficulty;
    bot.aiState = 'IDLE';
    bot.aiDecisionTimer = 0;
    
    room.players[botId] = bot;
    assignTeamToPlayer(bot, room, name, roomCode);
    
    io.to(roomCode).emit('updateLobby', room);
    console.log(`✓ Added bot "${name}" (${difficulty}) to room ${roomCode}`);
}
```

### 2. Game Loop Integration
```javascript
// In server/game_logic/game.js - gameLoop()
function gameLoop(room, deltaTime) {
    if (room.state !== 'PLAYING') return;

    // UPDATE AI BOTS FIRST (before physics)
    updateBots(room, deltaTime);
    
    updateLasers(room);
    updateKnights(room, deltaTime);
    updateProjectiles(room);
    // ... rest of game loop
}
```

### 3. Bot Update Function
```javascript
// New file: server/game_logic/bot_ai.js
function updateBots(room, deltaTime) {
    const now = Date.now();
    
    Object.values(room.players).forEach(bot => {
        if (!bot.isAI || !bot.isAlive) return;
        
        // Decision rate limiting based on difficulty
        const decisionInterval = getDifficultySettings(bot.aiDifficulty).decisionRate;
        if (now < bot.aiDecisionTimer + decisionInterval) return;
        bot.aiDecisionTimer = now;
        
        // Main AI update
        updateBotBehavior(bot, room);
    });
}
```

---

## Performance Optimizations

1. **Staggered Updates:** Not all bots re-evaluate every tick
2. **Distance Culling:** Only consider enemies/pickups within 800 units
3. **Lazy Pathing:** Simple steering, no A* pathfinding
4. **Decision Caching:** Remember target for multiple frames
5. **LOD System:** Far bots use simpler logic

---

## Debug Utilities

```javascript
// Server command: debugBot <roomCode> <botId>
if (command === 'debugBot') {
    const bot = room.players[botId];
    console.log(`Bot ${bot.name}:`);
    console.log(`  State: ${bot.aiState}`);
    console.log(`  Target: ${bot.aiTarget?.entity?.name || 'None'}`);
    console.log(`  Position: (${bot.x.toFixed(0)}, ${bot.y.toFixed(0)})`);
    console.log(`  Weapon: ${bot.weapon.type} (${bot.weapon.ammo} ammo)`);
    console.log(`  Difficulty: ${bot.aiDifficulty}`);
}
```

---

## Implementation Order

1. ✅ Create `server/game_logic/bot_ai.js` file
2. ✅ Implement difficulty settings
3. ✅ Implement FSM state machine
4. ✅ Implement target selection utility
5. ✅ Implement movement & aiming
6. ✅ Implement weapon-specific behaviors
7. ✅ Integrate into game loop
8. ✅ Add server CLI commands (addBot, removeBot, listBots, debugBot)
9. ✅ Test with 1 bot, then scale to 7 bots
10. ✅ Tune difficulty parameters

---

## Questions for Developer

Before implementing, please confirm:

1. **Max bots per match:** You mentioned 7 bots (8 total players). Is this correct?
2. **Bot names:** Should bots have "Bot" prefix or generic names like "Knight 1"?
3. **Lobby behavior:** Should bots be addable in lobby, or only during match?
4. **Bot persistence:** Should bots stay across rounds or be removed after match ends?
5. **Client display:** Should clients show a bot icon/indicator, or are bots indistinguishable from humans?

Ready to proceed with implementation once you confirm these details!
