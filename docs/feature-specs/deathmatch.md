# Deathmatch Game Mode - Feature Specification

**Game Mode ID**: `deathmatch`  
**Status**: ✅ Active  
**Version**: 1.0  
**Last Updated**: October 28, 2025

---

## Overview

**Deathmatch** is the core competitive game mode in SlashDash. It's a free-for-all battle where players (knights) fight to be the last one standing in each round. The first player to win 5 rounds wins the match.

### Core Concept
- **Every knight for themselves** - No teams, no allies
- **Round-based combat** - Win rounds by being the last knight alive
- **First to 5 wins** - Best of 9 rounds format
- **Arena combat** - Fight in a walled arena with strategic cover
- **Power-up economy** - Collect weapons and shields to gain advantage

---

## Game Rules

### Victory Conditions

#### Round Victory
- **Last Knight Standing**: Be the only surviving knight when all others are eliminated
- **Draw**: If multiple knights die simultaneously, no points are awarded (rare)

#### Match Victory
- **First to 5 Points**: First player to win 5 rounds wins the entire match
- **Maximum 9 Rounds**: Match can last up to 9 rounds before someone reaches 5 wins

### Player Requirements
- **Minimum Players**: 2
- **Maximum Players**: 8
- **Recommended**: 4-6 players for optimal gameplay

---

## Gameplay Flow

### 1. Pre-Round Phase (3 seconds)
- All players spawn at designated spawn points
- Players are invulnerable during countdown
- Countdown displayed: "3", "2", "1", "FIGHT!"
- Players can move but cannot attack
- All players start with **Sword** (default weapon)
- No shields at round start

### 2. Combat Phase (Variable Length)
- Players freely move around the arena
- Collect power-ups as they spawn
- Attack other players with weapons
- Use abilities (lunge, shield)
- Destroy walls with weapons
- Last until you're eliminated or win

### 3. Round End (3 seconds)
- Winner announced with fanfare
- Scores updated on scoreboard
- Brief pause before next round
- Automatic transition to next round

### 4. Match End
- Victory screen shows match winner
- "Play Again" button appears
- Host can reset match to return to lobby
- All scores reset on rematch

---

## Map & Environment

### Map Dimensions
- **Width**: 800 pixels (16 units × 50px)
- **Height**: 700 pixels (14 units × 50px)

### Map Layout
```
S              S     ← Spawn points (corners)
                
  111      111       ← Wall clusters
  1    P     1       ← Power-up spawn
S 1          1 S     ← Spawn points (mid-sides)
                
      1111  P        ← Central wall formation
   P  1111           
                
S 1          1 S     ← Spawn points (mid-sides)
  1     P    1       
  111      111       
                
S              S     ← Spawn points (corners)
```

### Map Elements

#### Walls
- **Size**: 50×50 pixels
- **Health**: 3 HP
- **Destructible**: Yes (via weapons)
- **Purpose**: Cover, strategic positioning
- **Visual**: Gray (changes shade based on HP)

#### Spawn Points (S)
- **Count**: 8 spawn points
- **Distribution**: 4 corners, 4 mid-sides
- **Rotation**: Players spawn at different points each round
- **Safety**: No power-ups or walls directly on spawn points

#### Power-up Locations (P)
- **Count**: 4 designated spawn locations
- **Spacing**: Strategic positions throughout map
- **Spawn Rate**: One power-up every 10 seconds
- **Max Active**: 4 power-ups can exist simultaneously

---

## Combat System

### Base Mechanics

#### Movement
- **Speed**: 5 pixels per frame (150 px/s at 30 FPS)
- **Controls**: WASD or Arrow Keys
- **Diagonal**: Full speed in all 8 directions
- **Aiming**: Mouse position determines facing direction

#### Lunge Ability
- **Activation**: Press Spacebar
- **Effect**: 3× movement speed boost
- **Duration**: 250ms (0.25 seconds)
- **Cooldown**: 2 seconds
- **Purpose**: Quick dodges, aggressive charges, gap closers

#### Health System
- **HP**: 1 hit kill (no health bar)
- **Respawn**: Next round only
- **Death**: Player becomes spectator until round ends

---

## Weapons System

### Default Weapon

#### Sword (Starting Weapon)
- **Type**: Melee
- **Ammo**: Unlimited
- **Cooldown**: 300ms
- **Range**: 45 pixels
- **Arc**: 90° cone in front of player
- **Duration**: Slash active for 150ms
- **Special**: 100ms parry window at slash start (blocks projectiles)
- **Color**: Light Gray (#d1d5db)

### Power-up Weapons

#### Bow
- **Type**: Projectile
- **Ammo**: 5 arrows per pickup
- **Cooldown**: 425ms between shots
- **Charge Mechanic**: Hold to charge, release to fire
  - Minimum charge: 100ms
  - Maximum charge: 2 seconds
  - Damage range: 0.5× to 2.0× based on charge
- **Projectile Speed**: Variable based on charge
- **Color**: Yellow (#facc15)
- **Strategy**: Long-range precision weapon

#### Shotgun
- **Type**: Multi-projectile
- **Ammo**: 6 shots (×5 pellets each = 30 total pellets)
- **Cooldown**: 800ms
- **Pellet Count**: 5 per shot
- **Spread**: 0.5 radians (~28.6°)
- **Recoil**: 10 pixel knockback on fire
- **Color**: Orange (#fb923c)
- **Strategy**: Close-range devastating damage

#### Laser
- **Type**: Hitscan beam
- **Ammo**: 2 shots
- **Cooldown**: 2000ms (2 seconds)
- **Charge Time**: 800ms (must charge before firing)
- **Effect**: Instant hit - no projectile travel time
- **Range**: Entire screen
- **Visual**: Red beam with 500ms fade
- **Color**: Red (#f87171)
- **Strategy**: High-skill, high-reward sniper weapon

#### Minigun
- **Type**: Rapid-fire projectile
- **Ammo**: 30 bullets
- **Cooldown**: 80ms (12.5 shots/second)
- **Movement Penalty**: 20% slower while equipped
- **Projectile Speed**: Fast
- **Color**: Gray (#9ca3af)
- **Strategy**: Suppression fire, wall destruction

### Weapon Mechanics

#### Ammo System
- Running out of ammo automatically reverts to Sword
- No ammo drops - must collect new weapon power-ups
- Ammo displayed in HUD when using limited-ammo weapons

#### Weapon Switching
- Collecting a new weapon replaces current weapon
- Cannot drop weapons voluntarily
- Death resets to Sword on next round

---

## Shield System

### Shield Power-up
- **Type**: Defense utility
- **Energy**: 5000 units (5 seconds at full drain)
- **Activation**: Hold Shift
- **Drain Rate**: 1000 units per second while active
- **Effect**: Blocks one attack (projectile or melee)
- **Limitation**: Cannot attack while shield is active
- **Destruction**: Shield breaks after blocking one attack
- **Visual**: White circle around player

### Shield Spawn Logic
- Maximum shields on map = 50% of player count (rounded up)
- Example: 4 players = max 2 shields
- Shield won't spawn if limit reached
- Shield power-ups less common than weapons

---

## Power-up System

### Spawn Mechanics
- **Spawn Interval**: Every 10 seconds
- **Max Simultaneous**: 4 power-ups active
- **Spawn Locations**: Fixed 4 positions on map
- **Spawn Logic**: One random location per spawn cycle
- **Collection**: Walk over power-up to collect (collision radius: 35 pixels)

### Drop Rates
Power-ups spawn based on weighted probability:

| Power-up | Weight | Relative Chance |
|----------|--------|-----------------|
| Shotgun  | 35     | 38.9%          |
| Bow      | 20     | 22.2%          |
| Shield   | 20     | 22.2%          |
| Minigun  | 10     | 11.1%          |
| Laser    | 5      | 5.6%           |

### Spawn Restrictions
- **Minigun**: Only 1 can exist in play at a time
- **Laser**: Only 1 can exist in play at a time
- **Shield**: Limited to 50% of player count
- **Weapons**: Consider weapons already held by players

---

## Scoring System

### Point Awards
- **Round Win**: +1 point
- **Draw**: No points awarded to anyone
- **Match Win**: First to 5 points

### Scoreboard Display
- Real-time score display during gameplay
- Player names color-coded to match knight colors
- Sorted by score (highest to lowest)
- Current round winner highlighted

---

## Strategy & Tactics

### Offensive Strategies
1. **Sword Rush**: Use lunge + sword for quick melee kills
2. **Camping Power-ups**: Control weapon spawn locations
3. **Wall Destruction**: Create new angles of attack
4. **Projectile Spam**: Use minigun/shotgun for area denial

### Defensive Strategies
1. **Wall Hugging**: Use destructible walls as cover
2. **Shield Timing**: Activate shield on prediction
3. **Evasive Lunge**: Dash away from danger
4. **Parry Fishing**: Sword parry to deflect projectiles

### Advanced Tactics
1. **Corner Fighting**: Use map edges for positional advantage
2. **Third-Party**: Wait for two players to fight, then clean up winner
3. **Ammo Conservation**: Don't waste limited-ammo weapons
4. **Bait & Switch**: Fake aggression to draw out enemy abilities

---

## Technical Specifications

### Performance Targets
- **Server Tick Rate**: 30 FPS (33ms per tick)
- **Client Render Rate**: 60 FPS
- **Network Updates**: 30 times per second
- **Input Latency**: <50ms typical

### Networking
- **Authority**: Server-authoritative (prevents cheating)
- **State Sync**: Full game state broadcast every tick
- **Input Handling**: Client sends input, server validates and applies
- **Lag Compensation**: None (intentional for competitive fairness)

### Collision Detection
- **Player-Player**: Circle collision (radius: 20px)
- **Player-Wall**: AABB collision
- **Projectile-Player**: Circle collision
- **Projectile-Wall**: AABB collision with HP reduction
- **Hitscan**: Raycast from shooter to target

---

## Balance Philosophy

### Design Goals
1. **Skill-based**: Player skill should determine outcomes
2. **Weapon Variety**: All weapons viable in different situations
3. **No Camping**: Power-ups encourage movement
4. **Quick Rounds**: Average round length 30-90 seconds
5. **Comeback Potential**: Losing early rounds doesn't guarantee loss

### Balance Considerations
- Sword is always available (no "weaponless" situations)
- Power-up spawns are predictable (every 10s)
- One-hit kills keep rounds fast-paced
- Shield requires active use (energy drain prevents passive play)
- Weapon variety prevents stale meta

---

### Known Limitations
- No lag compensation (may disadvantage high-ping players)
- Full state sync (could scale poorly with many players)
- No reconnect feature (disconnect = loss)
- No spectator mode for eliminated players

---

## Related Documents
- [Architecture Documentation](../architecture.md) - System design overview
- [Roadmap](../roadmap.md) - Planned features and improvements
- [Ideas](../ideas.md) - Future game mode concepts

---

**Document Status**: Complete  
**Implementation Status**: Fully Implemented  
**Testing Status**: Active in production