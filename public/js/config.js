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
        minPlayers: 4,
        maxPlayers: 8,
        available: false // Will be available in future update
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

export const WEAPONS_CONFIG = {
    sword: { name: 'Sword', color: '#d1d5db' },
    bow: { name: 'Bow', color: '#facc15', ammo: 20 },
    shotgun: { name: 'Shotgun', color: '#fb923c', ammo: 12 },
    laser: { name: 'Laser', color: '#f87171', ammo: 2 },
    minigun: { name: 'Minigun', color: '#9ca3af', ammo: 60 },
    grenade: { name: 'Grenade', color: '#22c55e', ammo: 3 },
    shield: { name: 'Shield', color: '#38bdf8' }
};

export const KNIGHT_RADIUS = 20;
export const WALL_SIZE = 50;
export const SHIELD_MAX_ENERGY = 5000;