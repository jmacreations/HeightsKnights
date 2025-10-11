// server/utils/constants.js
const KNIGHT_RADIUS = 20;
const KNIGHT_SPEED = 5;
const LUNGE_SPEED_MULTIPLIER = 3;
const LUNGE_DURATION = 250;
const LUNGE_COOLDOWN = 2000;
const WALL_SIZE = 50;
const WALL_HEALTH = 3;
const SCORE_TO_WIN = 5;
const SHIELD_MAX_ENERGY = 5000;

const WEAPONS = {
    sword: { type: 'sword', cooldown: 300, range: 45, arc: Math.PI / 2, duration: 150, parryDuration: 100, ammo: Infinity },
    bow: { type: 'bow', cooldown: 425, ammo: 5 },
    shotgun: { type: 'shotgun', cooldown: 800, count: 5, spread: 0.5, recoil: 10, ammo: 6 },
    laser: { type: 'laser', cooldown: 2000, chargeTime: 800, ammo: 2 },
    minigun: { type: 'minigun', cooldown: 80, speedPenalty: 0.8, ammo: 30 }
};

const POWERUP_SPAWN_DELAY = 10000;
const POWERUP_TYPES = ['bow', 'shotgun', 'laser', 'minigun', 'shield'];
const POWERUP_DROP_RATES_RAW = { bow: 20, shotgun: 35, laser: 5, minigun: 10, shield: 20 };
const POWERUP_DROP_TABLE = [];
for (const type in POWERUP_DROP_RATES_RAW) {
    for (let i = 0; i < POWERUP_DROP_RATES_RAW[type]; i++) {
        POWERUP_DROP_TABLE.push(type);
    }
}

const MAP_LAYOUT = [
    "S              S", " P            P ", "  111      111  ", "  1        1    ",
    "S 1        1  S ", "                ", "      1111      ", "      1111      ",
    "                ", "S 1        1  S ", "  1        1    ", "  111      111  ",
    " P            P ", "S              S",
];
const MAP_WIDTH = MAP_LAYOUT[0].length * WALL_SIZE;
const MAP_HEIGHT = MAP_LAYOUT.length * WALL_SIZE;

module.exports = {
    KNIGHT_RADIUS, KNIGHT_SPEED, LUNGE_SPEED_MULTIPLIER, LUNGE_DURATION, LUNGE_COOLDOWN,
    WALL_SIZE, WALL_HEALTH, SCORE_TO_WIN, SHIELD_MAX_ENERGY, WEAPONS, POWERUP_SPAWN_DELAY,
    POWERUP_DROP_TABLE, MAP_LAYOUT, MAP_WIDTH, MAP_HEIGHT
};