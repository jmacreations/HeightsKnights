// public/js/ui/uiManager.js
import { getModeSelectHTML, addModeSelectListeners } from '../scenes/modeSelectScene.js';
import { getMatchSettingsHTML, addMatchSettingsListeners } from '../scenes/matchSettingsScene.js';
import { initPlayModeScene } from '../scenes/playModeScene.js';
import { initControllerSetupScene, cleanupControllerSetupScene } from '../scenes/controllerSetupScene.js';
import { GAME_MODES, WIN_TYPES } from '../config.js';

export function showScreen(screenName) {
    const container = document.getElementById('game-container');
    container.innerHTML = ''; // Clear previous screen
    document.getElementById('scoreboard').classList.add('hidden');
    document.getElementById('player-hud').classList.add('hidden');
    
    // Cleanup previous screen
    if (uiState === 'CONTROLLER_SETUP') {
        cleanupControllerSetupScene();
    }
    
    uiState = screenName;

    // Notify listeners about screen change (for cleanup like key handlers)
    const evt = new Event('uiScreenChange');
    window.dispatchEvent(evt);

    let screenHtml = '';

    if (screenName === 'MENU') {
        screenHtml = `
            <div id="MENU" class="ui-screen flex flex-col items-center justify-center p-8 bg-gray-800 rounded-lg shadow-xl">
                <h1 class="text-5xl mb-8">SlashDash</h1>
                <div class="w-full max-w-sm">
                    <input id="name-input" type="text" placeholder="Enter Your Name" class="input-field w-full mb-4" maxlength="12">
                    <button id="create-room-btn" class="btn btn-green w-full mb-4">Create Room</button>
                    <div class="flex items-center gap-2">
                        <input id="room-code-input" type="text" placeholder="Room Code" class="input-field w-full" maxlength="4">
                        <button id="join-room-btn" class="btn btn-green flex-shrink-0">Join</button>
                    </div>
                    <p id="menu-error" class="text-red-400 mt-4 text-center h-4"></p>
                </div>
            </div>`;
    } else if (screenName === 'PLAY_MODE') {
        screenHtml = `
            <div id="play-mode-screen" class="ui-screen flex flex-col items-center justify-center p-8 bg-gray-800 rounded-lg shadow-xl">
            </div>`;
    } else if (screenName === 'CONTROLLER_SETUP') {
        screenHtml = `
            <div id="controller-setup-screen" class="ui-screen flex flex-col items-center justify-center p-8 bg-gray-800 rounded-lg shadow-xl max-w-4xl">
            </div>`;
    } else if (screenName === 'MODE_SELECT') {
        screenHtml = getModeSelectHTML(window.playerName);
    } else if (screenName === 'MATCH_SETTINGS') {
        screenHtml = getMatchSettingsHTML(window.playerName, window.selectedGameMode);
    } else if (screenName === 'LOBBY') {
        const gameModeName = gameState.gameMode ? GAME_MODES[gameState.gameMode]?.name : 'Deathmatch';
        const winType = gameState.matchSettings?.winType || 'LAST_KNIGHT_STANDING';
        const winTypeName = WIN_TYPES[winType]?.name || 'Last Knight Standing';
        const scoreTarget = gameState.matchSettings?.scoreTarget || 5;
        const timeLimit = gameState.matchSettings?.timeLimit || 5;
    const enabledWeapons = gameState.matchSettings?.enabledWeapons || ['sword', 'bow', 'shotgun', 'laser', 'minigun', 'grenade'];
    const mapId = gameState.matchSettings?.mapId || 'classic';
    let mapLabel = mapId === 'classic' ? 'Classic Arena' : mapId;
        const weaponsList = enabledWeapons.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(', ');
        
        // Build victory condition text
        let victoryText = '';
        if (winType === 'LAST_KNIGHT_STANDING') {
            victoryText = `<p>Score to Win: <span class="text-green-400">${scoreTarget}</span> rounds</p>`;
        } else if (winType === 'KILL_BASED') {
            victoryText = `<p>Kill Target: <span class="text-green-400">${scoreTarget}</span> kills</p>`;
        } else if (winType === 'TIME_BASED') {
            victoryText = `<p>Time Limit: <span class="text-blue-400">${timeLimit}</span> minutes</p>`;
        }
        
        screenHtml = `
            <div id="LOBBY" class="ui-screen flex flex-col items-center p-8 bg-gray-800 rounded-lg shadow-xl w-[500px]">
                <h2 class="text-3xl mb-2">LOBBY</h2>
                <p class="text-2xl font-mono bg-gray-900 px-4 py-2 rounded-md mb-2">${roomCode}</p>
                <div class="text-sm text-gray-400 mb-4 text-center flex items-center gap-3">
                    <div class="text-left">
                        <p>Mode: <span class="text-white">${gameModeName}</span></p>
                        <p>Victory: <span class="text-white">${winTypeName}</span></p>
                        ${victoryText}
                        <p>Weapons: <span class="text-white text-xs">${weaponsList}</span></p>
                        <p>Map: <span id="lobby-map-name" class="text-white">${mapLabel}</span></p>
                    </div>
                    <button id="edit-settings-btn" class="hidden bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded text-xs">Edit</button>
                </div>
                <div id="player-list" class="flex flex-col items-center w-full gap-2 min-h-[100px]"></div>
                <button id="start-game-btn" class="btn btn-green w-full mt-6 hidden">Start Game</button>
            </div>`;
    } else if (screenName === 'GAME') {
        screenHtml = `
            <div class="relative w-full h-full">
                <canvas id="gameCanvas"></canvas>
                <div id="game-menu-modal" class="hidden absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center z-10">
                    <div class="bg-gray-800 rounded-lg p-6 w-[300px] text-center shadow-xl">
                        <h3 class="text-xl mb-4">Menu</h3>
                        <div id="menu-buttons" class="space-y-2"></div>
                        <button id="menu-close" class="mt-4 text-gray-400 hover:text-white text-sm">Resume</button>
                    </div>
                </div>
            </div>`;
        document.getElementById('scoreboard').classList.remove('hidden');
        document.getElementById('player-hud').classList.remove('hidden');
    }

    container.innerHTML = screenHtml;
    
    // Initialize special screens
    if (screenName === 'PLAY_MODE') {
        initPlayModeScene(window.playModeContext || 'create');
    } else if (screenName === 'CONTROLLER_SETUP') {
        initControllerSetupScene();
    }
    
    addEventListeners(screenName);
}

function addEventListeners(screenName) {
    if (screenName === 'MENU') {
        document.getElementById('create-room-btn').onclick = () => {
            const name = document.getElementById('name-input').value.trim();
            if (!name) {
                document.getElementById('menu-error').textContent = 'Please enter your name';
                return;
            }
            window.playerName = name;
            window.playModeContext = 'create';
            showScreen('PLAY_MODE');
        };
        document.getElementById('join-room-btn').onclick = () => {
            const name = document.getElementById('name-input').value.trim();
            const code = document.getElementById('room-code-input').value.toUpperCase();
            if (!name) {
                document.getElementById('menu-error').textContent = 'Please enter your name';
                return;
            }
            if (!code) {
                document.getElementById('menu-error').textContent = 'Please enter room code';
                return;
            }
            window.playerName = name;
            window.playModeContext = 'join';
            window.pendingRoomCode = code;
            showScreen('PLAY_MODE');
        };
    } else if (screenName === 'MODE_SELECT') {
        addModeSelectListeners();
    } else if (screenName === 'MATCH_SETTINGS') {
        addMatchSettingsListeners();
    } else if (screenName === 'LOBBY') {
        const startGameBtn = document.getElementById('start-game-btn');
        if (startGameBtn) {
            startGameBtn.onclick = () => socket.emit('startGame', roomCode);
        }
        // Resolve map name for display
        const mapNameEl = document.getElementById('lobby-map-name');
        if (mapNameEl) {
            socket.emit('getMaps', (res) => {
                if (res?.ok) {
                    const m = res.maps.find(m => m.id === (gameState.matchSettings?.mapId || 'classic'));
                    if (m) mapNameEl.textContent = m.name;
                    window.availableMaps = res.maps;
                }
            });
        }
        // Host-only: show Edit Settings
        const editBtn = document.getElementById('edit-settings-btn');
        if (editBtn && myId === gameState.hostId) {
            editBtn.classList.remove('hidden');
            editBtn.onclick = () => {
                window.settingsContext = 'lobby';
                showScreen('MATCH_SETTINGS');
            };
        }
    }
    else if (screenName === 'GAME') {
        const modal = document.getElementById('game-menu-modal');
        const buttonsContainer = document.getElementById('menu-buttons');
        const closeBtn = document.getElementById('menu-close');
        let escHandler = null;
        const isHost = myId === gameState.hostId;
        const renderButtons = () => {
            buttonsContainer.innerHTML = '';
            if (isHost) {
                // Host options: Exit to Lobby, Leave Game
                const exitBtn = document.createElement('button');
                exitBtn.className = 'btn btn-green w-full';
                exitBtn.textContent = 'Exit to Lobby';
                exitBtn.onclick = () => {
                    socket.emit('endGame', roomCode);
                    modal.classList.add('hidden');
                };
                const leaveBtn = document.createElement('button');
                leaveBtn.className = 'btn btn-red w-full';
                leaveBtn.textContent = 'Leave Game';
                leaveBtn.onclick = () => {
                    if (confirm('Are you sure you want to leave the game?')) {
                        socket.emit('leaveGame', { roomCode }, () => {
                            window.roomCode = null; window.gameState = {}; window.myId = null; showScreen('MENU');
                        });
                    }
                };
                buttonsContainer.appendChild(exitBtn);
                buttonsContainer.appendChild(leaveBtn);
            } else {
                // Non-host: Leave Game only
                const leaveBtn = document.createElement('button');
                leaveBtn.className = 'btn btn-red w-full';
                leaveBtn.textContent = 'Leave Game';
                leaveBtn.onclick = () => {
                    if (confirm('Are you sure you want to leave the game?')) {
                        socket.emit('leaveGame', { roomCode }, () => {
                            window.roomCode = null; window.gameState = {}; window.myId = null; showScreen('MENU');
                        });
                    }
                };
                buttonsContainer.appendChild(leaveBtn);
            }
        };

        escHandler = (e) => {
            if (e.key === 'Escape') {
                if (modal.classList.contains('hidden')) {
                    if (isHost && (gameState.state === 'PLAYING' || gameState.state === 'COUNTDOWN')) {
                        socket.emit('pauseGame', roomCode, () => {
                            modal.classList.remove('hidden');
                            renderButtons();
                        });
                    } else {
                        modal.classList.remove('hidden');
                        renderButtons();
                    }
                } else {
                    modal.classList.add('hidden');
                    if (isHost && gameState.state === 'PAUSED') {
                        socket.emit('resumeGame', roomCode);
                    }
                }
            }
        };
        document.addEventListener('keydown', escHandler);
        closeBtn.onclick = () => {
            modal.classList.add('hidden');
            if (isHost && gameState.state === 'PAUSED') {
                socket.emit('resumeGame', roomCode);
            }
        };

        // Cleanup when leaving GAME screen
        window.addEventListener('uiScreenChange', () => {
            if (escHandler) document.removeEventListener('keydown', escHandler);
        }, { once: true });
    }
}

export function showMessage(text, duration, isMatchOver = false, matchData = null) {
    let messageEl = document.getElementById('game-message');
    if (!messageEl) {
        messageEl = document.createElement('div');
        messageEl.id = 'game-message';
        messageEl.className = 'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-5xl text-center bg-black bg-opacity-50 p-6 rounded-lg';
        document.getElementById('game-container').appendChild(messageEl);
    }
    messageEl.innerHTML = '';
    if (text) {
        const title = document.createElement('div');
        title.textContent = text;
        messageEl.appendChild(title);
    }
    messageEl.classList.remove('hidden');

    if (duration !== Infinity) {
        setTimeout(() => messageEl.classList.add('hidden'), duration);
    }

    if (isMatchOver) {
        const isHost = myId === (matchData?.hostId || gameState.hostId);
        if (isHost) {
            const playAgainBtn = document.createElement('button');
            playAgainBtn.textContent = 'Play Again';
            playAgainBtn.className = 'btn btn-green block mx-auto mt-6 text-2xl';
            playAgainBtn.onclick = () => socket.emit('playAgain', roomCode);
            messageEl.appendChild(playAgainBtn);

            const exitBtn = document.createElement('button');
            exitBtn.textContent = 'Exit to Lobby';
            exitBtn.className = 'btn bg-gray-700 hover:bg-gray-600 block mx-auto mt-3 text-2xl';
            exitBtn.onclick = () => socket.emit('endGame', roomCode);
            messageEl.appendChild(exitBtn);
        } else {
            const leaveBtn = document.createElement('button');
            leaveBtn.textContent = 'Leave Game';
            leaveBtn.className = 'btn btn-red block mx-auto mt-6 text-2xl';
            leaveBtn.onclick = () => {
                if (confirm('Are you sure you want to leave the game?')) {
                    socket.emit('leaveGame', { roomCode }, () => { window.roomCode = null; window.gameState = {}; window.myId = null; showScreen('MENU'); });
                }
            };
            messageEl.appendChild(leaveBtn);
        }
    }
}