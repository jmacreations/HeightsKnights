// public/js/input/localPlayerManager.js

/**
 * Local Player Manager - Tracks multiple local players for local multiplayer
 * Manages player data, input assignments, and player lifecycle
 */

import { inputManager } from './inputManager.js';

class LocalPlayerManager {
    constructor() {
        this.localPlayers = [];
        this.maxLocalPlayers = 4;
        this.availableColors = ['#4ade80', '#f87171', '#60aeff', '#fbbf24', '#a78bfa', '#f472b6', '#6134d3ff', '#9ca3af'];
        this.usedColors = new Set();
    }
    
    /**
     * Add a local player
     * @param {Object} config - Player configuration
     * @param {string} config.name - Player name
     * @param {string} config.inputMethod - 'keyboard' or 'gamepad'
     * @param {number|null} config.controllerIndex - Gamepad index (null for keyboard)
     * @param {string} config.socketId - Parent socket ID
     * @param {string} config.color - Optional color (auto-assigned if not provided)
     * @returns {Object|null} Created player object or null if limit reached
     */
    addLocalPlayer(config) {
        if (this.localPlayers.length >= this.maxLocalPlayers) {
            console.warn('Maximum local players reached');
            return null;
        }
        
        const localIndex = this.localPlayers.length;
        const playerId = `${config.socketId}-${localIndex}`;
        
        // Assign color
        const color = config.color || this.getNextAvailableColor();
        this.usedColors.add(color);
        
        const player = {
            id: playerId,
            socketId: config.socketId,
            localIndex: localIndex,
            name: config.name || `Player ${localIndex + 1}`,
            color: color,
            inputMethod: config.inputMethod,
            controllerIndex: config.controllerIndex,
            position: { x: 0, y: 0 },
            isAlive: true,
            score: 0
        };
        
        this.localPlayers.push(player);
        
        // Assign input to this player
        inputManager.assignInputToPlayer(playerId, config.inputMethod, config.controllerIndex);
        
        console.log(`Local player added: ${player.name} (${player.inputMethod}${config.controllerIndex !== null ? ' ' + config.controllerIndex : ''})`);
        
        return player;
    }
    
    /**
     * Remove a local player
     * @param {string} playerId - Player ID to remove
     * @returns {boolean} True if removed successfully
     */
    removeLocalPlayer(playerId) {
        const index = this.localPlayers.findIndex(p => p.id === playerId);
        if (index === -1) return false;
        
        const player = this.localPlayers[index];
        
        // Release color
        this.usedColors.delete(player.color);
        
        // Remove input assignment
        inputManager.unassignPlayerInput(playerId);
        
        // Remove player
        this.localPlayers.splice(index, 1);
        
        // Re-index remaining players
        this.localPlayers.forEach((p, i) => {
            p.localIndex = i;
            // Update player ID to reflect new index
            const oldId = p.id;
            p.id = `${p.socketId}-${i}`;
            
            // Update input assignment with new ID
            if (oldId !== p.id) {
                inputManager.unassignPlayerInput(oldId);
                inputManager.assignInputToPlayer(p.id, p.inputMethod, p.controllerIndex);
            }
        });
        
        console.log(`Local player removed: ${player.name}`);
        
        return true;
    }
    
    /**
     * Get all local players
     * @returns {Array} Array of local player objects
     */
    getAllPlayers() {
        return [...this.localPlayers];
    }
    
    /**
     * Get a specific local player by ID
     * @param {string} playerId - Player ID
     * @returns {Object|null} Player object or null
     */
    getPlayer(playerId) {
        return this.localPlayers.find(p => p.id === playerId) || null;
    }
    
    /**
     * Get local player count
     * @returns {number} Number of local players
     */
    getPlayerCount() {
        return this.localPlayers.length;
    }
    
    /**
     * Check if can add more players
     * @returns {boolean} True if under limit
     */
    canAddPlayer() {
        return this.localPlayers.length < this.maxLocalPlayers;
    }
    
    /**
     * Update player position (for input calculation)
     * @param {string} playerId - Player ID
     * @param {Object} position - New position {x, y}
     */
    updatePlayerPosition(playerId, position) {
        const player = this.getPlayer(playerId);
        if (player) {
            player.position = position;
        }
    }
    
    /**
     * Get input for all local players
     * @returns {Array} Array of {playerId, input} objects
     */
    getAllPlayerInputs() {
        return inputManager.getAllPlayerInputs(this.localPlayers);
    }
    
    /**
     * Get next available color
     * @returns {string} Hex color code
     */
    getNextAvailableColor() {
        for (const color of this.availableColors) {
            if (!this.usedColors.has(color)) {
                return color;
            }
        }
        // If all colors used, return a random one
        return this.availableColors[Math.floor(Math.random() * this.availableColors.length)];
    }
    
    /**
     * Check if an input method is already assigned
     * @param {string} inputMethod - 'keyboard' or 'gamepad'
     * @param {number|null} controllerIndex - Gamepad index
     * @returns {boolean} True if already assigned
     */
    isInputMethodAssigned(inputMethod, controllerIndex = null) {
        return this.localPlayers.some(player => {
            if (inputMethod === 'keyboard') {
                return player.inputMethod === 'keyboard';
            } else {
                return player.inputMethod === 'gamepad' && player.controllerIndex === controllerIndex;
            }
        });
    }
    
    /**
     * Clear all local players
     */
    clearAllPlayers() {
        this.localPlayers.forEach(player => {
            inputManager.unassignPlayerInput(player.id);
        });
        this.localPlayers = [];
        this.usedColors.clear();
        console.log('All local players cleared');
    }
    
    /**
     * Get local player IDs
     * @returns {Array<string>} Array of player IDs
     */
    getPlayerIds() {
        return this.localPlayers.map(p => p.id);
    }
    
    /**
     * Check if player ID is a local player
     * @param {string} playerId - Player ID to check
     * @returns {boolean} True if local player
     */
    isLocalPlayer(playerId) {
        return this.localPlayers.some(p => p.id === playerId);
    }
    
    /**
     * Get player data formatted for server
     * @returns {Array} Array of player data objects
     */
    getPlayersForServer() {
        return this.localPlayers.map(player => ({
            id: player.id,
            socketId: player.socketId,
            localIndex: player.localIndex,
            name: player.name,
            color: player.color,
            inputMethod: player.inputMethod,
            controllerIndex: player.controllerIndex
        }));
    }
    
    /**
     * Update player from server data
     * @param {string} playerId - Player ID
     * @param {Object} serverData - Server player data
     */
    updateFromServer(playerId, serverData) {
        const player = this.getPlayer(playerId);
        if (player) {
            // Update relevant fields from server
            if (serverData.position) player.position = serverData.position;
            if (serverData.isAlive !== undefined) player.isAlive = serverData.isAlive;
            if (serverData.score !== undefined) player.score = serverData.score;
        }
    }
}

// Export singleton instance
export const localPlayerManager = new LocalPlayerManager();
