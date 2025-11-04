// public/js/input/gamepadManager.js

/**
 * Gamepad Manager - Handles controller input using the Gamepad API
 * 
 * Xbox Controller Mapping (Standard Gamepad):
 * - Left Stick: Movement (X/Y axes)
 * - Right Stick: Aiming (rotation/direction)
 * - Right Trigger (RT): Attack
 * - A Button: Lunge/Dash
 * - Left Bumper (LB): Shield
 * - Start Button: Pause menu
 * - D-Pad: Alternative movement
 */

class GamepadManager {
    constructor() {
        this.gamepads = {};
        this.connected = false;
        this.deadzone = 0.15; // Prevent stick drift
        this.triggerThreshold = 0.75; // Analog trigger sensitivity (increased to avoid drift)
        
        // Button indices for standard gamepad mapping
        this.buttons = {
            A: 0,           // Bottom face button (A on Xbox, X on PS)
            B: 1,           // Right face button (B on Xbox, Circle on PS)
            X: 2,           // Left face button (X on Xbox, Square on PS)
            Y: 3,           // Top face button (Y on Xbox, Triangle on PS)
            LB: 4,          // Left bumper
            RB: 5,          // Right bumper
            LT: 6,          // Left trigger
            RT: 7,          // Right trigger
            SELECT: 8,      // Select/Back/Share
            START: 9,       // Start/Options/Menu
            L3: 10,         // Left stick press
            R3: 11,         // Right stick press
            DPAD_UP: 12,
            DPAD_DOWN: 13,
            DPAD_LEFT: 14,
            DPAD_RIGHT: 15
        };
        
        // Axis indices
        this.axes = {
            LEFT_STICK_X: 0,
            LEFT_STICK_Y: 1,
            RIGHT_STICK_X: 2,
            RIGHT_STICK_Y: 3
        };
        
        // Track previous button states for edge detection (per controller)
        this.previousButtonStates = {};
        
        this.init();
    }
    
    init() {
        window.addEventListener('gamepadconnected', (e) => {
            console.log(`🎮 Gamepad ${e.gamepad.index} connected: ${e.gamepad.id}`);
            this.gamepads[e.gamepad.index] = e.gamepad;
            this.previousButtonStates[e.gamepad.index] = {};
            this.connected = true;
        });
        
        window.addEventListener('gamepaddisconnected', (e) => {
            console.log(`🎮 Gamepad ${e.gamepad.index} disconnected: ${e.gamepad.id}`);
            delete this.gamepads[e.gamepad.index];
            delete this.previousButtonStates[e.gamepad.index];
            this.connected = Object.keys(this.gamepads).length > 0;
        });
    }
    
    /**
     * Poll gamepad state - must be called each frame
     * Returns input from the first connected gamepad (backward compatibility)
     */
    poll() {
        if (!this.connected) return null;
        
        // Get fresh gamepad state
        const gamepads = navigator.getGamepads();
        for (let i = 0; i < gamepads.length; i++) {
            if (gamepads[i]) {
                this.gamepads[i] = gamepads[i];
            }
        }
        
        // Return first connected gamepad's input
        const gamepad = this.getPrimaryGamepad();
        if (!gamepad) return null;
        
        return this.getInputState(gamepad);
    }
    
    /**
     * Poll specific controller by index
     * @param {number} controllerIndex - The gamepad index (0-3)
     * @returns {Object|null} Input state for the specified controller
     */
    pollController(controllerIndex) {
        // Get fresh gamepad state
        const gamepads = navigator.getGamepads();
        for (let i = 0; i < gamepads.length; i++) {
            if (gamepads[i]) {
                this.gamepads[i] = gamepads[i];
            }
        }
        
        const gamepad = gamepads[controllerIndex];
        if (!gamepad || !gamepad.connected) return null;
        
        return this.getInputState(gamepad, controllerIndex);
    }
    
    /**
     * Get all connected controllers with their input states
     * @returns {Array} Array of {index, gamepad, input} objects
     */
    getAllConnectedControllers() {
        // Get fresh gamepad state
        const gamepads = navigator.getGamepads();
        const controllers = [];
        
        for (let i = 0; i < gamepads.length; i++) {
            if (gamepads[i] && gamepads[i].connected) {
                this.gamepads[i] = gamepads[i];
                controllers.push({
                    index: i,
                    id: gamepads[i].id,
                    gamepad: gamepads[i],
                    input: this.getInputState(gamepads[i], i)
                });
            }
        }
        
        return controllers;
    }
    
    /**
     * Get the primary (first) connected gamepad
     */
    getPrimaryGamepad() {
        for (const index in this.gamepads) {
            const gamepad = this.gamepads[index];
            if (gamepad && gamepad.connected) {
                return gamepad;
            }
        }
        return null;
    }
    
    /**
     * Apply deadzone to analog stick values
     */
    applyDeadzone(value) {
        if (Math.abs(value) < this.deadzone) return 0;
        // Remap to remove deadzone gap
        const sign = Math.sign(value);
        return sign * ((Math.abs(value) - this.deadzone) / (1 - this.deadzone));
    }
    
    /**
     * Get current input state from gamepad
     * @param {Gamepad} gamepad - The gamepad object
     * @param {number} controllerIndex - The controller index for button state tracking
     * @returns {Object} Input state object
     */
    getInputState(gamepad, controllerIndex = null) {
        const axes = gamepad.axes;
        const buttons = gamepad.buttons;
        const index = controllerIndex !== null ? controllerIndex : gamepad.index;
        
        // Initialize button state tracking for this controller if needed
        if (!this.previousButtonStates[index]) {
            this.previousButtonStates[index] = {};
        }
        
        // Movement from left stick
        const moveX = this.applyDeadzone(axes[this.axes.LEFT_STICK_X]);
        const moveY = this.applyDeadzone(axes[this.axes.LEFT_STICK_Y]);
        
        // Aiming from right stick
        const aimX = this.applyDeadzone(axes[this.axes.RIGHT_STICK_X]);
        const aimY = this.applyDeadzone(axes[this.axes.RIGHT_STICK_Y]);
        
        // Check if button was just pressed (edge detection)
        const wasPressed = (buttonIndex) => {
            const currentlyPressed = buttons[buttonIndex]?.pressed || false;
            const previouslyPressed = this.previousButtonStates[index][buttonIndex] || false;
            this.previousButtonStates[index][buttonIndex] = currentlyPressed;
            return currentlyPressed && !previouslyPressed;
        };
        
        // Check if button was just released (edge detection)
        const wasReleased = (buttonIndex) => {
            const currentlyPressed = buttons[buttonIndex]?.pressed || false;
            const previouslyPressed = this.previousButtonStates[index][buttonIndex] || false;
            // Don't update state here - wasPressed already did it
            return !currentlyPressed && previouslyPressed;
        };
        
        // Check if button is currently held
        const isHeld = (buttonIndex) => {
            return buttons[buttonIndex]?.pressed || false;
        };
        
        // Get analog trigger value (0 to 1)
        const getTriggerValue = (buttonIndex) => {
            return buttons[buttonIndex]?.value || 0;
        };
        
        // For triggers, we need special handling since they can be analog
        const rtValue = getTriggerValue(this.buttons.RT);
        const rtButtonPressed = buttons[this.buttons.RT]?.pressed || false; // Browser's own threshold
        // Just use the browser's pressed state - it handles different controllers properly
        const currentTriggerPressed = rtButtonPressed;
        const previousTriggerPressed = this.previousButtonStates[index][this.buttons.RT] || false;
        const triggerPressed = currentTriggerPressed && !previousTriggerPressed;
        const triggerReleased = !currentTriggerPressed && previousTriggerPressed;
        
        // Update state AFTER calculating edges
        this.previousButtonStates[index][this.buttons.RT] = currentTriggerPressed;
        
        const result = {
            // Movement (left stick or D-pad)
            moveX: moveX || (isHeld(this.buttons.DPAD_RIGHT) ? 1 : 0) - (isHeld(this.buttons.DPAD_LEFT) ? 1 : 0),
            moveY: moveY || (isHeld(this.buttons.DPAD_DOWN) ? 1 : 0) - (isHeld(this.buttons.DPAD_UP) ? 1 : 0),
            
            // Aiming (right stick)
            aimX: aimX,
            aimY: aimY,
            hasAimInput: Math.abs(aimX) > 0 || Math.abs(aimY) > 0,
            
            // Actions
            attack: currentTriggerPressed,
            attackPressed: triggerPressed,
            attackReleased: triggerReleased,
            
            lunge: wasPressed(this.buttons.RB),
            lungeHeld: isHeld(this.buttons.RB),
            
            shield: isHeld(this.buttons.LB),
            
            pause: wasPressed(this.buttons.START),
            
            // Raw button states for debugging
            buttons: buttons.map(b => b.pressed),
            axes: axes
        };
        
        return result;
    }
    
    /**
     * Check if any gamepad is connected
     */
    isConnected() {
        return this.connected;
    }
    
    /**
     * Get connected gamepad info
     */
    getGamepadInfo() {
        const gamepad = this.getPrimaryGamepad();
        if (!gamepad) return null;
        
        return {
            id: gamepad.id,
            index: gamepad.index,
            mapping: gamepad.mapping,
            buttons: gamepad.buttons.length,
            axes: gamepad.axes.length
        };
    }
    
    /**
     * Vibrate/rumble the controller (if supported)
     */
    vibrate(duration = 200, weakMagnitude = 0.5, strongMagnitude = 0.5) {
        const gamepad = this.getPrimaryGamepad();
        if (gamepad && gamepad.vibrationActuator) {
            gamepad.vibrationActuator.playEffect('dual-rumble', {
                duration: duration,
                weakMagnitude: weakMagnitude,
                strongMagnitude: strongMagnitude
            });
        }
    }
}

// Export singleton instance
export const gamepadManager = new GamepadManager();
