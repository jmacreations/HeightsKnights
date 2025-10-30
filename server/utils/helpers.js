// server/utils/helpers.js
const { KNIGHT_RADIUS } = require('./constants');

// Calculates the distance between two objects with x, y properties.
function getDistance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

// Checks if a circular position (with radius buffer) is colliding with any wall in the provided list.
// Uses circle-rectangle collision detection for accurate circular hitbox.
function isCollidingWithWall(pos, walls, buffer = KNIGHT_RADIUS) {
    for (const wall of walls) {
        // Find the closest point on the wall rectangle to the circle center
        const closestX = Math.max(wall.x, Math.min(pos.x, wall.x + wall.width));
        const closestY = Math.max(wall.y, Math.min(pos.y, wall.y + wall.height));
        
        // Calculate distance from circle center to this closest point
        const distanceX = pos.x - closestX;
        const distanceY = pos.y - closestY;
        const distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);
        
        // Check if the distance is less than the circle's radius (buffer)
        if (distanceSquared < (buffer * buffer)) {
            return true;
        }
    }
    return false;
}

module.exports = { getDistance, isCollidingWithWall };