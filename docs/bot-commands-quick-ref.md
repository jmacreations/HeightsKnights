# Bot Commands Quick Reference

## Adding Bots - Two Methods

### Method 1: Lobby UI (Easiest)

**Host can add bots directly in the lobby:**

1. Click **"🤖 Add Bot"** button (next to "Add Local Player")
2. Select difficulty:
   - 😊 **Easy** - Slower reaction, less accurate
   - 😐 **Medium** - Balanced difficulty
   - 😈 **Hard** - Fast reaction, very accurate
3. Bot instantly added with random name
4. Remove bot by clicking **×** button next to bot name

**Requirements:**
- Must be room host
- Room must have < 8 players

---

### Method 2: Server CLI Commands

### Add Bot
```bash
addBot <ROOM_CODE> [difficulty] [name]
```
**Examples:**
```bash
addBot ABCD                          # Medium difficulty, random name
addBot ABCD easy                     # Easy difficulty, random name
addBot ABCD hard Sir Lancelot        # Hard difficulty, custom name
```

**Difficulties:** `easy` | `medium` | `hard`

**Limits:**
- Max 7 bots total
- Max players = 8 (humans + bots)
- If 3 humans in room, can add max 5 bots

---

### Remove Bot
```bash
removeBot <ROOM_CODE> <BOT_ID>
```
**Example:**
```bash
removeBot ABCD bot_1699123456789_xyz
```

**Tip:** Use `listBots` to get bot IDs

---

### List Bots
```bash
listBots <ROOM_CODE>
```
**Example:**
```bash
listBots ABCD
```

**Output:**
```
Bots in room ABCD:
  Sir Lancelot [bot_1699123456789_xyz]
    Difficulty: hard, State: COMBAT, Target: Dame Morgan
    Alive: true, Score: 3, Weapon: minigun
```

---

### Debug Bot
```bash
debugBot <ROOM_CODE> <BOT_ID>
```
**Example:**
```bash
debugBot ABCD bot_1699123456789_xyz
```

**Output:**
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

---

### List Rooms
```bash
listRooms
```
Shows all active rooms with player counts

---

### Help
```bash
help
```
Shows all available commands

---

## Bot Names (Randomized)

| Knights (Male) | Dames (Female) |
|---------------|----------------|
| Sir Lancelot  | Dame Morgan    |
| Sir Galahad   | Lady Guinevere |
| Sir Percival  | Dame Elaine    |
| Sir Gawain    | Lady Viviane   |
| Sir Tristan   | Dame Isolde    |
| Sir Bedivere  | Lady Morgana   |
| Sir Gareth    | Dame Lynette   |
| Sir Kay       | Lady Enid      |
| Sir Lamorak   | Dame Laudine   |
| Sir Bors      | Lady Ragnelle  |

**Customize:** Edit `BOT_NAMES` array in `server/game_logic/bot_ai.js`

---

## Difficulty Comparison

| Attribute | Easy | Medium | Hard |
|-----------|------|--------|------|
| Reaction Delay | 400-600ms | 200-350ms | 100-200ms |
| Aim Error | ±17° | ±9° | ±5° |
| Decision Rate | 400ms | 250ms | 150ms |
| Dash Usage | 30% | 60% | 80% |
| Attack Accuracy | 70% | 85% | 95% |
| Charge Weapons | 50% | 75% | 90% |
| Predict Movement | ❌ | ✅ | ✅ |

---

## Quick Start

### Option A: Using Lobby UI (Recommended)

```
1. Start server: node server/server.js
2. Create a room in browser
3. In lobby, click "🤖 Add Bot"
4. Select difficulty (Easy/Medium/Hard)
5. Repeat to add more bots
6. Start match!
```

### Option B: Using Server CLI

```bash
# 1. Start server
node server/server.js

# 2. Create a room in client
# Room code: ABCD

# 3. Add bots from server terminal
addBot ABCD easy
addBot ABCD medium
addBot ABCD hard

# 4. Check bots
listBots ABCD

# 5. Start match and observe!

# 6. Remove bot if needed
removeBot ABCD <bot_id_from_list>
```

---

## Bot Behavior

### States
- **IDLE**: Waiting for targets
- **COMBAT**: Fighting an enemy
- **EVADE**: Running from danger
- **PICKUP**: Collecting powerup
- **PATROL**: Exploring map

### Weapon Tactics
- **Sword**: Aggressive dashing
- **Shotgun**: Close-range burst
- **Bow**: Charged long shots
- **Minigun**: Sustained strafing
- **Laser**: Long-range precision
- **Grenade**: Area denial
- **Mine**: Trap placement

### Key Behaviors
- ✅ Prioritize nearest threats
- ✅ Maintain optimal weapon range
- ✅ Strafe while in combat
- ✅ Avoid grenades and mines
- ✅ Pick up weapons when unarmed
- ✅ Dash to close gaps or escape
- ✅ Predict movement (medium/hard)

---

## Troubleshooting

**Bot not moving?**
- Use `debugBot` to check state
- Verify bot is alive
- Check if target is set

**Bot not attacking?**
- Check weapon ammo
- Verify target in range
- Check attack cooldown

**Room deleted unexpectedly?**
- All human players left
- Bots can't host rooms

**Can't add more bots?**
- Check player count (max 8 total)
- Use `listRooms` to see current count

---

## Files

```
server/
  game_logic/
    bot_ai.js           ← Bot AI implementation
    game.js             ← Integration (updateBots)
  server.js             ← CLI commands

docs/
  bot-ai-implementation.md   ← Complete guide
  bot-ai-complete.md         ← Implementation summary
  bot-ai-plan.md             ← Architecture details
  bot-commands-quick-ref.md  ← This file
```

---

**Last Updated**: November 2025  
**Version**: 1.0  
**Status**: Production Ready ✅
