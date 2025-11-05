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
    const currentFriendlyFire = (inLobby && window.gameState?.matchSettings?.friendlyFire !== undefined)
        ? window.gameState.matchSettings.friendlyFire
        : false;
    const currentPlayerSpeed = (inLobby && window.gameState?.matchSettings?.playerSpeed !== undefined)
        ? window.gameState.matchSettings.playerSpeed
        : 100;
    
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
        <div id="MATCH_SETTINGS" class="ui-screen flex flex-col items-center p-6 bg-gray-800 rounded-lg shadow-xl max-w-3xl" style="max-height: 80vh; overflow: hidden;">
            <button id="back-settings-btn" class="self-start mb-4 text-gray-400 hover:text-white">
                ← ${inLobby ? 'Back to Lobby' : 'Back'}
            </button>
            <h1 class="text-4xl mb-2">Match Settings</h1>
            <p class="text-gray-400 mb-2">Mode: <span class="text-white">${modeDisplay}</span></p>
            <p class="text-gray-400 mb-6">Host: <span class="text-white">${playerName}</span></p>
            <div id="settings-scroll" class="w-full max-w-3xl space-y-6" style="max-height: 65vh; overflow-y: auto; padding-right: 8px;">
                <!-- Map Selection -->
                <div class="bg-gray-700 p-4 rounded-lg">
                    <label class="block text-lg font-bold mb-3">Map</label>
                    <div class="flex gap-4 items-start">
                        <div id="map-select-container" class="flex-1">
                            <select id="map-select" class="input-field w-full"></select>
                            <div id="map-meta" class="text-xs text-gray-400 mt-1"></div>
                        </div>
                        <canvas id="map-preview" class="bg-gray-900 rounded border border-gray-600" width="240" height="180" style="flex:0 0 auto"></canvas>
                    </div>
                </div>
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
                
                <!-- Player Speed -->
                <div class="bg-gray-700 p-4 rounded-lg">
                    <label for="player-speed-select" class="block text-lg font-bold mb-3">Player Speed</label>
                    <select id="player-speed-select" class="input-field w-full">
                        <option value="100">Normal (100%)</option>
                        <option value="150">Faster (150%)</option>
                        <option value="200">Super Fast (200%)</option>
                    </select>
                    <div class="text-xs text-gray-400 mt-1">Increase player movement speed.</div>
                </div>
                
                <!-- Weapon Spawn Rate -->
                <div class="bg-gray-700 p-4 rounded-lg">
                    <label for="weapon-spawn-rate-select" class="block text-lg font-bold mb-3">Weapon Spawn Rate</label>
                    <select id="weapon-spawn-rate-select" class="input-field w-full">
                        <option value="100">Normal (100%)</option>
                        <option value="150">Faster (150%)</option>
                        <option value="200">Super Fast (200%)</option>
                    </select>
                    <div class="text-xs text-gray-400 mt-1">Increase how quickly weapons spawn.</div>
                </div>
                
                <!-- Friendly Fire Setting (Team Mode Only) -->
                ${gameMode === 'teamBattle' ? `
                <div class="bg-gray-700 p-4 rounded-lg">
                    <label class="block text-lg font-bold mb-3">Team Settings</label>
                    <label class="flex items-center gap-3 p-2 rounded hover:bg-gray-600 cursor-pointer">
                        <input 
                            type="checkbox" 
                            id="friendly-fire-checkbox"
                            class="w-5 h-5"
                            ${currentFriendlyFire ? 'checked' : ''}
                        >
                        <div class="flex-1">
                            <span class="font-bold">Friendly Fire</span>
                            <div class="text-xs text-gray-400">Allow teammates to damage each other</div>
                        </div>
                    </label>
                </div>
                ` : ''}
                
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
    let currentMapId = (inLobby && window.gameState?.matchSettings?.mapId) ? window.gameState.matchSettings.mapId : 'classic';
    let currentFriendlyFire = (inLobby && window.gameState?.matchSettings?.friendlyFire !== undefined) 
        ? window.gameState.matchSettings.friendlyFire 
        : false;
    let currentPlayerSpeed = (inLobby && window.gameState?.matchSettings?.playerSpeed)
        ? window.gameState.matchSettings.playerSpeed
        : 100;
    let currentWeaponSpawnRate = (inLobby && window.gameState?.matchSettings?.weaponSpawnRate)
        ? window.gameState.matchSettings.weaponSpawnRate
        : 100;
    
    if (inLobby && window.gameState?.matchSettings) {
        currentScore = Number(window.gameState.matchSettings.scoreTarget) || 5;
        currentTimeLimit = Number(window.gameState.matchSettings.timeLimit) || 5;
    }
    
    const minScore = 1;
    const maxScore = 20;
    const minTime = 1;
    const maxTime = 15;
    const minSpeed = 100;
    const maxSpeed = 200;
    
    // Get UI elements
    const scoreDisplay = document.getElementById('score-display');
    const scoreLabel = document.getElementById('score-label');
    const scoreUnit = document.getElementById('score-unit');
    const scoreDescription = document.getElementById('score-description');
    const scoreSection = document.getElementById('score-target-section');
    const timeSection = document.getElementById('time-limit-section');
    const playerSpeedSelect = document.getElementById('player-speed-select');
    const weaponSpawnRateSelect = document.getElementById('weapon-spawn-rate-select');
    const scoreDecreaseBtn = document.getElementById('score-decrease');
    const scoreIncreaseBtn = document.getElementById('score-increase');
    const timeDisplay = document.getElementById('time-display');
    const timeDecreaseBtn = document.getElementById('time-decrease');
    const timeIncreaseBtn = document.getElementById('time-increase');
    const mapSelectEl = document.getElementById('map-select');
    const mapMetaEl = document.getElementById('map-meta');
    const mapPreviewCanvas = document.getElementById('map-preview');
    const mapPreviewCtx = mapPreviewCanvas ? mapPreviewCanvas.getContext('2d') : null;
    const friendlyFireToggle = document.getElementById('friendly-fire-toggle');
    
    // --- INITIAL STATE ---
    
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
    
    // Player Speed dropdown
    if (playerSpeedSelect) {
        playerSpeedSelect.value = currentPlayerSpeed.toString();
        playerSpeedSelect.addEventListener('change', (e) => {
            currentPlayerSpeed = Number(e.target.value);
        });
    }
    
    // Weapon Spawn Rate dropdown
    if (weaponSpawnRateSelect) {
        weaponSpawnRateSelect.value = currentWeaponSpawnRate.toString();
        weaponSpawnRateSelect.addEventListener('change', (e) => {
            currentWeaponSpawnRate = Number(e.target.value);
        });
    }
    
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
            mapId: currentMapId,
            enabledWeapons: enabledWeapons,
            friendlyFire: gameMode === 'teamBattle' ? document.getElementById('friendly-fire-checkbox')?.checked || false : false,
            playerSpeed: currentPlayerSpeed,
            weaponSpawnRate: currentWeaponSpawnRate
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

    function drawMapPreview(map) {
        if (!map || !mapPreviewCtx || !mapPreviewCanvas) return;
        const rows = map.layout.length;
        const cols = map.layout[0].length;
        // Compute tile size to fit canvas while preserving aspect
        const maxW = mapPreviewCanvas.width;
        const maxH = mapPreviewCanvas.height;
        const tileW = Math.floor(Math.min(maxW / cols, maxH / rows));
        const canvasW = tileW * cols;
        const canvasH = tileW * rows;
        // center the map inside the canvas
        const offsetX = Math.floor((maxW - canvasW) / 2);
        const offsetY = Math.floor((maxH - canvasH) / 2);
        // Clear
        mapPreviewCtx.fillStyle = '#111827';
        mapPreviewCtx.fillRect(0, 0, maxW, maxH);
        
        // Draw tiles
        for (let y = 0; y < rows; y++) {
            const row = map.layout[y];
            for (let x = 0; x < cols; x++) {
                const ch = row[x];
                const px = offsetX + x * tileW;
                const py = offsetY + y * tileW;
                if (ch === '1') {
                    mapPreviewCtx.fillStyle = '#6b7280'; // destructible
                    mapPreviewCtx.fillRect(px, py, tileW, tileW);
                } else if (ch === 'N') {
                    mapPreviewCtx.fillStyle = '#000000'; // non-destructible
                    mapPreviewCtx.fillRect(px, py, tileW, tileW);
                } else if (ch === 'P') {
                    mapPreviewCtx.fillStyle = '#f59e0b'; // powerup
                    mapPreviewCtx.beginPath();
                    mapPreviewCtx.arc(px + tileW/2, py + tileW/2, Math.max(2, tileW*0.3), 0, Math.PI*2);
                    mapPreviewCtx.fill();
                } else if (ch === 'S') {
                    mapPreviewCtx.strokeStyle = '#10b981'; // spawn
                    mapPreviewCtx.lineWidth = Math.max(1, Math.floor(tileW*0.15));
                    mapPreviewCtx.beginPath();
                    mapPreviewCtx.arc(px + tileW/2, py + tileW/2, Math.max(2, tileW*0.35), 0, Math.PI*2);
                    mapPreviewCtx.stroke();
                }
            }
        }
        // Draw implicit border to indicate bounds
        mapPreviewCtx.strokeStyle = '#374151';
        mapPreviewCtx.lineWidth = 2;
        mapPreviewCtx.strokeRect(offsetX, offsetY, canvasW, canvasH);
    }

    function fetchAndPreview(mapId) {
        socket.emit('getMap', mapId, (res) => {
            if (res?.ok) {
                drawMapPreview(res.map);
            }
        });
    }

    // Populate maps
    if (mapSelectEl) {
        socket.emit('getMaps', (res) => {
            if (res?.ok) {
                mapSelectEl.innerHTML = '';
                res.maps.forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m.id;
                    opt.textContent = `${m.name} (${m.cols}x${m.rows})`;
                    mapSelectEl.appendChild(opt);
                });
                mapSelectEl.value = currentMapId;
                const selected = res.maps.find(m => m.id === currentMapId) || res.maps[0];
                if (selected) {
                    mapMetaEl.textContent = selected.author ? `by ${selected.author}` : '';
                    currentMapId = selected.id;
                    fetchAndPreview(currentMapId);
                }
                mapSelectEl.onchange = () => {
                    const sel = res.maps.find(m => m.id === mapSelectEl.value);
                    currentMapId = sel?.id || 'classic';
                    mapMetaEl.textContent = sel?.author ? `by ${sel.author}` : '';
                    fetchAndPreview(currentMapId);
                };
            } else {
                mapSelectEl.innerHTML = `<option value="classic">Classic Arena</option>`;
                currentMapId = 'classic';
                fetchAndPreview(currentMapId);
            }
        });
    }
    
    // --- EVENT LISTENERS ---
    
    // Player Speed
    if (playerSpeedSlider) {
        playerSpeedSlider.value = currentPlayerSpeed;
        playerSpeedDisplay.textContent = `${currentPlayerSpeed}%`;
        playerSpeedSlider.addEventListener('input', (e) => {
            currentPlayerSpeed = Number(e.target.value);
            playerSpeedDisplay.textContent = `${currentPlayerSpeed}%`;
        });
    }
    
    // Win Type
    document.querySelectorAll('input[name="win-type"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const winType = e.target.value;
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
        });
    });
    
    // Friendly Fire (Team Mode Only)
    if (friendlyFireToggle) {
        friendlyFireToggle.addEventListener('change', (e) => {
            currentFriendlyFire = e.target.checked;
        });
    }
    
    // --- INITIALIZATION ---
    
    // Set initial values
    document.getElementById('player-speed-slider').value = currentPlayerSpeed;
    document.getElementById('player-speed-display').textContent = `${currentPlayerSpeed}%`;
    
    // Initialize map selection
    if (mapSelectEl) {
        socket.emit('getMaps', (res) => {
            if (res?.ok) {
                mapSelectEl.innerHTML = '';
                res.maps.forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m.id;
                    opt.textContent = `${m.name} (${m.cols}x${m.rows})`;
                    mapSelectEl.appendChild(opt);
                });
                mapSelectEl.value = currentMapId;
                const selected = res.maps.find(m => m.id === currentMapId) || res.maps[0];
                if (selected) {
                    mapMetaEl.textContent = selected.author ? `by ${selected.author}` : '';
                    currentMapId = selected.id;
                    fetchAndPreview(currentMapId);
                }
                mapSelectEl.onchange = () => {
                    const sel = res.maps.find(m => m.id === mapSelectEl.value);
                    currentMapId = sel?.id || 'classic';
                    mapMetaEl.textContent = sel?.author ? `by ${sel.author}` : '';
                    fetchAndPreview(currentMapId);
                };
            } else {
                mapSelectEl.innerHTML = `<option value="classic">Classic Arena</option>`;
                currentMapId = 'classic';
                fetchAndPreview(currentMapId);
            }
        });
    }
    
    // Initialize win type UI
    updateUIForWinType(currentWinType);
    
    // Initialize score and time displays
    updateScoreDisplay();
    updateTimeDisplay();
    
    // Initialize speed display
    updateSpeedDisplay();
}
