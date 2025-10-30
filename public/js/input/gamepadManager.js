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
        this.triggerThreshold = 0.1; // Analog trigger sensitivity
        
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
        
        // Track previous button states for edge detection
        this.previousButtonStates = {};
        
        this.init();
    }
    
    init() {
        window.addEventListener('gamepadconnected', (e) => {
            console.log(`🎮 Gamepad connected: ${e.gamepad.id}`);
            this.gamepads[e.gamepad.index] = e.gamepad;
            this.connected = true;
        });
        
        window.addEventListener('gamepaddisconnected', (e) => {
            console.log(`🎮 Gamepad disconnected: ${e.gamepad.id}`);
            delete this.gamepads[e.gamepad.index];
            this.connected = Object.keys(this.gamepads).length > 0;
        });
    }
    
    /**
     * Poll gamepad state - must be called each frame
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
     */
    getInputState(gamepad) {
        const axes = gamepad.axes;
        const buttons = gamepad.buttons;
        
        // Movement from left stick
        const moveX = this.applyDeadzone(axes[this.axes.LEFT_STICK_X]);
        const moveY = this.applyDeadzone(axes[this.axes.LEFT_STICK_Y]);
        
        // Aiming from right stick
        const aimX = this.applyDeadzone(axes[this.axes.RIGHT_STICK_X]);
        const aimY = this.applyDeadzone(axes[this.axes.RIGHT_STICK_Y]);
        
        // Check if button was just pressed (edge detection)
        const wasPressed = (buttonIndex) => {
            const currentlyPressed = buttons[buttonIndex]?.pressed || false;
            const previouslyPressed = this.previousButtonStates[buttonIndex] || false;
            this.previousButtonStates[buttonIndex] = currentlyPressed;
            return currentlyPressed && !previouslyPressed;
        };
        
        // Check if button is currently held
        const isHeld = (buttonIndex) => {
            return buttons[buttonIndex]?.pressed || false;
        };
        
        // Get analog trigger value (0 to 1)
        const getTriggerValue = (buttonIndex) => {
            return buttons[buttonIndex]?.value || 0;
        };
        
        return {
            // Movement (left stick or D-pad)
            moveX: moveX || (isHeld(this.buttons.DPAD_RIGHT) ? 1 : 0) - (isHeld(this.buttons.DPAD_LEFT) ? 1 : 0),
            moveY: moveY || (isHeld(this.buttons.DPAD_DOWN) ? 1 : 0) - (isHeld(this.buttons.DPAD_UP) ? 1 : 0),
            
            // Aiming (right stick)
            aimX: aimX,
            aimY: aimY,
            hasAimInput: Math.abs(aimX) > 0 || Math.abs(aimY) > 0,
            
            // Actions
            attack: getTriggerValue(this.buttons.RT) > this.triggerThreshold,
            attackPressed: wasPressed(this.buttons.RT),
            attackReleased: !isHeld(this.buttons.RT) && this.previousButtonStates[this.buttons.RT],
            
            lunge: wasPressed(this.buttons.A),
            lungeHeld: isHeld(this.buttons.A),
            
            shield: isHeld(this.buttons.LB),
            
            pause: wasPressed(this.buttons.START),
            
            // Raw button states for debugging
            buttons: buttons.map(b => b.pressed),
            axes: axes
        };
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
