// server/game_logic/bot_ai.js
const { KNIGHT_RADIUS, WEAPONS, LUNGE_COOLDOWN } = require('../utils/constants');
const { getDistance, isCollidingWithWall } = require('../utils/helpers');
const { handleAttackStart, handleAttackEnd } = require('./weapons');
const { handleLunge } = require('./player');

// Bot name pool (easily updatable)
const BOT_NAMES = [
    'Sir Lancelot', 'Dame Morgan', 'Sir Galahad', 'Lady Guinevere',
    'Sir Percival', 'Dame Elaine', 'Sir Gawain', 'Lady Viviane',
    'Sir Tristan', 'Dame Isolde', 'Sir Bedivere', 'Lady Morgana',
    'Sir Gareth', 'Dame Lynette', 'Sir Kay', 'Lady Enid',
    'Sir Lamorak', 'Dame Laudine', 'Sir Bors', 'Lady Ragnelle'
];

// Difficulty settings
const DIFFICULTY_SETTINGS = {
    easy: {
        reactionDelayMin: 400,
        reactionDelayMax: 600,
        aimError: 0.3,           // radians (~17 degrees)
        decisionRate: 400,        // ms between decisions
        dashChance: 0.3,
        attackAccuracy: 0.7,
        chargePercent: 0.5,       // Bow/grenade charge %
        predictMovement: false
    },
    medium: {
        reactionDelayMin: 200,
        reactionDelayMax: 350,
        aimError: 0.15,          // radians (~9 degrees)
        decisionRate: 250,
        dashChance: 0.6,
        attackAccuracy: 0.85,
        chargePercent: 0.75,
        predictMovement: true
    },
    hard: {
        reactionDelayMin: 100,
        reactionDelayMax: 200,
        aimError: 0.08,          // radians (~5 degrees)
        decisionRate: 150,
        dashChance: 0.8,
        attackAccuracy: 0.95,
        chargePercent: 0.9,
        predictMovement: true
    }
};

// Get random bot name
function getRandomBotName(existingNames = []) {
    const available = BOT_NAMES.filter(name => !existingNames.includes(name));
    if (available.length === 0) {
        return `Knight ${Math.floor(Math.random() * 1000)}`;
    }
    return available[Math.floor(Math.random() * available.length)];
}

// Main bot update function
function updateBots(room, deltaTime) {
    const now = Date.now();
    
    Object.values(room.players).forEach(bot => {
        if (!bot.isAI || !bot.isAlive) return;
        
        // Initialize AI state if needed
        if (!bot.aiState) {
            bot.aiState = 'IDLE';
            bot.aiTarget = null;
            bot.aiDecisionTimer = 0;
            // Add small random initial delay (0-300ms) to stagger bot startup
            bot.aiReactionDelay = now + Math.random() * 300;
            bot.aiLastStateChange = now;
            bot.aiDesiredAngle = bot.angle || 0;
            bot.aiDesiredVx = 0;
            bot.aiDesiredVy = 0;
            bot.aiMemory = {
                lastSeenEnemies: {},
                dangerZones: [],
                incomingProjectiles: [],
                strafeDirection: Math.random() > 0.5 ? 1 : -1,
                lastStrafeChange: now
            };
        }
        
        // Initialize desired values if they don't exist
        if (bot.aiDesiredAngle === undefined) bot.aiDesiredAngle = bot.angle || 0;
        if (bot.aiDesiredVx === undefined) bot.aiDesiredVx = bot.vx || 0;
        if (bot.aiDesiredVy === undefined) bot.aiDesiredVy = bot.vy || 0;
        
        // Decision rate limiting
        const settings = DIFFICULTY_SETTINGS[bot.aiDifficulty] || DIFFICULTY_SETTINGS.medium;
        if (now < bot.aiDecisionTimer + settings.decisionRate) {
            // Still execute movement/aiming between decisions
            if (bot.aiTarget) {
                updateBotMovement(bot, room, settings);
                updateBotAiming(bot, room, settings);
            }
            return;
        }
        
        bot.aiDecisionTimer = now;
        
        // Reaction delay simulation
        if (bot.aiReactionDelay > now) return;
        
        // Main behavior update
        updateBotBehavior(bot, room, settings, now);
        updateBotMovement(bot, room, settings);
        updateBotAiming(bot, room, settings);
        updateBotActions(bot, room, settings, now);
    });
}

// Main behavior state machine
function updateBotBehavior(bot, room, settings, now) {
    const enemies = getEnemies(bot, room);
    const nearestEnemy = getNearestEnemy(bot, enemies);
    const powerups = room.powerups;
    
    // Check for danger zones (grenades, mines)
    updateDangerZones(bot, room);
    
    switch (bot.aiState) {
        case 'IDLE':
            // Look for targets
            const target = selectTarget(bot, room, enemies, powerups);
            if (target) {
                if (target.type === 'enemy') {
                    changeState(bot, 'COMBAT', now);
                    bot.aiTarget = target.entity;
                } else if (target.type === 'powerup') {
                    changeState(bot, 'PICKUP', now);
                    bot.aiTarget = target.entity;
                }
            } else {
                // Patrol if nothing to do
                if (now - bot.aiLastStateChange > 3000) {
                    changeState(bot, 'PATROL', now);
                }
            }
            break;
            
        case 'COMBAT':
            if (!nearestEnemy || getDistance(bot, nearestEnemy) > 600) {
                changeState(bot, 'IDLE', now);
                bot.aiTarget = null;
            } else {
                bot.aiTarget = nearestEnemy;
                
                // Check if should evade
                if (shouldEvade(bot, room, nearestEnemy)) {
                    changeState(bot, 'EVADE', now);
                }
            }
            break;
            
        case 'EVADE':
            // Evade for a short time, then reassess
            if (now - bot.aiLastStateChange > 1500 || !isInDanger(bot, room)) {
                changeState(bot, 'IDLE', now);
                bot.aiTarget = null;
            }
            break;
            
        case 'PICKUP':
            // Check if powerup still exists
            const powerupExists = room.powerups.some(p => p === bot.aiTarget);
            if (!powerupExists) {
                changeState(bot, 'IDLE', now);
                bot.aiTarget = null;
            } else if (nearestEnemy && getDistance(bot, nearestEnemy) < 300) {
                // Enemy too close, abort pickup
                changeState(bot, 'COMBAT', now);
                bot.aiTarget = nearestEnemy;
            }
            break;
            
        case 'PATROL':
            // Pick random patrol point
            if (!bot.aiTarget || getDistance(bot, bot.aiTarget) < 50) {
                bot.aiTarget = getRandomPatrolPoint(room);
            }
            
            // Check for enemies or powerups
            if (nearestEnemy && getDistance(bot, nearestEnemy) < 400) {
                changeState(bot, 'COMBAT', now);
                bot.aiTarget = nearestEnemy;
            }
            break;
    }
}

// Target selection with utility scoring
function selectTarget(bot, room, enemies, powerups) {
    let bestScore = -Infinity;
    let bestTarget = null;
    
    // Score enemies
    enemies.forEach(enemy => {
        if (!enemy.isAlive) return;
        
        const dist = getDistance(bot, enemy);
        if (dist > 600) return; // Too far
        
        const angle = Math.atan2(enemy.y - bot.y, enemy.x - bot.x);
        const angleDiff = Math.abs(normalizeAngle(bot.angle - angle));
        
        let score = 100;
        score -= dist * 0.15;                    // Closer = better
        score -= angleDiff * 15;                 // Already facing = better
        score += enemy.isLunging ? -30 : 0;      // Avoid lunging enemies
        score += enemy.hasShield ? -20 : 0;      // Shields are harder
        score += enemy.weapon.type === 'sword' && bot.weapon.type !== 'sword' ? 20 : 0; // Range advantage
        
        // Team mode considerations
        if (room.matchSettings?.playType === 'team') {
            const myTeamCount = getTeamMateCount(bot, room);
            const enemyTeamCount = getTeamMateCount(enemy, room);
            score += myTeamCount > enemyTeamCount ? 15 : -15;
        }
        
        if (score > bestScore) {
            bestScore = score;
            bestTarget = { type: 'enemy', entity: enemy };
        }
    });
    
    // Score powerups
    powerups.forEach(powerup => {
        const dist = getDistance(bot, powerup);
        if (dist > 500) return; // Too far
        
        let score = 60;
        score -= dist * 0.25;
        
        // Weapon preference based on current weapon
        if (bot.weapon.type === 'sword') {
            score += 50; // Really want any weapon
            
            // BUT: Check if there's a close enemy we could kill with sword first
            const closeVulnerableEnemy = enemies.find(enemy => {
                if (!enemy.isAlive) return false;
                const enemyDist = getDistance(bot, enemy);
                
                // Enemy is close and either unarmed or low health
                if (enemyDist < 150) {
                    const enemyIsUnarmed = enemy.weapon.type === 'sword';
                    const enemyIsLowHealth = enemy.health < 50;
                    const enemyOutOfAmmo = enemy.weapon.ammo <= 0;
                    
                    return enemyIsUnarmed || enemyIsLowHealth || enemyOutOfAmmo;
                }
                return false;
            });
            
            // If we have a tactical sword kill opportunity, deprioritize weapon pickup heavily
            if (closeVulnerableEnemy) {
                score -= 80; // Almost never pick up weapon when we could get a sword kill
            }
        }
        
        // Specific weapon values
        switch (powerup.type) {
            case 'shield': score += 35; break;
            case 'laser': score += 30; break;
            case 'minigun': score += 25; break;
            case 'shotgun': score += 25; break;
            case 'grenade': score += 20; break;
            case 'bow': score += 20; break;
            case 'mine': score += 15; break;
        }
        
        // Lower priority if already have a good weapon
        if (bot.weapon.type !== 'sword' && bot.weapon.ammo > 3) {
            score -= 30;
        }
        
        if (score > bestScore) {
            bestScore = score;
            bestTarget = { type: 'powerup', entity: powerup };
        }
    });
    
    return bestTarget;
}

// Movement update
function updateBotMovement(bot, room, settings) {
    if (!bot.aiTarget) {
        bot.vx = 0;
        bot.vy = 0;
        return;
    }
    
    const now = Date.now();
    let targetX = bot.aiTarget.x;
    let targetY = bot.aiTarget.y;
    
    // Predict enemy movement for medium/hard bots
    if (settings.predictMovement && bot.aiTarget.vx !== undefined) {
        const predictionTime = 0.3; // 300ms lookahead
        targetX += bot.aiTarget.vx * predictionTime * 200;
        targetY += bot.aiTarget.vy * predictionTime * 200;
    }
    
    let dx = targetX - bot.x;
    let dy = targetY - bot.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist < 0.1) {
        bot.vx = 0;
        bot.vy = 0;
        return;
    }
    
    // Normalize
    dx /= dist;
    dy /= dist;
    
    // Add combat strafing
    if (bot.aiState === 'COMBAT' && bot.aiTarget.isAlive !== undefined) {
        const weaponRange = getOptimalRange(bot.weapon.type);
        
        // Change strafe direction periodically
        if (now - bot.aiMemory.lastStrafeChange > 1000) {
            bot.aiMemory.strafeDirection *= -1;
            bot.aiMemory.lastStrafeChange = now;
        }
        
        // Strafe perpendicular to target
        const perpX = -dy;
        const perpY = dx;
        const strafeIntensity = 0.4;
        
        dx += perpX * strafeIntensity * bot.aiMemory.strafeDirection;
        dy += perpY * strafeIntensity * bot.aiMemory.strafeDirection;
        
        // Maintain optimal range
        if (dist < weaponRange * 0.7) {
            // Too close, back up
            dx -= dx * 0.5;
            dy -= dy * 0.5;
        } else if (dist > weaponRange * 1.3) {
            // Too far, close in
            dx *= 1.2;
            dy *= 1.2;
        }
    }
    
    // Evade mode - run away from danger
    if (bot.aiState === 'EVADE') {
        // If evading from projectile, move perpendicular to its path
        if (bot.aiMemory.incomingProjectiles && bot.aiMemory.incomingProjectiles.length > 0) {
            const mostUrgent = bot.aiMemory.incomingProjectiles[0];
            const proj = mostUrgent.projectile;
            
            // Move perpendicular to projectile path
            const perpX = -proj.vy;
            const perpY = proj.vx;
            const perpMag = Math.sqrt(perpX * perpX + perpY * perpY);
            
            if (perpMag > 0) {
                // Determine which perpendicular direction to go
                const toBot = { x: bot.x - proj.x, y: bot.y - proj.y };
                const dotRight = toBot.x * perpX + toBot.y * perpY;
                
                // Move in the direction that's already away from projectile
                const direction = dotRight > 0 ? 1 : -1;
                dx = (perpX / perpMag) * direction;
                dy = (perpY / perpMag) * direction;
            }
        } else {
            // Generic evasion - run away from target
            dx = -dx;
            dy = -dy;
        }
    }
    
    // Avoid danger zones (grenades, mines, projectiles)
    const dangerAvoidance = getDangerAvoidanceVector(bot, room);
    dx += dangerAvoidance.x;
    dy += dangerAvoidance.y;
    
    // Re-normalize
    const mag = Math.sqrt(dx * dx + dy * dy);
    if (mag > 0) {
        bot.aiDesiredVx = dx / mag;
        bot.aiDesiredVy = dy / mag;
    } else {
        bot.aiDesiredVx = 0;
        bot.aiDesiredVy = 0;
    }
    
    // Wall avoidance (modifies desired velocity)
    avoidWalls(bot, room);
    
    // Smooth interpolation (lerp) - reduces jitter
    const smoothing = 0.25; // Lower = smoother but slower response
    bot.vx = bot.vx * (1 - smoothing) + bot.aiDesiredVx * smoothing;
    bot.vy = bot.vy * (1 - smoothing) + bot.aiDesiredVy * smoothing;
}

// Aiming update
function updateBotAiming(bot, room, settings) {
    if (!bot.aiTarget) return;
    
    let targetX = bot.aiTarget.x;
    let targetY = bot.aiTarget.y;
    
    // Predict movement for projectile weapons
    if (bot.aiTarget.vx !== undefined && settings.predictMovement) {
        const projectileSpeed = getProjectileSpeed(bot.weapon.type);
        if (projectileSpeed > 0) {
            const dist = getDistance(bot, bot.aiTarget);
            const timeToHit = dist / projectileSpeed;
            targetX += bot.aiTarget.vx * timeToHit * 200;
            targetY += bot.aiTarget.vy * timeToHit * 200;
        }
    }
    
    // Calculate ideal angle
    let idealAngle = Math.atan2(targetY - bot.y, targetX - bot.x);
    
    // Add aim error based on difficulty (only on new decisions, not every frame)
    if (!bot.aiLastAimUpdate || Date.now() - bot.aiLastAimUpdate > 200) {
        const aimError = (Math.random() - 0.5) * settings.aimError;
        bot.aiDesiredAngle = idealAngle + aimError;
        bot.aiLastAimUpdate = Date.now();
    }
    
    // Smooth angle interpolation to reduce jitter
    const angleDiff = normalizeAngle(bot.aiDesiredAngle - bot.angle);
    const angleSmoothing = 0.3; // Lower = smoother turning
    bot.angle = bot.angle + angleDiff * angleSmoothing;
}

// Action execution (attacking, dashing)
function updateBotActions(bot, room, settings, now) {
    if (!bot.aiTarget || bot.aiState === 'PATROL' || bot.aiState === 'PICKUP') return;
    
    const dist = getDistance(bot, bot.aiTarget);
    const weaponRange = getWeaponRange(bot.weapon.type);
    
    // Decide to attack
    if (bot.aiState === 'COMBAT' && dist < weaponRange) {
        if (Math.random() < settings.attackAccuracy) {
            executeAttack(bot, room, settings, now);
        }
    }
    
    // Decide to dash
    if (shouldDash(bot, room, settings, now)) {
        handleLunge(bot);
    }
}

// Execute weapon-specific attacks
function executeAttack(bot, room, settings, now) {
    const weapon = bot.weapon;
    
    if (now < bot.lastAttackTime + weapon.cooldown) return;
    if (weapon.ammo <= 0) return;
    
    switch (weapon.type) {
        case 'sword':
            handleAttackStart(bot, room);
            break;
            
        case 'bow':
        case 'grenade':
            // Start charging
            if (weapon.type === 'bow' && bot.bowChargeStartTime === 0) {
                handleAttackStart(bot, room);
                
                // Release after charge time
                const chargeTime = weapon.type === 'bow' ? 500 : 1000;
                setTimeout(() => {
                    if (bot.isAlive) {
                        handleAttackEnd(bot, room);
                    }
                }, chargeTime * settings.chargePercent);
            } else if (weapon.type === 'grenade' && bot.grenadeChargeStartTime === 0) {
                handleAttackStart(bot, room);
                
                const chargeTime = 1000;
                setTimeout(() => {
                    if (bot.isAlive) {
                        handleAttackEnd(bot, room);
                    }
                }, chargeTime * settings.chargePercent);
            }
            break;
            
        case 'laser':
            if (bot.laserChargeTime === 0) {
                handleAttackStart(bot, room);
            }
            break;
            
        case 'shotgun':
        case 'minigun':
        case 'mine':
            handleAttackStart(bot, room);
            break;
    }
}

// Decide if bot should dash
function shouldDash(bot, room, settings, now) {
    if (bot.isLunging) return false;
    if (now < bot.lastLungeTime + LUNGE_COOLDOWN) return false;
    
    const target = bot.aiTarget;
    
    // CRITICAL: React to incoming projectiles (bypass random chance)
    if (bot.aiMemory.incomingProjectiles && bot.aiMemory.incomingProjectiles.length > 0) {
        const mostUrgent = bot.aiMemory.incomingProjectiles[0];
        // If projectile will hit within 0.5 seconds and is close, dash immediately
        if (mostUrgent.timeToImpact < 15 && mostUrgent.perpDist < 35) {
            // Set dash direction perpendicular to projectile
            const proj = mostUrgent.projectile;
            const perpAngle = Math.atan2(proj.vy, proj.vx) + Math.PI / 2;
            
            // Choose left or right based on bot's current position relative to projectile path
            const toBot = { x: bot.x - proj.x, y: bot.y - proj.y };
            const projRight = { x: -proj.vy, y: proj.vx }; // Perpendicular right
            const dotRight = toBot.x * projRight.x + toBot.y * projRight.y;
            
            // Dash away from projectile path
            if (dotRight > 0) {
                bot.aiDesiredAngle = perpAngle;
            } else {
                bot.aiDesiredAngle = perpAngle + Math.PI;
            }
            
            return true;
        }
    }
    
    // Standard dash logic with random chance
    if (Math.random() > settings.dashChance) return false;
    
    if (!target) return false;
    const dist = getDistance(bot, target);
    
    // Offensive dash - close distance
    if (bot.aiState === 'COMBAT' && dist > 150 && dist < 400) {
        return bot.weapon.type === 'sword' || bot.weapon.type === 'shotgun';
    }
    
    // Defensive dash - escape danger
    if (bot.aiState === 'EVADE') {
        return true;
    }
    
    return false;
}

// Check if bot should evade
function shouldEvade(bot, room, enemy) {
    // Don't have weapon, enemy does
    if (bot.weapon.type === 'sword' && enemy.weapon.type !== 'sword') {
        return true;
    }
    
    // Enemy is lunging at us
    if (enemy.isLunging) {
        const dist = getDistance(bot, enemy);
        if (dist < 100) return true;
    }
    
    // Multiple enemies nearby
    const nearbyEnemies = getEnemies(bot, room).filter(e => {
        return e.isAlive && getDistance(bot, e) < 300;
    });
    if (nearbyEnemies.length >= 2) return true;
    
    // In danger zone
    if (isInDanger(bot, room)) return true;
    
    return false;
}

// Check if bot is in danger
function isInDanger(bot, room) {
    // Check for incoming projectiles (updated by updateDangerZones)
    if (bot.aiMemory.incomingProjectiles && bot.aiMemory.incomingProjectiles.length > 0) {
        return true;
    }
    
    // Check for nearby grenades
    const dangerousProjectiles = room.projectiles.filter(p => {
        if (p.ownerId === bot.id) return false;
        if (p.type !== 'grenade') return false;
        return getDistance(bot, p) < 120;
    });
    
    if (dangerousProjectiles.length > 0) return true;
    
    // Check for nearby mines
    const nearbyMines = room.mines.filter(m => {
        if (m.ownerId === bot.id) return false;
        const now = Date.now();
        if (now < m.armedTime) return false;
        return getDistance(bot, m) < 80;
    });
    
    return nearbyMines.length > 0;
}

// Helper functions

function getEnemies(bot, room) {
    const isTeamMode = room.matchSettings?.playType === 'team';
    
    return Object.values(room.players).filter(p => {
        if (p.id === bot.id) return false;
        if (!p.isAlive) return false;
        
        if (isTeamMode && !room.matchSettings.friendlyFire) {
            return p.teamId !== bot.teamId;
        }
        
        return true;
    });
}

function getNearestEnemy(bot, enemies) {
    let nearest = null;
    let minDist = Infinity;
    
    enemies.forEach(enemy => {
        const dist = getDistance(bot, enemy);
        if (dist < minDist) {
            minDist = dist;
            nearest = enemy;
        }
    });
    
    return nearest;
}

function getTeamMateCount(player, room) {
    if (room.matchSettings?.playType !== 'team') return 0;
    
    return Object.values(room.players).filter(p => {
        return p.isAlive && p.teamId === player.teamId && p.id !== player.id;
    }).length;
}

function changeState(bot, newState, now) {
    bot.aiState = newState;
    bot.aiLastStateChange = now;
}

function getOptimalRange(weaponType) {
    switch (weaponType) {
        case 'sword': return 60;
        case 'shotgun': return 150;
        case 'bow': return 300;
        case 'minigun': return 300;
        case 'laser': return 450;
        case 'grenade': return 350;
        case 'mine': return 100;
        default: return 200;
    }
}

function getWeaponRange(weaponType) {
    switch (weaponType) {
        case 'sword': return 80;
        case 'shotgun': return 200;
        case 'bow': return 500;
        case 'minigun': return 400;
        case 'laser': return 600;
        case 'grenade': return 450;
        case 'mine': return 150;
        default: return 300;
    }
}

function getProjectileSpeed(weaponType) {
    switch (weaponType) {
        case 'bow': return 20;
        case 'shotgun': return 9;
        case 'minigun': return 12;
        case 'grenade': return 10;
        default: return 0;
    }
}

function getRandomPatrolPoint(room) {
    const mapWidth = room.mapWidth || 1600;
    const mapHeight = room.mapHeight || 1200;
    
    return {
        x: KNIGHT_RADIUS * 2 + Math.random() * (mapWidth - KNIGHT_RADIUS * 4),
        y: KNIGHT_RADIUS * 2 + Math.random() * (mapHeight - KNIGHT_RADIUS * 4)
    };
}

function avoidWalls(bot, room) {
    const lookAhead = 60;
    const futurePos = {
        x: bot.x + bot.aiDesiredVx * lookAhead,
        y: bot.y + bot.aiDesiredVy * lookAhead
    };
    
    if (isCollidingWithWall(futurePos, room.walls)) {
        // Turn 90 degrees (modify desired velocity, not actual)
        const temp = bot.aiDesiredVx;
        bot.aiDesiredVx = -bot.aiDesiredVy * 0.8;
        bot.aiDesiredVy = temp * 0.8;
    }
}

function updateDangerZones(bot, room) {
    bot.aiMemory.dangerZones = [];
    bot.aiMemory.incomingProjectiles = [];
    
    const now = Date.now();
    
    // Check all projectiles for threats
    room.projectiles.forEach(p => {
        if (p.ownerId === bot.id) return;
        
        // Grenades are area threats
        if (p.type === 'grenade') {
            bot.aiMemory.dangerZones.push({ 
                x: p.x, 
                y: p.y, 
                radius: 100,
                type: 'grenade'
            });
            return;
        }
        
        // Check if projectile is heading toward bot
        const toBot = {
            x: bot.x - p.x,
            y: bot.y - p.y
        };
        const distToBot = Math.sqrt(toBot.x * toBot.x + toBot.y * toBot.y);
        
        if (distToBot > 400) return; // Too far to care
        
        // Normalize projectile velocity
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (speed < 0.1) return; // Not moving
        
        const projDir = {
            x: p.vx / speed,
            y: p.vy / speed
        };
        
        // Dot product to check if heading toward bot
        const toBotNorm = {
            x: toBot.x / distToBot,
            y: toBot.y / distToBot
        };
        
        const dotProduct = projDir.x * toBotNorm.x + projDir.y * toBotNorm.y;
        
        // If dotProduct > 0.7, projectile is heading roughly toward bot
        if (dotProduct > 0.7) {
            // Calculate closest approach distance
            const perpDist = Math.abs(toBot.x * projDir.y - toBot.y * projDir.x);
            
            // If it will pass within 40 units, it's a threat
            if (perpDist < 40) {
                const timeToImpact = distToBot / speed;
                
                bot.aiMemory.incomingProjectiles.push({
                    projectile: p,
                    timeToImpact: timeToImpact,
                    perpDist: perpDist,
                    type: p.type
                });
                
                // Add as danger zone for movement avoidance
                bot.aiMemory.dangerZones.push({
                    x: p.x,
                    y: p.y,
                    radius: 50,
                    type: 'projectile',
                    vx: p.vx,
                    vy: p.vy
                });
            }
        }
    });
    
    // Add armed mines
    room.mines.forEach(m => {
        if (m.ownerId !== bot.id && now >= m.armedTime) {
            bot.aiMemory.dangerZones.push({ 
                x: m.x, 
                y: m.y, 
                radius: 80,
                type: 'mine'
            });
        }
    });
    
    // Sort incoming projectiles by time to impact (most urgent first)
    bot.aiMemory.incomingProjectiles.sort((a, b) => a.timeToImpact - b.timeToImpact);
}

function getDangerAvoidanceVector(bot, room) {
    let avoidX = 0;
    let avoidY = 0;
    
    bot.aiMemory.dangerZones.forEach(zone => {
        const dx = bot.x - zone.x;
        const dy = bot.y - zone.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < zone.radius) {
            const strength = 1 - (dist / zone.radius);
            avoidX += (dx / dist) * strength;
            avoidY += (dy / dist) * strength;
        }
    });
    
    return { x: avoidX, y: avoidY };
}

function normalizeAngle(angle) {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
}

module.exports = {
    updateBots,
    getRandomBotName,
    BOT_NAMES,
    DIFFICULTY_SETTINGS
};
