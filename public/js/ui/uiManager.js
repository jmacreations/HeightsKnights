// public/js/ui/uiManager.js

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
    } else if (screenName === 'LOBBY') {
        screenHtml = `
            <div id="LOBBY" class="ui-screen flex flex-col items-center p-8 bg-gray-800 rounded-lg shadow-xl w-[500px]">
                <h2 class="text-3xl mb-2">LOBBY</h2>
                <p class="text-2xl font-mono bg-gray-900 px-4 py-2 rounded-md mb-6">${roomCode}</p>
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
            const name = document.getElementById('name-input').value;
            if (name) socket.emit('createRoom', name);
        };
        document.getElementById('join-room-btn').onclick = () => {
            const name = document.getElementById('name-input').value;
            const code = document.getElementById('room-code-input').value.toUpperCase();
            if (name && code) socket.emit('joinRoom', { roomCode: code, playerName: name });
        };
    } else if (screenName === 'LOBBY') {
        const startGameBtn = document.getElementById('start-game-btn');
        if (startGameBtn) {
            startGameBtn.onclick = () => socket.emit('startGame', roomCode);
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