# SlashDash - Architecture Documentation

This file summarises the server and client structure of this project.

## High-Level Overview

**SlashDash** is a multiplayer browser-based action game built with a client-server architecture using Node.js, Express, Socket.IO, and HTML5 Canvas. The game features real-time combat between players (knights) in a 2D arena with various weapons and power-ups.

### Core Architecture Pattern
- **Client-Side**: Handles rendering, input capture, and UI state management
- **Server-Side**: Authoritative game state, physics simulation, and collision detection
- **Communication**: Real-time bidirectional communication via WebSockets (Socket.IO)

---

## Server Architecture

### Technology Stack
- **Node.js** with **Express** for HTTP server
- **Socket.IO** for WebSocket communication
- **Pure JavaScript** for game logic (no framework dependencies)

### Core Components

#### 1. **Server Entry Point** (`server/server.js`)
- HTTP server setup and static file serving
- Socket.IO connection management
- Room lifecycle management (create, join, disconnect)
- Main game loop (30 FPS tick rate)
- Player connection/disconnection handling
- Host migration on disconnect

**Key Responsibilities:**
- Room creation with unique 4-character codes
- Player authentication and room validation
- Broadcasting game state to all clients every 33ms
- Managing game mode selection

#### 2. **Game Logic Layer** (`server/game_logic/`)

##### `game.js` - Core Game Loop
- **Room State Management**: Creates and maintains room objects containing players, walls, projectiles, power-ups
- **Round System**: Handles countdown, round start, round end, match victory
- **Map Initialization**: Parses map layout from JSON maps to create walls, spawn points, and power-up locations
  - Map edges are implicitly solid, non-destructible boundaries. Do not include border walls in the JSON; the game treats the outer bounds as impassable and non-destructible by default.
- **Power-up Spawning**: Time-based power-up spawn system with drop tables
- **Victory Conditions**: Detects last knight standing and awards points
- **Scoring System**: First to reach SCORE_TO_WIN wins the match

##### `player.js` - Player State & Physics
- **Player Creation**: Initializes player objects with starting stats
- **Movement System**: Velocity-based movement with collision detection
- **Lunge Mechanic**: Dash ability with cooldown
- **Shield System**: Energy-based shield with drain mechanic
- **Power-up Collection**: Collision detection for power-up pickup
- **Hit Detection**: Handles player damage and shield blocking

##### `weapons.js` - Combat Systems
- **Sword**: Melee slash hitbox detection with visual feedback
- **Bow**: Charged projectile system with arrow physics
- **Shotgun**: Multi-pellet spread projectile system
- **Laser**: Hitscan raycast weapon with charge mechanic
- **Minigun**: Rapid-fire projectile weapon with movement penalty

##### `projectiles.js` - Projectile Physics
- Updates all active projectiles (arrows, shotgun pellets, minigun bullets)
- Wall collision detection and destruction
- Player collision detection with shield checks
- Projectile lifetime management

#### 3. **Utilities** (`server/utils/`)

##### `constants.js`
- Game configuration values (speeds, cooldowns, damage, map layout)
- Weapon definitions and statistics
- Map dimensions and boundaries

##### `helpers.js`
- Collision detection algorithms (AABB, circle-to-rectangle)
- Distance calculations
- Raycast implementation for hitscan weapons

### Server Data Flow
```
Client Input → Socket.IO Event → Server Validates → 
Updates Game State → Physics Simulation → 
Broadcasts State to All Clients (30 FPS)
```

---

## Client Architecture

### Technology Stack
- **Vanilla JavaScript** (ES6 modules)
- **HTML5 Canvas** for rendering
- **Socket.IO Client** for server communication
- **Tailwind CSS** for UI styling

### Core Components

#### 1. **Entry Point** (`public/js/main.js`)
- Application initialization
- Global state management (socket, player ID, room code, game state)
- Socket connection setup
- Screen transition handling

#### 2. **Network Layer** (`public/js/network.js`)
- Socket.IO event listeners
- Server event handlers:
  - `roomCreated` / `joinSuccess`: Room joining flow
  - `gameState`: Continuous game state updates
  - `countdown`: Pre-round countdown
  - `roundOver` / `matchOver`: Victory screens
  - `updateLobby`: Lobby player list updates

#### 3. **UI Management** (`public/js/ui/`)

##### `uiManager.js` - Screen Controller
Manages all screen transitions and UI rendering:
- **MENU**: Player name entry, create/join room
- **MODE_SELECT**: Game mode selection (new feature)
- **LOBBY**: Player list, room code display, game mode indicator, start button
- **GAME**: Canvas rendering area

##### `hud.js` - In-Game HUD
- Weapon indicator
- Ammo display
- Shield energy bar

##### `scoreboard.js` - Score Display
- Real-time player scores
- Color-coded player identification

#### 4. **Scene Management** (`public/js/scenes/`)

##### `gameScene.js` - Game Rendering & Input
- **Canvas Setup**: Dynamically sized canvas matching game dimensions
- **Input Capture**: 
  - Keyboard (WASD/Arrow keys for movement, Space for lunge, Shift for shield)
  - Mouse (movement for aiming, click for attack)
- **Rendering Loop**: 60 FPS client-side rendering
- **Draw Functions**:
  - Map walls with health-based colors
  - Power-ups with weapon-specific colors
  - Players with name tags and status indicators
  - Weapons (sword slashes, projectiles, laser beams)
  - Shield effects
- **Input Transmission**: Sends player input to server every frame

##### `lobbyScene.js` - Pre-Game Lobby
- Player list rendering
- Host indicator
- Start game button (host only)
- Minimum player validation

##### `modeSelectScene.js` - Game Mode Selection (New)
- Displays available game modes
- Shows mode descriptions and player requirements
- "Coming Soon" badges for future modes
- Mode selection with visual feedback

#### 5. **Configuration** (`public/js/config.js`)
- Weapon color configurations
- Game constants (knight radius, wall size, shield energy)
- Game mode definitions (deathmatch, team battle, capture the flag)

### Client Data Flow
```
User Input → Input Handler → Socket Emit to Server → 
Server Response → State Update → Canvas Redraw (60 FPS)
```

---

## Communication Protocol

### Client → Server Events
| Event | Payload | Purpose |
|-------|---------|---------|
| `createRoom` | `{playerName, gameMode}` | Create new game room |
| `joinRoom` | `{roomCode, playerName}` | Join existing room |
| `startGame` | `roomCode` | Start game (host only) |
| `playerInput` | `{vx, vy, angle, attackStart, attackEnd, lunge, shieldHeld, roomCode}` | Player input data |
| `playAgain` | `roomCode` | Return to lobby after match |

### Server → Client Events
| Event | Payload | Purpose |
|-------|---------|---------|
| `roomCreated` | `{roomCode, roomState, myId}` | Confirm room creation |
| `joinSuccess` | `{roomCode, roomState, myId}` | Confirm room join |
| `joinError` | `errorMessage` | Room join failed |
| `updateLobby` | `roomState` | Lobby player list update |
| `gameStarting` | - | Trigger game screen transition |
| `countdown` | `countNumber` | Pre-round countdown |
| `gameState` | `fullRoomState` | Complete game state (30/sec) |
| `roundOver` | `{players, winnerId}` | Round end with winner |
| `matchOver` | `{players, winnerId}` | Match end with winner |
| `returnToLobby` | `roomState` | Force return to lobby |

---

## Game State Structure

### Room Object (Server Authority)
```javascript
{
  players: { [socketId]: PlayerObject },
  hostId: string,
  state: 'LOBBY' | 'PLAYING' | 'ROUND_OVER',
  gameMode: string,
  walls: [WallObject],
  projectiles: [ProjectileObject],
  powerups: [PowerupObject],
  swordSlashes: [SlashObject],
  laserBeams: [BeamObject],
  powerupLocations: [Position],
  spawnPoints: [Position],
  lastUpdateTime: number,
  lastPowerupTime: number,
  roundWinner: string | null
}
```

### Player Object
```javascript
{
  id: string,
  name: string,
  color: string,
  x: number, y: number,
  angle: number,
  vx: number, vy: number,
  isAlive: boolean,
  score: number,
  weapon: WeaponObject,
  isLunging: boolean,
  hasShield: boolean,
  shieldActive: boolean,
  shieldEnergy: number,
  // ... timing properties
}
```

---

## Key Design Patterns

### 1. **Authoritative Server**
- All game logic runs on server
- Client is "dumb terminal" that renders and sends input
- Prevents cheating and ensures consistency

### 2. **State Synchronization**
- Server broadcasts complete game state 30 times per second
- Client renders latest received state
- Input is sent every frame but doesn't directly modify local state

### 3. **Room-Based Architecture**
- Each game instance is isolated in a room
- Room code acts as unique identifier
- Socket.IO rooms handle message broadcasting

### 4. **Event-Driven Communication**
- No REST API calls during gameplay
- All communication via WebSocket events
- Bi-directional real-time updates

### 5. **Module Pattern**
- ES6 modules on client (import/export)
- CommonJS modules on server (require/module.exports)
- Clear separation of concerns

---

## Game Flow

### Room Creation & Lobby
1. Player enters name on MENU screen
2. Clicks "Create Room" → Navigates to MODE_SELECT screen
3. Selects game mode → Server creates room with unique code
4. Other players join using room code
5. Host sees "Start Game" button when 2+ players present
6. Host clicks start → 3-second countdown begins

### Gameplay Loop
1. Server sends countdown events (3, 2, 1, FIGHT!)
2. Game state changes to PLAYING
3. Players send input → Server simulates → Broadcasts state
4. Power-ups spawn every X seconds at designated locations
5. Players collect weapons, fight, use abilities
6. Last knight standing wins the round
7. Round ends → Points awarded → New round starts
8. First to SCORE_TO_WIN points wins the match

### Match End
1. Victory screen displayed with "Play Again" button
2. Host can reset match → Returns all to lobby
3. Scores reset, ready for new match

---

## Extensibility

### Adding New Game Modes
1. Add mode configuration to `config.js` `GAME_MODES`
2. Set `available: true`
3. Implement mode-specific logic in `game.js` `gameLoop()`
4. Add victory condition handling

### Adding New Weapons
1. Define weapon in `constants.js` `WEAPONS`
2. Add color to client `config.js` `WEAPONS_CONFIG`
3. Implement attack logic in `weapons.js`
4. Add rendering in `gameScene.js`

### Adding New Power-ups
1. Add to `constants.js` `POWERUP_DROP_TABLE`
2. Implement pickup logic in `player.js`
3. Add rendering in `gameScene.js`

---

## Performance Considerations

- **Server**: 30 FPS game loop, ~33ms per tick
- **Client**: 60 FPS rendering, independent of server tick
- **Network**: Full state sync (not delta compression)
- **Scalability**: One process, multiple rooms in memory
- **Room Cleanup**: Empty rooms automatically deleted

---

## File Structure Summary

```
├── public/
│   ├── index.html              # Main HTML entry
│   ├── style.css               # UI styling
│   └── js/
│       ├── main.js             # Client entry point
│       ├── network.js          # Socket event handlers
│       ├── config.js           # Client constants
│       ├── scenes/
│       │   ├── gameScene.js    # Game rendering & input
│       │   ├── lobbyScene.js   # Lobby UI logic
│       │   └── modeSelectScene.js  # Mode selection UI
│       └── ui/
│           ├── uiManager.js    # Screen management
│           ├── hud.js          # In-game HUD
│           └── scoreboard.js   # Score display
├── server/
│   ├── server.js               # Server entry & socket handlers
│   ├── game_logic/
│   │   ├── game.js            # Core game loop & room management
│   │   ├── player.js          # Player physics & state
│   │   ├── weapons.js         # Combat systems
│   │   └── projectiles.js     # Projectile physics
│   └── utils/
│       ├── constants.js       # Game configuration
│       └── helpers.js         # Utility functions
└── docs/
    └── architecture.md        # This file
```