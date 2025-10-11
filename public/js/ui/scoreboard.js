// public/js/ui/scoreboard.js

export function updateScoreboard(players) {
    const scoreboard = document.getElementById('scoreboard');
    if (!scoreboard) return;
    scoreboard.innerHTML = '';
    const sortedPlayers = Object.values(players).sort((a, b) => b.score - a.score);
    sortedPlayers.forEach(p => {
        const scoreEl = document.createElement('span');
        scoreEl.textContent = `${p.name}: ${p.score}`;
        scoreEl.style.color = p.color;
        scoreboard.appendChild(scoreEl);
    });
}