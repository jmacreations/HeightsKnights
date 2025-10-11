// public/js/ui/hud.js
import { WEAPONS_CONFIG } from '../config.js'; // Import from the new config file

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
    playerHud.textContent = hudText;
}