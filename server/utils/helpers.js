// server/utils/helpers.js
const { KNIGHT_RADIUS } = require('./constants');

// Calculates the distance between two objects with x, y properties.
function getDistance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

// Checks if a position is colliding with any wall in the provided list.
function isCollidingWithWall(pos, walls, buffer = KNIGHT_RADIUS) {
    for (const wall of walls) {
        if (
            pos.x > wall.x - buffer &&
            pos.x < wall.x + wall.width + buffer &&
            pos.y > wall.y - buffer &&
            pos.y < wall.y + wall.height + buffer
        ) {
            return true;
        }
    }
    return false;
}

module.exports = { getDistance, isCollidingWithWall };