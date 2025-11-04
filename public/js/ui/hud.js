// public/js/ui/hud.js
import { WEAPONS_CONFIG } from '../config.js';
import { gamepadManager } from '../input/gamepadManager.js';
import { localPlayerManager } from '../input/localPlayerManager.js';

export function updateHud() {
    const playerHud = document.getElementById('player-hud');
    if (!playerHud) return;

    const localPlayers = localPlayerManager.getAllPlayers();
    
    // If we have local players, show HUD for all of them
    if (localPlayers.length > 0) {
        updateLocalPlayersHud(playerHud, localPlayers);
    } else {
        // Single player mode (backward compatibility)
        updateSinglePlayerHud(playerHud);
    }
}

/**
 * Update HUD for single player (backward compatibility)
 */
function updateSinglePlayerHud(playerHud) {
    const me = gameState.players?.[myId];
    if (!me) {
        playerHud.classList.add('hidden');
        return;
    }

    let hudText = `Weapon: ${WEAPONS_CONFIG[me.weapon.type]?.name || 'Sword'}`;
    if (me.weapon.ammo !== Infinity && me.weapon.ammo != null) {
        hudText += ` (${me.weapon.ammo})`;
    }
    if (me.hasShield) {
        const shieldSeconds = (me.shieldEnergy / 1000).toFixed(1);
        hudText += ` | Shield: ${shieldSeconds}s`;
    }
    
    // Show timer for time-based mode
    const winType = gameState.matchSettings?.winType;
    if (winType === 'TIME_BASED' && window.gameRemainingTime !== undefined) {
        const minutes = Math.floor(window.gameRemainingTime / 60000);
        const seconds = Math.floor((window.gameRemainingTime % 60000) / 1000);
        hudText += ` | Time: ${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    
    // Show controller indicator if connected
    if (gamepadManager.isConnected()) {
        hudText += ' | 🎮';
    }
    
    playerHud.textContent = hudText;
    playerHud.classList.remove('hidden');
}

/**
 * Update HUD for multiple local players
 */
function updateLocalPlayersHud(playerHud, localPlayers) {
    playerHud.innerHTML = ''; // Clear existing content
    playerHud.classList.remove('hidden');
    
    // Show timer for time-based mode at the top
    const winType = gameState.matchSettings?.winType;
    if (winType === 'TIME_BASED' && window.gameRemainingTime !== undefined) {
        const minutes = Math.floor(window.gameRemainingTime / 60000);
        const seconds = Math.floor((window.gameRemainingTime % 60000) / 1000);
        const timerDiv = document.createElement('div');
        timerDiv.className = 'text-center mb-2 text-lg';
        timerDiv.textContent = `Time: ${minutes}:${seconds.toString().padStart(2, '0')}`;
        playerHud.appendChild(timerDiv);
    }
    
    // Create a container for player HUDs
    const hudContainer = document.createElement('div');
    hudContainer.className = 'flex gap-4 justify-center flex-wrap';
    
    localPlayers.forEach((localPlayer, index) => {
        const serverPlayer = gameState.players?.[localPlayer.id];
        if (!serverPlayer || !serverPlayer.isAlive) return;
        
        // Create player HUD element
        const playerDiv = document.createElement('div');
        playerDiv.className = 'bg-gray-800 bg-opacity-80 px-3 py-2 rounded text-sm';
        playerDiv.style.borderLeft = `4px solid ${localPlayer.color}`;
        
        // Player name and input method
        const nameDiv = document.createElement('div');
        nameDiv.className = 'font-bold mb-1';
        const inputIcon = localPlayer.inputMethod === 'keyboard' ? '⌨️' : `🎮${localPlayer.controllerIndex + 1}`;
        nameDiv.textContent = `${inputIcon} ${localPlayer.name}`;
        nameDiv.style.color = localPlayer.color;
        playerDiv.appendChild(nameDiv);
        
        // Weapon info
        const weaponDiv = document.createElement('div');
        weaponDiv.className = 'text-xs';
        const weaponName = WEAPONS_CONFIG[serverPlayer.weapon.type]?.name || 'Sword';
        weaponDiv.textContent = weaponName;
        
        // Only show ammo if it's not infinite and not null
        if (serverPlayer.weapon.ammo !== Infinity && serverPlayer.weapon.ammo != null) {
            const ammoDiv = document.createElement('div');
            ammoDiv.className = 'text-xs text-yellow-400';
            ammoDiv.textContent = `Ammo: ${serverPlayer.weapon.ammo}`;
            playerDiv.appendChild(weaponDiv);
            playerDiv.appendChild(ammoDiv);
        } else {
            playerDiv.appendChild(weaponDiv);
        }
        
        // Shield info
        if (serverPlayer.hasShield) {
            const shieldDiv = document.createElement('div');
            shieldDiv.className = 'text-xs text-blue-400';
            const shieldSeconds = (serverPlayer.shieldEnergy / 1000).toFixed(1);
            shieldDiv.textContent = `Shield: ${shieldSeconds}s`;
            playerDiv.appendChild(shieldDiv);
        }
        
        hudContainer.appendChild(playerDiv);
    });
    
    playerHud.appendChild(hudContainer);
}