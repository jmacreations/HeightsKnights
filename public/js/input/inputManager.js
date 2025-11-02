// public/js/input/inputManager.js

/**
 * Input Manager - Aggregates and manages all input sources
 * Handles keyboard, mouse, and multiple gamepads for local multiplayer
 */

import { gamepadManager } from './gamepadManager.js';

class InputManager {
    constructor() {
        // Keyboard state
        this.keys = {};
        
        // Mouse state
        this.mouse = {
            x: 0,
            y: 0,
            down: false,
            canvasX: 0,
            canvasY: 0
        };
        
        // Track last input method used
        this.lastKeyboardInput = 0;
        this.lastMouseInput = 0;
        
        // Controller assignments for local players
        // { playerId: { inputMethod: 'keyboard'|'gamepad', controllerIndex: number|null } }
        this.playerInputAssignments = {};
        
        this.init();
    }
    
    init() {
        // Keyboard listeners
        document.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            this.lastKeyboardInput = Date.now();
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
        
        // Mouse listeners (will be attached to canvas)
        this.mouseListeners = {
            move: null,
            down: null,
            up: null
        };
    }
    
    /**
     * Attach mouse listeners to a specific canvas
     * @param {HTMLCanvasElement} canvas - The game canvas element
     */
    attachMouseToCanvas(canvas) {
        if (!canvas) return;
        
        // Remove old listeners if they exist
        this.detachMouse();
        
        // Mouse move
        this.mouseListeners.move = (e) => {
            const rect = canvas.getBoundingClientRect();
            this.mouse.x = e.clientX - rect.left;
            this.mouse.y = e.clientY - rect.top;
            this.mouse.canvasX = (this.mouse.x / rect.width) * canvas.width;
            this.mouse.canvasY = (this.mouse.y / rect.height) * canvas.height;
            this.lastMouseInput = Date.now();
        };
        
        // Mouse down
        this.mouseListeners.down = (e) => {
            this.mouse.down = true;
            this.lastMouseInput = Date.now();
        };
        
        // Mouse up
        this.mouseListeners.up = (e) => {
            this.mouse.down = false;
        };
        
        canvas.addEventListener('mousemove', this.mouseListeners.move);
        canvas.addEventListener('mousedown', this.mouseListeners.down);
        canvas.addEventListener('mouseup', this.mouseListeners.up);
    }
    
    /**
     * Detach mouse listeners
     */
    detachMouse() {
        if (this.mouseListeners.move) {
            document.removeEventListener('mousemove', this.mouseListeners.move);
            document.removeEventListener('mousedown', this.mouseListeners.down);
            document.removeEventListener('mouseup', this.mouseListeners.up);
        }
    }
    
    /**
     * Get keyboard + mouse input as a unified input object
     * @param {Object} playerPosition - Player's current position {x, y} for angle calculation
     * @returns {Object} Input state matching gamepad format
     */
    getKeyboardMouseInput(playerPosition = { x: 0, y: 0 }) {
        // Movement from keyboard
        let vx = 0;
        let vy = 0;
        
        if (this.keys['KeyW'] || this.keys['ArrowUp']) vy = -1;
        if (this.keys['KeyS'] || this.keys['ArrowDown']) vy = 1;
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) vx = -1;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) vx = 1;
        
        // Normalize movement vector
        const mag = Math.sqrt(vx * vx + vy * vy);
        if (mag > 0) {
            vx /= mag;
            vy /= mag;
        }
        
        // Calculate aim angle from mouse position
        const aimAngle = Math.atan2(
            this.mouse.canvasY - playerPosition.y,
            this.mouse.canvasX - playerPosition.x
        );
        
        // Convert to aim components (for consistency with gamepad)
        const aimX = Math.cos(aimAngle);
        const aimY = Math.sin(aimAngle);
        
        return {
            // Movement
            moveX: vx,
            moveY: vy,
            
            // Aiming (from mouse)
            aimX: aimX,
            aimY: aimY,
            aimAngle: aimAngle,
            hasAimInput: true, // Mouse always provides aim
            
            // Actions
            attack: this.mouse.down,
            attackPressed: false, // Would need edge detection
            attackReleased: false,
            
            lunge: this.keys['Space'] || false,
            lungeHeld: this.keys['Space'] || false,
            
            shield: this.keys['ShiftLeft'] || this.keys['ShiftRight'] || false,
            
            pause: this.keys['Escape'] || false,
            
            // Metadata
            inputMethod: 'keyboard'
        };
    }
    
    /**
     * Assign an input method to a local player
     * @param {string} playerId - Local player ID
     * @param {string} inputMethod - 'keyboard' or 'gamepad'
     * @param {number|null} controllerIndex - Gamepad index (null for keyboard)
     */
    assignInputToPlayer(playerId, inputMethod, controllerIndex = null) {
        this.playerInputAssignments[playerId] = {
            inputMethod: inputMethod,
            controllerIndex: controllerIndex
        };
    }
    
    /**
     * Remove input assignment for a player
     * @param {string} playerId - Local player ID
     */
    unassignPlayerInput(playerId) {
        delete this.playerInputAssignments[playerId];
    }
    
    /**
     * Get input for a specific local player
     * @param {string} playerId - Local player ID
     * @param {Object} playerData - Player's current data from server {x, y, ...}
     * @returns {Object|null} Input state with vx, vy, angle, actions or null if no assignment
     */
    getPlayerInput(playerId, playerData = { x: 0, y: 0 }) {
        const assignment = this.playerInputAssignments[playerId];
        if (!assignment) return null;
        
        let rawInput;
        if (assignment.inputMethod === 'keyboard') {
            rawInput = this.getKeyboardMouseInput({ x: playerData.x, y: playerData.y });
        } else if (assignment.inputMethod === 'gamepad') {
            rawInput = gamepadManager.pollController(assignment.controllerIndex);
        }
        
        if (!rawInput) return null;
        
        // Convert raw input to game input format
        let vx = rawInput.moveX || 0;
        let vy = rawInput.moveY || 0;
        
        // Normalize movement
        const mag = Math.sqrt(vx * vx + vy * vy);
        if (mag > 0) {
            vx /= mag;
            vy /= mag;
        }
        
        // Calculate angle
        let angle;
        if (rawInput.hasAimInput) {
            angle = Math.atan2(rawInput.aimY, rawInput.aimX);
        } else {
            // No aim input, use last known angle or default to right
            angle = rawInput.aimAngle || 0;
        }
        
        return {
            vx: vx,
            vy: vy,
            angle: angle,
            attackStart: rawInput.attackPressed || false,
            attackEnd: rawInput.attackReleased || false,
            lunge: rawInput.lunge || false,
            shieldHeld: rawInput.shield || false
        };
    }
    
    /**
     * Get inputs for all assigned local players
     * @param {Array} localPlayers - Array of local player objects with {id, position}
     * @returns {Array} Array of {playerId, input} objects
     */
    getAllPlayerInputs(localPlayers = []) {
        return localPlayers.map(player => {
            return {
                playerId: player.id,
                input: this.getPlayerInput(player.id, player.position || { x: 0, y: 0 })
            };
        }).filter(item => item.input !== null);
    }
    
    /**
     * Check if keyboard has been used recently (within last 100ms)
     * @returns {boolean}
     */
    isKeyboardActive() {
        return (Date.now() - this.lastKeyboardInput) < 100;
    }
    
    /**
     * Check if mouse has been used recently (within last 100ms)
     * @returns {boolean}
     */
    isMouseActive() {
        return (Date.now() - this.lastMouseInput) < 100;
    }
    
    /**
     * Get available input methods
     * @returns {Array} Array of available input methods
     */
    getAvailableInputMethods() {
        const methods = [
            { type: 'keyboard', index: null, name: 'Keyboard + Mouse', available: true }
        ];
        
        // Add all connected gamepads
        const controllers = gamepadManager.getAllConnectedControllers();
        controllers.forEach(controller => {
            methods.push({
                type: 'gamepad',
                index: controller.index,
                name: `Controller ${controller.index + 1}`,
                id: controller.id,
                available: true
            });
        });
        
        return methods;
    }
    
    /**
     * Check if an input method is already assigned
     * @param {string} inputMethod - 'keyboard' or 'gamepad'
     * @param {number|null} controllerIndex - Gamepad index
     * @returns {boolean}
     */
    isInputMethodAssigned(inputMethod, controllerIndex = null) {
        return Object.values(this.playerInputAssignments).some(assignment => {
            if (inputMethod === 'keyboard') {
                return assignment.inputMethod === 'keyboard';
            } else {
                return assignment.inputMethod === 'gamepad' && assignment.controllerIndex === controllerIndex;
            }
        });
    }
    
    /**
     * Clear all input assignments
     */
    clearAllAssignments() {
        this.playerInputAssignments = {};
    }
}

// Export singleton instance
export const inputManager = new InputManager();
