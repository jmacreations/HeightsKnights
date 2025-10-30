// public/js/scenes/lobbyScene.js
import { GAME_MODES } from '../config.js';

export function updateLobbyUI() {
    if (!gameState.players) return;
    const playerList = document.getElementById('player-list');
    if(!playerList) return;
    playerList.innerHTML = '';
    
    const playerCount = Object.keys(gameState.players).length;
    const isTeamMode = gameState.matchSettings?.playType === 'team';
    
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
        if (id === gameState.hostId) name += " (Host)";
        
        const playerEl = document.createElement('div');
        playerEl.className = 'bg-gray-700 p-3 rounded-lg w-full max-w-md text-center text-lg flex items-center justify-between';
        playerEl.style.color = player.color;
        
        const nameSpan = document.createElement('span');
        nameSpan.textContent = name;
        playerEl.appendChild(nameSpan);
        
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
            
            // Add team selection buttons for host
            if (myId === gameState.hostId) {
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
}