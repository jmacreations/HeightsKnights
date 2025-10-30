// public/js/ui/hud.js
import { WEAPONS_CONFIG } from '../config.js'; // Import from the new config file
import { gamepadManager } from '../input/gamepadManager.js';

export function updateHud() {
    const playerHud = document.getElementById('player-hud');
    if (!playerHud) return;

    const me = gameState.players?.[myId];
    if (!me) {
        playerHud.classList.add('hidden');
        return;
    }

    let hudText = `Weapon: ${WEAPONS_CONFIG[me.weapon.type]?.name || 'Sword'}`;
    if (me.weapon.ammo !== Infinity) {
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
}