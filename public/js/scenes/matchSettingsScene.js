// public/js/scenes/matchSettingsScene.js
import { showScreen } from '../ui/uiManager.js';
import { updateLobbyUI } from './lobbyScene.js';
import { WEAPONS_CONFIG, WIN_TYPES } from '../config.js';

export function getMatchSettingsHTML(playerName, gameMode) {
    const modeDisplay = gameMode === 'deathmatch' ? 'Deathmatch' : gameMode;
    const inLobby = window.settingsContext === 'lobby';
    
    // Get current settings
    const currentWinType = (inLobby && window.gameState?.matchSettings?.winType) 
        ? window.gameState.matchSettings.winType 
        : 'LAST_KNIGHT_STANDING';
    const currentEnabledWeapons = (inLobby && window.gameState?.matchSettings?.enabledWeapons) 
        ? window.gameState.matchSettings.enabledWeapons 
        : Object.keys(WEAPONS_CONFIG).filter(w => w !== 'shield');
    
    // Generate win type radio buttons
    const winTypeOptions = Object.entries(WIN_TYPES).map(([key, config]) => `
        <label class="flex items-start gap-3 p-3 rounded cursor-pointer hover:bg-gray-600 transition-colors">
            <input 
                type="radio" 
                name="winType" 
                value="${key}" 
                class="win-type-radio mt-1 w-5 h-5"
                ${currentWinType === key ? 'checked' : ''}
            >
            <div class="flex-1">
                <div class="font-bold">${config.name}</div>
                <div class="text-xs text-gray-400">${config.description}</div>
            </div>
        </label>
    `).join('');
    
    // Generate weapon checkboxes (exclude shield, it's a powerup not a weapon)
    const weaponCheckboxes = Object.entries(WEAPONS_CONFIG)
        .filter(([key]) => key !== 'shield')
        .map(([key, config]) => {
            const isEnabled = currentEnabledWeapons.includes(key);
            const isSword = key === 'sword';
            return `
                <label class="flex items-center gap-3 p-2 rounded hover:bg-gray-600 cursor-pointer ${isSword ? 'opacity-75' : ''}">
                    <input 
                        type="checkbox" 
                        class="weapon-checkbox w-5 h-5" 
                        data-weapon="${key}"
                        ${isEnabled ? 'checked' : ''}
                        ${isSword ? 'disabled' : ''}
                    >
                    <span class="flex-1">${config.name}</span>
                    <span class="w-4 h-4 rounded-full" style="background-color: ${config.color}"></span>
                </label>
            `;
        }).join('');
    
    return `
        <div id="MATCH_SETTINGS" class="ui-screen flex flex-col items-center p-8 bg-gray-800 rounded-lg shadow-xl max-w-2xl">
            <button id="back-settings-btn" class="self-start mb-4 text-gray-400 hover:text-white">
                ← ${inLobby ? 'Back to Lobby' : 'Back'}
            </button>
            <h1 class="text-4xl mb-2">Match Settings</h1>
            <p class="text-gray-400 mb-2">Mode: <span class="text-white">${modeDisplay}</span></p>
            <p class="text-gray-400 mb-6">Host: <span class="text-white">${playerName}</span></p>
            
            <div class="w-full max-w-md space-y-6">
                <!-- Win Type Selection -->
                <div class="bg-gray-700 p-4 rounded-lg">
                    <label class="block text-lg font-bold mb-3">Victory Condition</label>
                    <div class="space-y-2">
                        ${winTypeOptions}
                    </div>
                </div>
                
                <!-- Score Target Setting (conditional) -->
                <div id="score-target-section" class="bg-gray-700 p-4 rounded-lg">
                    <label class="block text-lg font-bold mb-3" id="score-label">Score to Win</label>
                    <div class="flex items-center justify-between gap-4">
                        <button id="score-decrease" class="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded text-2xl">
                            −
                        </button>
                        <div class="flex-1 text-center">
                            <div id="score-display" class="text-4xl font-bold text-green-400">5</div>
                            <div class="text-sm text-gray-400" id="score-unit">rounds</div>
                        </div>
                        <button id="score-increase" class="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded text-2xl">
                            +
                        </button>
                    </div>
                    <div class="mt-2 text-xs text-gray-400 text-center" id="score-description">
                        First player to reach this score wins the match
                    </div>
                </div>
                
                <!-- Time Limit Setting (conditional) -->
                <div id="time-limit-section" class="bg-gray-700 p-4 rounded-lg hidden">
                    <label class="block text-lg font-bold mb-3">Time Limit</label>
                    <div class="flex items-center justify-between gap-4">
                        <button id="time-decrease" class="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded text-2xl">
                            −
                        </button>
                        <div class="flex-1 text-center">
                            <div id="time-display" class="text-4xl font-bold text-blue-400">5</div>
                            <div class="text-sm text-gray-400">minutes</div>
                        </div>
                        <button id="time-increase" class="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded text-2xl">
                            +
                        </button>
                    </div>
                    <div class="mt-2 text-xs text-gray-400 text-center">
                        Player with most kills when time expires wins
                    </div>
                </div>
                
                <!-- Weapon Selection -->
                <div class="bg-gray-700 p-4 rounded-lg">
                    <label class="block text-lg font-bold mb-3">Enabled Weapons</label>
                    <div class="space-y-1">
                        ${weaponCheckboxes}
                    </div>
                    <div class="mt-2 text-xs text-gray-400">
                        Sword cannot be disabled. Uncheck weapons to restrict them from spawning.
                    </div>
                </div>
                
                <button id="save-settings-btn" class="btn btn-green w-full mt-6 text-xl py-3">
                    ${inLobby ? 'Save Settings' : 'Create Room'}
                </button>
            </div>
        </div>
    `;
}

export function addMatchSettingsListeners() {
    // Initialize values from existing settings if in lobby
    const inLobby = window.settingsContext === 'lobby';
    let currentWinType = (inLobby && window.gameState?.matchSettings?.winType) 
        ? window.gameState.matchSettings.winType 
        : 'LAST_KNIGHT_STANDING';
    let currentScore = 5;
    let currentTimeLimit = 5; // minutes
    
    if (inLobby && window.gameState?.matchSettings) {
        currentScore = Number(window.gameState.matchSettings.scoreTarget) || 5;
        currentTimeLimit = Number(window.gameState.matchSettings.timeLimit) || 5;
    }
    
    const minScore = 1;
    const maxScore = 20;
    const minTime = 1;
    const maxTime = 15;
    
    // Get UI elements
    const scoreDisplay = document.getElementById('score-display');
    const scoreLabel = document.getElementById('score-label');
    const scoreUnit = document.getElementById('score-unit');
    const scoreDescription = document.getElementById('score-description');
    const scoreSection = document.getElementById('score-target-section');
    const timeSection = document.getElementById('time-limit-section');
    const scoreDecreaseBtn = document.getElementById('score-decrease');
    const scoreIncreaseBtn = document.getElementById('score-increase');
    const timeDisplay = document.getElementById('time-display');
    const timeDecreaseBtn = document.getElementById('time-decrease');
    const timeIncreaseBtn = document.getElementById('time-increase');
    
    // Update UI based on win type
    function updateUIForWinType(winType) {
        currentWinType = winType;
        const winTypeConfig = WIN_TYPES[winType];
        
        if (winTypeConfig.requiresScoreTarget) {
            scoreSection.classList.remove('hidden');
            timeSection.classList.add('hidden');
            
            if (winType === 'LAST_KNIGHT_STANDING') {
                scoreLabel.textContent = 'Score to Win';
                scoreUnit.textContent = 'rounds';
                scoreDescription.textContent = 'First player to win this many rounds wins the match';
            } else if (winType === 'KILL_BASED') {
                scoreLabel.textContent = 'Kill Target';
                scoreUnit.textContent = 'kills';
                scoreDescription.textContent = 'First player to reach this many kills wins';
            }
        } else if (winTypeConfig.requiresTimeLimit) {
            scoreSection.classList.add('hidden');
            timeSection.classList.remove('hidden');
        }
    }
    
    // Win type radio button listeners
    document.querySelectorAll('.win-type-radio').forEach(radio => {
        radio.addEventListener('change', (e) => {
            updateUIForWinType(e.target.value);
        });
    });
    
    function updateScoreDisplay() {
        scoreDisplay.textContent = currentScore;
        scoreDecreaseBtn.disabled = currentScore <= minScore;
        scoreIncreaseBtn.disabled = currentScore >= maxScore;
        
        if (currentScore <= minScore) {
            scoreDecreaseBtn.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
            scoreDecreaseBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
        
        if (currentScore >= maxScore) {
            scoreIncreaseBtn.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
            scoreIncreaseBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }
    
    function updateTimeDisplay() {
        timeDisplay.textContent = currentTimeLimit;
        timeDecreaseBtn.disabled = currentTimeLimit <= minTime;
        timeIncreaseBtn.disabled = currentTimeLimit >= maxTime;
        
        if (currentTimeLimit <= minTime) {
            timeDecreaseBtn.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
            timeDecreaseBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
        
        if (currentTimeLimit >= maxTime) {
            timeIncreaseBtn.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
            timeIncreaseBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }
    
    scoreDecreaseBtn.onclick = () => {
        if (currentScore > minScore) {
            currentScore--;
            updateScoreDisplay();
        }
    };
    
    scoreIncreaseBtn.onclick = () => {
        if (currentScore < maxScore) {
            currentScore++;
            updateScoreDisplay();
        }
    };
    
    timeDecreaseBtn.onclick = () => {
        if (currentTimeLimit > minTime) {
            currentTimeLimit--;
            updateTimeDisplay();
        }
    };
    
    timeIncreaseBtn.onclick = () => {
        if (currentTimeLimit < maxTime) {
            currentTimeLimit++;
            updateTimeDisplay();
        }
    };
    
    // Back button
    document.getElementById('back-settings-btn').onclick = () => {
        if (window.settingsContext === 'lobby') {
            showScreen('LOBBY');
            // Immediately refresh lobby UI with current state
            updateLobbyUI();
        } else {
            showScreen('MODE_SELECT');
        }
    };

    // Save/Create button
    document.getElementById('save-settings-btn').onclick = () => {
        const playerName = window.playerName;
        const gameMode = window.selectedGameMode;
        
        // Collect enabled weapons from checkboxes
        const enabledWeapons = Array.from(document.querySelectorAll('.weapon-checkbox:checked'))
            .map(cb => cb.dataset.weapon);
        
        // Ensure sword is always included (should already be checked and disabled)
        if (!enabledWeapons.includes('sword')) {
            enabledWeapons.push('sword');
        }
        
        // Store match settings globally
        window.matchSettings = { 
            winType: currentWinType,
            scoreTarget: currentScore,
            timeLimit: currentTimeLimit,
            enabledWeapons: enabledWeapons
        };
        
        if (window.settingsContext === 'lobby' && window.roomCode) {
            // Update settings for existing room
            socket.emit('updateMatchSettings', { roomCode, settings: window.matchSettings }, (res) => {
                if (res?.ok) {
                    // Optimistically update local state and re-render lobby immediately
                    gameState.matchSettings = { ...gameState.matchSettings, ...window.matchSettings };
                    showScreen('LOBBY');
                    updateLobbyUI();
                } else {
                    // Optional: show error feedback
                    console.warn('Failed to update settings:', res?.error);
                }
            });
        } else {
            // Create room with settings
            socket.emit('createRoom', { playerName, gameMode, matchSettings: window.matchSettings });
        }
    };
    
    // Initialize displays and UI state
    updateUIForWinType(currentWinType);
    updateScoreDisplay();
    updateTimeDisplay();
}
