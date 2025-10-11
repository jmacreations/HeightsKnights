// public/js/scenes/lobbyScene.js

export function updateLobbyUI() {
    if (!gameState.players) return;
    const playerList = document.getElementById('player-list');
    if(!playerList) return;
    playerList.innerHTML = '';
    
    const playerCount = Object.keys(gameState.players).length;
    for (const id in gameState.players) {
        const player = gameState.players[id];
        let name = player.name;
        if (id === gameState.hostId) name += " (Host)";
        const playerEl = document.createElement('div');
        playerEl.className = 'bg-gray-700 p-3 rounded-lg w-full max-w-md text-center text-lg';
        playerEl.style.color = player.color;
        playerEl.textContent = name;
        playerList.appendChild(playerEl);
    }

    const startGameBtn = document.getElementById('start-game-btn');
    if (myId === gameState.hostId) {
        startGameBtn.classList.remove('hidden');
        if (playerCount > 1) {
            startGameBtn.disabled = false;
            startGameBtn.textContent = 'Start Game';
        } else {
            startGameBtn.disabled = true;
            startGameBtn.textContent = 'Waiting for players...';
        }
    }
}