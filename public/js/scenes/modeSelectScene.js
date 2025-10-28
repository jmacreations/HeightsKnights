// public/js/scenes/modeSelectScene.js
import { GAME_MODES } from '../config.js';
import { showScreen } from '../ui/uiManager.js';

export function getModeSelectHTML(playerName) {
    const modes = Object.values(GAME_MODES);
    
    const modeCards = modes.map(mode => {
        const isDisabled = !mode.available;
        const disabledClass = isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-700 hover:scale-105 cursor-pointer';
        const badge = isDisabled ? '<span class="absolute top-2 right-2 bg-yellow-600 text-xs px-2 py-1 rounded">Coming Soon</span>' : '';
        
        return `
            <div class="mode-card relative bg-gray-800 p-6 rounded-lg border-2 border-gray-600 transition-all ${disabledClass}" 
                 data-mode="${mode.id}" 
                 ${isDisabled ? 'data-disabled="true"' : ''}>
                ${badge}
                <h3 class="text-2xl font-bold mb-3">${mode.name}</h3>
                <p class="text-gray-300 mb-4">${mode.description}</p>
                <div class="text-sm text-gray-400">
                    <p>Players: ${mode.minPlayers}-${mode.maxPlayers}</p>
                </div>
            </div>
        `;
    }).join('');

    return `
        <div id="MODE_SELECT" class="ui-screen flex flex-col items-center p-8 bg-gray-800 rounded-lg shadow-xl max-w-4xl">
            <button id="back-to-menu-btn" class="self-start mb-4 text-gray-400 hover:text-white">
                ← Back
            </button>
            <h1 class="text-4xl mb-2">Select Game Mode</h1>
            <p class="text-gray-400 mb-6">Playing as: <span class="text-white">${playerName}</span></p>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                ${modeCards}
            </div>
        </div>
    `;
}

export function addModeSelectListeners() {
    const modeCards = document.querySelectorAll('.mode-card');
    
    modeCards.forEach(card => {
        card.addEventListener('click', () => {
            const isDisabled = card.getAttribute('data-disabled') === 'true';
            if (isDisabled) return;
            
            const modeId = card.getAttribute('data-mode');
            window.selectedGameMode = modeId;
            
            // Visual feedback
            modeCards.forEach(c => c.classList.remove('border-green-500'));
            card.classList.add('border-green-500');
            
            // Create room with selected mode
            const playerName = window.playerName;
            socket.emit('createRoom', { playerName, gameMode: modeId });
        });
    });
    
    document.getElementById('back-to-menu-btn').onclick = () => {
        showScreen('MENU');
    };
}
