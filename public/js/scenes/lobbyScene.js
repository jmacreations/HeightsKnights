// public/js/scenes/lobbyScene.js
import { GAME_MODES } from '../config.js';
import { localPlayerManager } from '../input/localPlayerManager.js';
import { setupAddLocalPlayerUI } from '../ui/uiManager.js';

export function updateLobbyUI() {
    if (!gameState.players) return;
    const playerList = document.getElementById('player-list');
    if(!playerList) return;
    playerList.innerHTML = '';
    
    const localPlayers = localPlayerManager.getAllPlayers();
    const hasLocalPlayers = localPlayers.length > 0;
    const playerCount = Object.keys(gameState.players).length;
    const isTeamMode = gameState.matchSettings?.playType === 'team';
    
    // LOCAL PLAYERS SECTION
    if (hasLocalPlayers) {
        const localSection = document.createElement('div');
        localSection.className = 'mb-6 w-full max-w-md';
        
        const localTitle = document.createElement('h3');
        localTitle.className = 'text-2xl font-bold mb-3 text-yellow-400';
        localTitle.textContent = '💻 LOCAL PLAYERS';
        localSection.appendChild(localTitle);
        
        localPlayers.forEach(player => {
            const playerEl = document.createElement('div');
            playerEl.className = 'bg-gray-700 p-3 rounded-lg mb-2 flex items-center justify-between';
            playerEl.style.color = player.color;
            
            const leftSection = document.createElement('div');
            leftSection.className = 'flex items-center gap-2';
            
            const nameSpan = document.createElement('span');
            nameSpan.textContent = player.name;
            
            const inputLabel = player.inputMethod === 'keyboard' 
                ? '⌨️' 
                : `🎮`;
            const inputSpan = document.createElement('span');
            inputSpan.className = 'text-sm';
            inputSpan.textContent = inputLabel;
            
            leftSection.appendChild(inputSpan);
            leftSection.appendChild(nameSpan);
            
            // Remove button (only for additional players, not primary)
            if (player.localIndex > 0) {
                const removeBtn = document.createElement('button');
                removeBtn.className = 'text-red-400 hover:text-red-300 text-xl leading-none';
                removeBtn.textContent = '×';
                removeBtn.title = 'Remove player';
                removeBtn.onclick = () => {
                    if (confirm(`Remove ${player.name}?`)) {
                        localPlayerManager.removeLocalPlayer(player.id);
                        
                        // Re-register remaining players with server
                        const remaining = localPlayerManager.getAllPlayers();
                        window.socket.emit('registerLocalPlayers', {
                            roomCode: window.roomCode,
                            players: remaining.map(p => ({
                                id: p.id,
                                socketId: p.socketId,
                                localIndex: p.localIndex,
                                name: p.name,
                                color: p.color,
                                inputMethod: p.inputMethod,
                                controllerIndex: p.controllerIndex
                            }))
                        });
                        
                        updateLobbyUI();
                    }
                };
                playerEl.appendChild(leftSection);
                playerEl.appendChild(removeBtn);
            } else {
                playerEl.appendChild(leftSection);
            }
            
            localSection.appendChild(playerEl);
        });
        
        // Add the "+ Add Local Player" and "+ Add Bot" buttons and controls INSIDE the local section
        const addPlayerSection = document.createElement('div');
        addPlayerSection.className = 'w-full mt-3';
        addPlayerSection.innerHTML = `
            <div class="flex gap-2">
                ${playerCount < 8 ? `
                <button id="add-local-player-btn" class="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors">
                    + Add Local Player
                </button>
                ` : ''}
                ${myId === gameState.hostId && playerCount < 8 ? `
                <button id="add-bot-btn" class="flex-1 px-4 py-2 bg-purple-700 hover:bg-purple-600 text-white text-sm rounded transition-colors">
                    🤖 Add Bot
                </button>
                ` : ''}
            </div>
            <div id="add-player-prompt" class="hidden mt-2 p-4 bg-gray-700 rounded text-center">
                <p class="text-sm mb-2" id="add-player-prompt-text">Press <span class="text-green-400">ENTER</span> (keyboard) or <span class="text-blue-400">START</span> (controller)</p>
                <button id="cancel-add-player-btn" class="text-xs text-gray-400 hover:text-white mt-2">Cancel</button>
            </div>
            <div id="add-player-name-entry" class="hidden mt-2 p-4 bg-gray-700 rounded">
                <div class="text-center mb-2">
                    <span id="add-player-icon" class="text-2xl"></span>
                </div>
                <input id="add-player-name-input" type="text" placeholder="Enter name" class="input-field w-full mb-2" maxlength="12">
                <div class="flex gap-2">
                    <button id="confirm-add-player-btn" class="btn btn-green flex-1">Add</button>
                    <button id="cancel-add-player-name-btn" class="btn bg-gray-600 hover:bg-gray-500">Cancel</button>
                </div>
                <p id="add-player-error" class="text-red-400 text-xs mt-1 h-4"></p>
            </div>
            <div id="add-bot-difficulty" class="hidden mt-2 p-4 bg-gray-700 rounded">
                <p class="text-sm mb-3 text-center">Select Bot Difficulty:</p>
                <div class="flex flex-col gap-2">
                    <button data-difficulty="easy" class="bot-difficulty-btn px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded transition-colors">
                        😊 Easy
                    </button>
                    <button data-difficulty="medium" class="bot-difficulty-btn px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded transition-colors">
                        😐 Medium
                    </button>
                    <button data-difficulty="hard" class="bot-difficulty-btn px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded transition-colors">
                        😈 Hard
                    </button>
                </div>
                <button id="cancel-add-bot-btn" class="w-full mt-2 text-xs text-gray-400 hover:text-white">Cancel</button>
            </div>
        `;
        localSection.appendChild(addPlayerSection);
        
        playerList.appendChild(localSection);
        
        // Divider
        const divider = document.createElement('div');
        divider.className = 'w-full max-w-md h-px bg-gray-600 mb-6';
        playerList.appendChild(divider);
        
        // Online players title
        const onlineTitle = document.createElement('h3');
        onlineTitle.className = 'text-2xl font-bold mb-3 text-blue-400';
        onlineTitle.textContent = '🌐 ONLINE PLAYERS';
        playerList.appendChild(onlineTitle);
    } else {
        // If no local players yet, still add the buttons at the top
        const addPlayerSection = document.createElement('div');
        addPlayerSection.className = 'w-full mb-4';
        addPlayerSection.innerHTML = `
            <div class="flex gap-2">
                ${playerCount < 8 ? `
                <button id="add-local-player-btn" class="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors">
                    + Add Local Player
                </button>
                ` : ''}
                ${myId === gameState.hostId && playerCount < 8 ? `
                <button id="add-bot-btn" class="flex-1 px-4 py-2 bg-purple-700 hover:bg-purple-600 text-white text-sm rounded transition-colors">
                    🤖 Add Bot
                </button>
                ` : ''}
            </div>
            <div id="add-player-prompt" class="hidden mt-2 p-4 bg-gray-700 rounded text-center">
                <p class="text-sm mb-2" id="add-player-prompt-text">Press <span class="text-green-400">ENTER</span> (keyboard) or <span class="text-blue-400">START</span> (controller)</p>
                <button id="cancel-add-player-btn" class="text-xs text-gray-400 hover:text-white mt-2">Cancel</button>
            </div>
            <div id="add-player-name-entry" class="hidden mt-2 p-4 bg-gray-700 rounded">
                <div class="text-center mb-2">
                    <span id="add-player-icon" class="text-2xl"></span>
                </div>
                <input id="add-player-name-input" type="text" placeholder="Enter name" class="input-field w-full mb-2" maxlength="12">
                <div class="flex gap-2">
                    <button id="confirm-add-player-btn" class="btn btn-green flex-1">Add</button>
                    <button id="cancel-add-player-name-btn" class="btn bg-gray-600 hover:bg-gray-500">Cancel</button>
                </div>
                <p id="add-player-error" class="text-red-400 text-xs mt-1 h-4"></p>
            </div>
            <div id="add-bot-difficulty" class="hidden mt-2 p-4 bg-gray-700 rounded">
                <p class="text-sm mb-3 text-center">Select Bot Difficulty:</p>
                <div class="flex flex-col gap-2">
                    <button data-difficulty="easy" class="bot-difficulty-btn px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded transition-colors">
                        😊 Easy
                    </button>
                    <button data-difficulty="medium" class="bot-difficulty-btn px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded transition-colors">
                        😐 Medium
                    </button>
                    <button data-difficulty="hard" class="bot-difficulty-btn px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded transition-colors">
                        😈 Hard
                    </button>
                </div>
                <button id="cancel-add-bot-btn" class="w-full mt-2 text-xs text-gray-400 hover:text-white">Cancel</button>
            </div>
        `;
        playerList.appendChild(addPlayerSection);
    }
    
    // Show team balancing bonuses if in team mode
    if (isTeamMode && gameState.teams) {
        const teamsContainer = document.createElement('div');
        teamsContainer.className = 'mb-4';
        const teamSizes = {};
        gameState.teams.forEach(team => {
            teamSizes[team.id] = Object.values(gameState.players).filter(p => p.teamId === team.id).length;
        });
        const redSize = teamSizes.red || 0;
        const blueSize = teamSizes.blue || 0;
        const teamDiff = Math.abs(redSize - blueSize);
        
        if (teamDiff > 0) {
            const smallerTeam = redSize < blueSize ? gameState.teams.find(t => t.id === 'red') : gameState.teams.find(t => t.id === 'blue');
            const speedBonus = Math.min(1.0, teamDiff * 0.15); // Increased cap to 100%, higher multiplier
            const respawnBonus = Math.min(1.0, teamDiff * 0.15); // Increased cap to 100%, higher multiplier
            
            const bonusEl = document.createElement('div');
            bonusEl.className = 'text-center text-sm text-yellow-400 mb-2';
            bonusEl.textContent = `${smallerTeam.name} gets ${(speedBonus * 100).toFixed(0)}% speed & ${(respawnBonus * 100).toFixed(0)}% faster respawn`;
            teamsContainer.appendChild(bonusEl);
        }
        
        playerList.appendChild(teamsContainer);
    }
    
    for (const id in gameState.players) {
        const player = gameState.players[id];
        let name = player.name;
        
        // Check if this player is the host (compare socket IDs)
        const playerSocketId = player.socketId || player.id;
        if (playerSocketId === gameState.hostId) {
            name += " (Host)";
        }
        
        const playerEl = document.createElement('div');
        playerEl.className = 'bg-gray-700 p-3 rounded-lg w-full max-w-md text-center text-lg flex items-center justify-between';
        playerEl.style.color = player.color;
        
        const leftSection = document.createElement('div');
        leftSection.className = 'flex items-center gap-2';
        
        // Add bot icon if this is a bot
        if (player.isAI) {
            const botIcon = document.createElement('span');
            botIcon.textContent = '🤖';
            botIcon.title = `Bot (${player.aiDifficulty || 'medium'})`;
            leftSection.appendChild(botIcon);
        }
        
        const nameSpan = document.createElement('span');
        nameSpan.textContent = name;
        leftSection.appendChild(nameSpan);
        
        playerEl.appendChild(leftSection);
        
        // Show team info if in team mode
        if (isTeamMode) {
            const teamInfo = document.createElement('span');
            teamInfo.className = 'text-sm';
            if (player.teamId) {
                const team = gameState.teams?.find(t => t.id === player.teamId);
                if (team) {
                    teamInfo.textContent = `(${team.name})`;
                    teamInfo.style.color = team.color;
                }
            } else {
                teamInfo.textContent = '(No Team)';
                teamInfo.style.color = '#888';
            }
            playerEl.appendChild(teamInfo);
            
            // Add team selection buttons for host (only in lobby state)
            const roomState = gameState.state || 'LOBBY';
            if (myId === gameState.hostId && roomState === 'LOBBY') {
                const buttonContainer = document.createElement('div');
                buttonContainer.className = 'flex gap-1';
                
                gameState.teams?.forEach(team => {
                    const teamBtn = document.createElement('button');
                    teamBtn.className = 'px-2 py-1 text-xs rounded';
                    teamBtn.style.backgroundColor = team.color;
                    teamBtn.style.color = 'white';
                    teamBtn.textContent = team.id.toUpperCase();
                    teamBtn.onclick = () => {
                        socket.emit('assignTeam', { playerId: id, teamId: team.id, roomCode: roomCode });
                    };
                    buttonContainer.appendChild(teamBtn);
                });
                
                playerEl.appendChild(buttonContainer);
            }
        }
        
        // Add remove button for bots (host only)
        if (player.isAI && myId === gameState.hostId) {
            const removeBtn = document.createElement('button');
            removeBtn.className = 'text-red-400 hover:text-red-300 text-xl leading-none ml-2';
            removeBtn.textContent = '×';
            removeBtn.title = 'Remove bot';
            removeBtn.onclick = () => {
                if (confirm(`Remove bot ${player.name}?`)) {
                    socket.emit('removeBot', { roomCode: roomCode, botId: id });
                }
            };
            playerEl.appendChild(removeBtn);
        }
        
        playerList.appendChild(playerEl);
    }

    const startGameBtn = document.getElementById('start-game-btn');
    if (myId === gameState.hostId) {
        startGameBtn.classList.remove('hidden');
        const gameModeConfig = GAME_MODES[gameState.gameMode] || GAME_MODES.deathmatch;
        let canStart = playerCount >= gameModeConfig.minPlayers;
        
        // Additional checks for team mode
        if (isTeamMode) {
            canStart = canStart && playerCount >= gameModeConfig.minPlayers; // Use config min players for teams
            
            // Allow unbalanced teams - balancing bonuses will help smaller teams
        }
        
        if (canStart) {
            startGameBtn.disabled = false;
            startGameBtn.textContent = 'Start Game';
        } else {
            startGameBtn.disabled = true;
            if (isTeamMode && playerCount < gameModeConfig.minPlayers) {
                startGameBtn.textContent = `Need ${gameModeConfig.minPlayers}+ players for teams`;
            } else {
                startGameBtn.textContent = `Need ${gameModeConfig.minPlayers}+ players...`;
            }
        }
    }
    
    // Setup add player button listeners after DOM is updated
    setupAddLocalPlayerUI();
    setupAddBotUI();
}

function setupAddBotUI() {
    const addBotBtn = document.getElementById('add-bot-btn');
    const addBotDifficulty = document.getElementById('add-bot-difficulty');
    const cancelAddBotBtn = document.getElementById('cancel-add-bot-btn');
    const difficultyBtns = document.querySelectorAll('.bot-difficulty-btn');
    
    if (!addBotBtn) return;
    
    addBotBtn.addEventListener('click', () => {
        // Show difficulty selection
        addBotDifficulty.classList.remove('hidden');
        addBotBtn.disabled = true;
    });
    
    if (cancelAddBotBtn) {
        cancelAddBotBtn.addEventListener('click', () => {
            addBotDifficulty.classList.add('hidden');
            addBotBtn.disabled = false;
        });
    }
    
    difficultyBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const difficulty = btn.getAttribute('data-difficulty');
            
            // Send request to server
            socket.emit('addBot', {
                roomCode: roomCode,
                difficulty: difficulty
            });
            
            // Hide difficulty selection
            addBotDifficulty.classList.add('hidden');
            addBotBtn.disabled = false;
        });
    });
}