// public/js/ui/uiManager.js
import { getModeSelectHTML, addModeSelectListeners } from '../scenes/modeSelectScene.js';
import { getMatchSettingsHTML, addMatchSettingsListeners } from '../scenes/matchSettingsScene.js';
import { GAME_MODES, WIN_TYPES } from '../config.js';
import { localPlayerManager } from '../input/localPlayerManager.js';

// Clipboard helper with fallback
async function copyToClipboard(text) {
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            const success = document.execCommand('copy');
            document.body.removeChild(textArea);
            return success;
        }
    } catch (err) {
        console.error('Failed to copy:', err);
        return false;
    }
}

// Show temporary notification
function showNotification(message, duration = 2000) {
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.3s';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, duration);
}

export function showScreen(screenName) {
    const container = document.getElementById('game-container');
    container.innerHTML = ''; // Clear previous screen
    
    // Hide and clear HUD and scoreboard
    const scoreboard = document.getElementById('scoreboard');
    const playerHud = document.getElementById('player-hud');
    
    scoreboard.classList.add('hidden');
    scoreboard.innerHTML = ''; // Clear content
    
    playerHud.classList.add('hidden');
    playerHud.innerHTML = ''; // Clear content
    
    // Remove any existing create room button
    const existingCreateBtn = document.getElementById('create-room-btn-fixed');
    if (existingCreateBtn) {
        existingCreateBtn.remove();
    }
    
    // Update global uiState
    window.uiState = screenName;
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
                    <input id="room-code-input" type="text" placeholder="Enter Room Code" class="input-field w-full mb-4" maxlength="4">
                    <button id="join-room-btn" class="btn btn-green w-full text-xl py-4">Join Room</button>
                    <p id="menu-error" class="text-red-400 mt-4 text-center h-4"></p>
                </div>
            </div>`;
        
        // Add create room button fixed to viewport
        const createBtn = document.createElement('button');
        createBtn.id = 'create-room-btn-fixed';
        createBtn.className = 'fixed top-4 right-4 px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded transition-colors z-50';
        createBtn.textContent = '+ Create Room';
        document.body.appendChild(createBtn);
    } else if (screenName === 'INPUT_SELECTION') {
        const isNameEntry = window.inputSelectionState === 'name-entry';
        const detectedInputType = window.detectedInputType || '';
        const inputIcon = detectedInputType === 'keyboard' ? '⌨️' : detectedInputType === 'controller' ? '🎮' : '';
        const prefilledName = window.playerName || '';
        const joiningRoom = window.joiningRoomCode;
        
        screenHtml = `
            <div id="INPUT_SELECTION" class="ui-screen flex flex-col items-center justify-center p-8 bg-gray-800 rounded-lg shadow-xl max-w-md">
                ${joiningRoom ? `<h2 class="text-3xl mb-2">Joining Room</h2><p class="text-2xl font-mono mb-6 text-yellow-400">${joiningRoom}</p>` : '<h2 class="text-3xl mb-6">Setup Player</h2>'}
                
                ${!isNameEntry ? `
                    <div class="text-center">
                        <p class="text-xl mb-4">Choose your input:</p>
                        <p class="text-gray-400 text-sm mb-6">Press <span class="text-green-400">ENTER</span> for keyboard</p>
                        <p class="text-gray-400 text-sm">or <span class="text-blue-400">START</span> on your controller</p>
                        <div id="input-detection-status" class="mt-6 text-sm text-gray-500">Waiting for input...</div>
                    </div>
                ` : `
                    <div class="w-full text-center">
                        <div class="text-4xl mb-4">${inputIcon}</div>
                        <p class="text-gray-400 text-sm mb-4">Input: ${detectedInputType}</p>
                        <label class="block text-left mb-2">Enter your name:</label>
                        <input id="player-name-input" type="text" class="input-field w-full mb-4" maxlength="12" value="${prefilledName}" autofocus>
                        <button id="confirm-name-btn" class="btn btn-green w-full">Continue</button>
                        <p id="name-error" class="text-red-400 mt-2 text-sm h-4"></p>
                    </div>
                `}
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
            <div id="LOBBY" class="ui-screen flex flex-col items-center p-8 bg-gray-800 rounded-lg shadow-xl w-[500px] max-h-[90vh]">
                <h2 class="text-3xl mb-2">LOBBY</h2>
                <div class="flex items-center gap-2 mb-2">
                    <p class="text-xl font-mono bg-gray-900 px-4 py-2 rounded-md"><span class="text-grey-400 text small">ROOM CODE: </span>${roomCode}</p>
                    <button id="share-link-btn" class="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded text-sm transition-colors" title="Share join link">
                        🔗 Share Link
                    </button>
                </div>
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
                <div id="player-list-container" class="flex-1 w-full overflow-y-auto mb-4" style="max-height: calc(90vh - 350px);">
                    <div id="player-list" class="flex flex-col items-center w-full gap-2 min-h-[100px]"></div>
                </div>
                
                <button id="start-game-btn" class="btn btn-green w-full mt-auto hidden sticky bottom-0 z-10 shadow-lg">Start Game</button>
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
    
    addEventListeners(screenName);
}

function addEventListeners(screenName) {
    if (screenName === 'MENU') {
        const roomCodeInput = document.getElementById('room-code-input');
        const createBtn = document.getElementById('create-room-btn-fixed');
        
        if (createBtn) {
            createBtn.onclick = () => {
                showScreen('MODE_SELECT');
            };
        }
        
        document.getElementById('join-room-btn').onclick = () => {
            const code = roomCodeInput.value.trim().toUpperCase();
            if (!code) {
                document.getElementById('menu-error').textContent = 'Please enter room code';
                return;
            }
            
            // Check if room exists before proceeding
            socket.emit('checkRoom', code, (response) => {
                if (response.exists) {
                    window.joiningRoomCode = code;
                    window.inputSelectionState = null; // Start with input detection
                    showScreen('INPUT_SELECTION');
                } else {
                    document.getElementById('menu-error').textContent = response.error || 'Room not found';
                }
            });
        };
        
        roomCodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('join-room-btn').click();
            }
        });
    } else if (screenName === 'INPUT_SELECTION') {
        const isNameEntry = window.inputSelectionState === 'name-entry';
        
        if (!isNameEntry) {
            // Input detection phase
            let inputDetected = false;
            
            const handleKeyboard = (e) => {
                if (inputDetected) return;
                if (e.key === 'Enter') {
                    inputDetected = true;
                    window.detectedInputType = 'keyboard';
                    window.inputSelectionState = 'name-entry';
                    cleanup();
                    showScreen('INPUT_SELECTION');
                }
            };
            
            const handleGamepad = () => {
                if (inputDetected) return;
                const gamepads = navigator.getGamepads();
                
                for (let i = 0; i < gamepads.length; i++) {
                    const gp = gamepads[i];
                    if (gp && gp.buttons[9] && gp.buttons[9].pressed) { // START button
                        inputDetected = true;
                        window.detectedInputType = 'controller';
                        window.detectedGamepadIndex = i;
                        window.inputSelectionState = 'name-entry';
                        cleanup();
                        showScreen('INPUT_SELECTION');
                        break;
                    }
                }
                
                if (!inputDetected) {
                    window.inputDetectionFrame = requestAnimationFrame(handleGamepad);
                }
            };
            
            const cleanup = () => {
                document.removeEventListener('keydown', handleKeyboard);
                if (window.inputDetectionFrame) {
                    cancelAnimationFrame(window.inputDetectionFrame);
                    window.inputDetectionFrame = null;
                }
            };
            
            document.addEventListener('keydown', handleKeyboard);
            handleGamepad();
            
            // Cleanup on screen change
            window.addEventListener('uiScreenChange', cleanup, { once: true });
        } else {
            // Name entry phase
            const nameInput = document.getElementById('player-name-input');
            const confirmBtn = document.getElementById('confirm-name-btn');
            const errorEl = document.getElementById('name-error');
            
            console.log('Name entry phase - elements:', { nameInput, confirmBtn, errorEl });
            
            if (!nameInput || !confirmBtn || !errorEl) {
                console.error('Missing elements in name entry phase!');
                return;
            }
            
            const confirmName = () => {
                console.log('Confirm name clicked!');
                const name = nameInput.value.trim();
                console.log('Name value:', name);
                if (!name) {
                    errorEl.textContent = 'Name is required';
                    return;
                }
                if (name.length > 12) {
                    errorEl.textContent = 'Name too long (max 12)';
                    return;
                }
                
                window.playerName = name;
                
                console.log('Detected input type:', window.detectedInputType);
                console.log('Socket ID:', window.socket.id);
                
                // Initialize local player with detected input type
                if (window.detectedInputType === 'keyboard') {
                    localPlayerManager.addLocalPlayer({
                        name: name,
                        inputMethod: 'keyboard',
                        controllerIndex: null,
                        socketId: window.socket.id
                    });
                } else if (window.detectedInputType === 'controller') {
                    localPlayerManager.addLocalPlayer({
                        name: name,
                        inputMethod: 'gamepad',
                        controllerIndex: window.detectedGamepadIndex,
                        socketId: window.socket.id
                    });
                }
                
                // Check if joining room or creating room
                if (window.joiningRoomCode) {
                    // Joining existing room
                    console.log('Emitting joinRoom with:', { roomCode: window.joiningRoomCode, playerName: name });
                    window.socket.emit('joinRoom', { 
                        roomCode: window.joiningRoomCode, 
                        playerName: name 
                    });
                    window.joiningRoomCode = null; // Clear after use
                } else if (window.pendingRoomSettings) {
                    // Creating new room
                    console.log('Emitting createRoom with settings');
                    window.socket.emit('createRoom', {
                        playerName: name,
                        gameMode: window.pendingRoomSettings.gameMode,
                        matchSettings: window.pendingRoomSettings.matchSettings
                    });
                    window.pendingRoomSettings = null;
                }
                
                // Reset state
                window.inputSelectionState = null;
                window.detectedInputType = null;
                window.detectedGamepadIndex = null;
                
                // LOBBY screen will be shown by joinSuccess/roomCreated event
            };
            
            confirmBtn.onclick = confirmName;
            nameInput.onkeydown = (e) => {
                if (e.key === 'Enter') confirmName();
            };
            
            nameInput.focus();
        }
    } else if (screenName === 'MODE_SELECT') {
        addModeSelectListeners();
    } else if (screenName === 'MATCH_SETTINGS') {
        addMatchSettingsListeners();
    } else if (screenName === 'LOBBY') {
        const startGameBtn = document.getElementById('start-game-btn');
        if (startGameBtn) {
            startGameBtn.onclick = () => socket.emit('startGame', roomCode);
        }
        
        // Share Link button (visible to all players)
        const shareLinkBtn = document.getElementById('share-link-btn');
        if (shareLinkBtn) {
            shareLinkBtn.onclick = async () => {
                const shareUrl = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
                const success = await copyToClipboard(shareUrl);
                if (success) {
                    showNotification('Copied to clipboard! 📋');
                } else {
                    showNotification('Failed to copy link', 2000);
                }
            };
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
        
        // Add Local Player functionality
        setupAddLocalPlayerUI();
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
                            localPlayerManager.clearAllPlayers(); // Clear local players when leaving
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
                            localPlayerManager.clearAllPlayers(); // Clear local players when leaving
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

// Setup Add Local Player UI in lobby
export function setupAddLocalPlayerUI() {
    const addPlayerBtn = document.getElementById('add-local-player-btn');
    const addPlayerPrompt = document.getElementById('add-player-prompt');
    const addPlayerNameEntry = document.getElementById('add-player-name-entry');
    const cancelPromptBtn = document.getElementById('cancel-add-player-btn');
    const addPlayerNameInput = document.getElementById('add-player-name-input');
    const confirmAddBtn = document.getElementById('confirm-add-player-btn');
    const cancelNameBtn = document.getElementById('cancel-add-player-name-btn');
    const addPlayerIcon = document.getElementById('add-player-icon');
    const errorEl = document.getElementById('add-player-error');
    
    // Elements don't exist yet if not in lobby - skip setup
    if (!addPlayerBtn) return;
    
    let inputDetectionFrame = null;
    let detectedInputType = null;
    let detectedGamepadIndex = null;
    
    // Check if max players reached
    const updateAddPlayerButton = () => {
        const localPlayerCount = localPlayerManager.getAllPlayers().length;
        if (localPlayerCount >= 4) {
            addPlayerBtn.disabled = true;
            addPlayerBtn.textContent = 'Max Players Reached (4)';
            addPlayerBtn.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
            addPlayerBtn.disabled = false;
            addPlayerBtn.textContent = `+ Add Local Player (${localPlayerCount}/4)`;
            addPlayerBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    };
    
    updateAddPlayerButton();
    
    const resetUI = () => {
        addPlayerBtn.classList.remove('hidden');
        addPlayerPrompt.classList.add('hidden');
        addPlayerNameEntry.classList.add('hidden');
        errorEl.textContent = '';
        addPlayerNameInput.value = '';
        detectedInputType = null;
        detectedGamepadIndex = null;
        if (inputDetectionFrame) {
            cancelAnimationFrame(inputDetectionFrame);
            inputDetectionFrame = null;
        }
    };
    
    // Step 1: Show input detection prompt
    addPlayerBtn.onclick = () => {
        // Check if keyboard player already exists
        const existingPlayers = localPlayerManager.getAllPlayers();
        const hasKeyboardPlayer = existingPlayers.some(p => p.inputMethod === 'keyboard');
        
        // Update prompt text if keyboard is already taken
        const promptText = document.getElementById('add-player-prompt-text');
        if (hasKeyboardPlayer) {
            promptText.innerHTML = 'Press <span class="text-blue-400">START</span> on a controller';
        } else {
            promptText.innerHTML = 'Press <span class="text-green-400">ENTER</span> (keyboard) or <span class="text-blue-400">START</span> (controller)';
        }
        
        addPlayerBtn.classList.add('hidden');
        addPlayerPrompt.classList.remove('hidden');
        startInputDetection(hasKeyboardPlayer);
    };
    
    cancelPromptBtn.onclick = resetUI;
    
    // Input detection
    const startInputDetection = (hasKeyboardPlayer) => {
        const handleKeyboard = (e) => {
            if (e.key === 'Enter' && !hasKeyboardPlayer) {
                detectedInputType = 'keyboard';
                document.removeEventListener('keydown', handleKeyboard);
                if (inputDetectionFrame) {
                    cancelAnimationFrame(inputDetectionFrame);
                    inputDetectionFrame = null;
                }
                showNameEntry();
            }
        };
        
        const handleGamepad = () => {
            const gamepads = navigator.getGamepads();
            
            for (let i = 0; i < gamepads.length; i++) {
                const gp = gamepads[i];
                if (gp && gp.buttons[9] && gp.buttons[9].pressed) { // START button
                    detectedInputType = 'controller';
                    detectedGamepadIndex = i;
                    document.removeEventListener('keydown', handleKeyboard);
                    if (inputDetectionFrame) {
                        cancelAnimationFrame(inputDetectionFrame);
                        inputDetectionFrame = null;
                    }
                    showNameEntry();
                    return;
                }
            }
            
            inputDetectionFrame = requestAnimationFrame(handleGamepad);
        };
        
        document.addEventListener('keydown', handleKeyboard);
        handleGamepad();
    };
    
    // Step 2: Show name entry
    const showNameEntry = () => {
        addPlayerPrompt.classList.add('hidden');
        addPlayerNameEntry.classList.remove('hidden');
        addPlayerIcon.textContent = detectedInputType === 'keyboard' ? '⌨️' : '🎮';
        addPlayerNameInput.focus();
    };
    
    // Step 3: Confirm and add player
    const confirmAddPlayer = () => {
        const name = addPlayerNameInput.value.trim();
        if (!name) {
            errorEl.textContent = 'Name is required';
            return;
        }
        if (name.length > 12) {
            errorEl.textContent = 'Name too long (max 12)';
            return;
        }
        
        // Add player to local player manager
        const player = localPlayerManager.addLocalPlayer({
            name: name,
            inputMethod: detectedInputType === 'keyboard' ? 'keyboard' : 'gamepad',
            controllerIndex: detectedInputType === 'keyboard' ? null : detectedGamepadIndex,
            socketId: window.socket.id
        });
        
        if (!player) {
            errorEl.textContent = 'Failed to add player';
            return;
        }
        
        // Register with server
        const allPlayers = localPlayerManager.getAllPlayers();
        const playersData = allPlayers.map(p => ({
            id: p.id,
            socketId: p.socketId,
            localIndex: p.localIndex,
            name: p.name,
            color: p.color,
            inputMethod: p.inputMethod,
            controllerIndex: p.controllerIndex
        }));
        
        window.socket.emit('registerLocalPlayers', {
            roomCode: window.roomCode,
            players: playersData
        });
        
        console.log(`Added local player: ${name} (${detectedInputType})`);
        
        resetUI();
        updateAddPlayerButton();
    };
    
    confirmAddBtn.onclick = confirmAddPlayer;
    cancelNameBtn.onclick = resetUI;
    addPlayerNameInput.onkeydown = (e) => {
        if (e.key === 'Enter') confirmAddPlayer();
        if (e.key === 'Escape') resetUI();
    };
    
    // Cleanup on screen change
    window.addEventListener('uiScreenChange', resetUI, { once: true });
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
                    socket.emit('leaveGame', { roomCode }, () => { 
                        localPlayerManager.clearAllPlayers(); // Clear local players when leaving
                        window.roomCode = null; window.gameState = {}; window.myId = null; showScreen('MENU'); 
                    });
                }
            };
            messageEl.appendChild(leaveBtn);
        }
    }
}