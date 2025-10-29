// public/js/ui/uiManager.js
import { getModeSelectHTML, addModeSelectListeners } from '../scenes/modeSelectScene.js';
import { getMatchSettingsHTML, addMatchSettingsListeners } from '../scenes/matchSettingsScene.js';
import { GAME_MODES } from '../config.js';

export function showScreen(screenName) {
    const container = document.getElementById('game-container');
    container.innerHTML = ''; // Clear previous screen
    document.getElementById('scoreboard').classList.add('hidden');
    document.getElementById('player-hud').classList.add('hidden');
    uiState = screenName;

    let screenHtml = '';

    if (screenName === 'MENU') {
        screenHtml = `
            <div id="MENU" class="ui-screen flex flex-col items-center justify-center p-8 bg-gray-800 rounded-lg shadow-xl">
                <h1 class="text-5xl mb-8">Heights Knights</h1>
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
    } else if (screenName === 'MODE_SELECT') {
        screenHtml = getModeSelectHTML(window.playerName);
    } else if (screenName === 'MATCH_SETTINGS') {
        screenHtml = getMatchSettingsHTML(window.playerName, window.selectedGameMode);
    } else if (screenName === 'LOBBY') {
        const gameModeName = gameState.gameMode ? GAME_MODES[gameState.gameMode]?.name : 'Deathmatch';
        const scoreTarget = gameState.matchSettings?.scoreTarget || 5;
        screenHtml = `
            <div id="LOBBY" class="ui-screen flex flex-col items-center p-8 bg-gray-800 rounded-lg shadow-xl w-[500px]">
                <h2 class="text-3xl mb-2">LOBBY</h2>
                <p class="text-2xl font-mono bg-gray-900 px-4 py-2 rounded-md mb-2">${roomCode}</p>
                <div class="text-sm text-gray-400 mb-4 text-center flex items-center gap-3">
                    <div>
                        <p>Mode: <span class="text-white">${gameModeName}</span></p>
                        <p>Score to Win: <span id="lobby-score-target" class="text-green-400">${scoreTarget}</span></p>
                    </div>
                    <button id="edit-settings-btn" class="hidden bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded text-xs">⚙ Edit</button>
                </div>
                <div id="player-list" class="flex flex-col items-center w-full gap-2 min-h-[100px]"></div>
                <button id="start-game-btn" class="btn btn-green w-full mt-6 hidden">Start Game</button>
            </div>`;
    } else if (screenName === 'GAME') {
        screenHtml = `<canvas id="gameCanvas"></canvas>`;
        document.getElementById('scoreboard').classList.remove('hidden');
        document.getElementById('player-hud').classList.remove('hidden');
    }

    container.innerHTML = screenHtml;
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
            showScreen('MODE_SELECT');
        };
        document.getElementById('join-room-btn').onclick = () => {
            const name = document.getElementById('name-input').value;
            const code = document.getElementById('room-code-input').value.toUpperCase();
            if (name && code) socket.emit('joinRoom', { roomCode: code, playerName: name });
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
}

export function showMessage(text, duration, isMatchOver = false) {
    let messageEl = document.getElementById('game-message');
    if (!messageEl) {
        messageEl = document.createElement('div');
        messageEl.id = 'game-message';
        messageEl.className = 'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-5xl text-center bg-black bg-opacity-50 p-6 rounded-lg';
        document.getElementById('game-container').appendChild(messageEl);
    }
    messageEl.textContent = text;
    messageEl.classList.remove('hidden');

    if (duration !== Infinity) {
        setTimeout(() => messageEl.classList.add('hidden'), duration);
    }

    if (isMatchOver) {
        const playAgainBtn = document.createElement('button');
        playAgainBtn.textContent = 'Play Again';
        playAgainBtn.className = 'btn btn-green block mx-auto mt-6 text-2xl';
        playAgainBtn.onclick = () => socket.emit('playAgain', roomCode);
        messageEl.appendChild(playAgainBtn);
    }
}