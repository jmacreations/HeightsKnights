## Heights Knights
A fast-paced, real-time multiplayer 2D arena shooter built with Node.js, Express, and Socket.IO.

### About The Game
Heights Knights is a top-down, last-knight-standing arena game where players battle it out to be the final survivor. Players control a knight in a destructible arena, collecting powerful weapon and shield power-ups to gain an edge over their opponents. The player who is the last one alive at the end of a round scores a point, and the first to reach the score limit wins the match!

### Core Features
Real-time Multiplayer: Create or join game rooms that support up to 8 players.

**Diverse Arsenal:** Wield a variety of weapons, including a sword, a chargeable bow, a powerful shotgun, a hitscan laser, and a rapid-fire minigun.

**Dynamic Arenas:** The map features destructible walls that can be used for cover or strategically destroyed to open new lines of sight.

**Power-ups:** Grab weapon upgrades and shields that spawn periodically to turn the tide of battle.

**Modern Tech Stack:** Built with a clean, separated frontend and backend for easy maintenance and scalability.

### Tech Stack
**Backend:** Node.js, Express, Socket.IO

**Frontend:** HTML5 Canvas, JavaScript (ES Modules), Tailwind CSS

**Deployment:** Configured for services like Render.

### Getting Started
To get a local copy up and running, follow these simple steps.

**Prerequisites**
Node.js and npm installed on your machine. You can download them from nodejs.org.

**Installation & Running**
Clone the repo

`git clone https://github.com/jmacreations/HeightsKnights`

Navigate to the project directory

`cd your-repository-name`

Install NPM packages

`npm install`

Start the server

`npm start`

The server will start, and you can access the game at http://localhost:3000 in your web browser. The console will also provide a local network URL that you can use to connect other devices on the same Wi-Fi network for multiplayer testing.

## Creating Custom Maps

You can add your own maps by dropping JSON files into `server/maps/`. The game discovers maps automatically and exposes them in the Match Settings → Map dropdown for the host.

### JSON schema
- id: string (unique id for the map)
- name: string (display name)
- layout: array of strings, all rows must be the same length (rectangular grid)
- author: string (optional)
- description: string (optional)

### Tile legend
- space: empty floor
- `1`: destructible wall (has HP and can be destroyed; will respawn per game rules)
- `N`: non-destructible wall (indestructible interior wall or pillar)
- `P`: power-up spawn point
- `S`: player spawn point

Important: Map edges are implicitly solid, non-destructible boundaries. Do not draw border walls in the JSON; the game treats the outer bounds as impassable by default.

### Example
```json
{
	"id": "duel",
	"name": "Duel Pit",
	"layout": [
		"                ",
		" S            S ",
		"                ",
		"    111    111  ",
		"    1        1  ",
		"    1   P    1  ",
		"    1        1  ",
		"    111    111  ",
		"                ",
		" S            S ",
		"                "
	],
	"author": "Built-in"
}
```

### Sizing and boundaries
- Tile size: 50px (`WALL_SIZE`)
- Map width = number of columns × tile size
- Map height = number of rows × tile size
- The client canvas automatically resizes to the active map.

### Notes
- Layout must be perfectly rectangular (all rows equal length).
- Place files in `server/maps/` with a `.json` extension. Each file may contain a single object or an array of map objects.
- After adding or changing maps, restart the server to ensure they are loaded.

### Creating Custom Maps
Maps are simple JSON files located in `server/maps`. Each file defines a grid layout using characters per tile:

- `1` = Destructible wall block
- `N` = Non-destructible wall block (indestructible, drawn black)
- `P` = Power-up spawn point
- `S` = Player spawn point
- Space ` ` = Empty floor

Example (`server/maps/classic.json`):

```
{
	"id": "classic",
	"name": "Classic Arena",
	"layout": [
		"S              S",
		"                ",
		"  N11      11N  ",
		"  1    P     1  ",
		"S 1          1 S",
		"  N          N  ",
		"  N   N11N  P1  ",
		"  1P  N11N   N  ",
		"  N          N  ",
		"S 1          1 S",
		"  1     P    1  ",
		"  N11      11N  ",
		"                ",
		"S              S"
	],
	"author": "Your Name"
}
```

Guidelines:

- All layout strings must be the same length (rectangular grid)
- Map dimensions are derived from layout size × tile size; the tile size is fixed in code
- Include at least 2 `S` tiles for spawn variety; add `P` tiles for powerups
- Save the file with a `.json` extension inside `server/maps/`

Once added, the map appears in the Match Settings “Map” dropdown. No server restart is required if you replace existing files; for new files, restart the server to ensure they’re loaded at startup.
