// public/js/config.js

export const GAME_MODES = {
    deathmatch: {
        id: 'deathmatch',
        name: 'Deathmatch',
        description: 'Classic free-for-all combat. Last knight standing wins!',
        minPlayers: 2,
        maxPlayers: 8,
        available: true
    },
    teamBattle: {
        id: 'teamBattle',
        name: 'Team Battle',
        description: 'Fight in teams! Coordinate with your allies to defeat the enemy.',
        minPlayers: 2,
        maxPlayers: 8,
        available: true // Now available!
    },
    captureTheFlag: {
        id: 'captureTheFlag',
        name: 'Capture the Flag',
        description: 'Capture the enemy flag and bring it back to your base.',
        minPlayers: 4,
        maxPlayers: 8,
        available: false // Will be available in future update
    }
};

export const WIN_TYPES = {
    LAST_KNIGHT_STANDING: {
        id: 'LAST_KNIGHT_STANDING',
        name: 'Last Knight Standing',
        description: 'One life per round. Last knight alive scores a point.',
        requiresScoreTarget: true,
        requiresTimeLimit: false,
        autoRespawn: false
    },
    KILL_BASED: {
        id: 'KILL_BASED',
        name: 'Kill Based',
        description: 'First to reach the kill target wins. Auto-respawn enabled.',
        requiresScoreTarget: true,
        requiresTimeLimit: false,
        autoRespawn: true
    },
    TIME_BASED: {
        id: 'TIME_BASED',
        name: 'Time Based',
        description: 'Most kills when time runs out wins. Auto-respawn enabled.',
        requiresScoreTarget: false,
        requiresTimeLimit: true,
        autoRespawn: true
    }
};

export const WEAPONS_CONFIG = {
    sword: { name: 'Sword', color: '#ffffffff' },
    bow: { name: 'Bow', color: '#904d00ff', ammo: 20 },
    shotgun: { name: 'Shotgun', color: '#fb923c', ammo: 12 },
    laser: { name: 'Laser', color: '#ff0000ff', ammo: 2 },
    minigun: { name: 'Minigun', color: '#9ca3af', ammo: 60 },
    grenade: { name: 'Grenade', color: '#22984dff', ammo: 3 },
    mine: { name: 'Mine', color: '#e5ff00ff', ammo: 1 },
    shield: { name: 'Shield', color: '#a1e3ffff' }
};

export const KNIGHT_RADIUS = 20;
export const WALL_SIZE = 50;
export const SHIELD_MAX_ENERGY = 5000;
export const INVULNERABILITY_DURATION = 1500;
export const RESPAWN_DELAY = 2000;