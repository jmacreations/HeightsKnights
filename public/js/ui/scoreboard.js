// public/js/ui/scoreboard.js

export function updateScoreboard(players, teams = null, isTeamMode = false, matchSettings = null) {
    const scoreboard = document.getElementById('scoreboard');
    if (!scoreboard) return;
    scoreboard.innerHTML = '';
    
    if (isTeamMode && teams) {
        const winType = matchSettings?.winType || 'LAST_KNIGHT_STANDING';
        
        // Show team scores for all team modes - either accumulated scores or round wins
        if (winType === 'KILL_BASED' || winType === 'TIME_BASED' || winType === 'LAST_KNIGHT_STANDING') {
            // Create horizontal container for teams
            const teamsContainer = document.createElement('div');
            teamsContainer.className = 'flex justify-center space-x-8 mb-2';
            
            // Show team scores in consistent order (not sorted by score)
            teams.forEach(team => {
                const teamEl = document.createElement('div');
                teamEl.className = 'text-center';
                
                const teamScore = document.createElement('div');
                teamScore.textContent = `${team.name}: ${team.score}`;
                teamScore.style.color = team.color;
                teamScore.className = 'font-bold text-lg';
                teamEl.appendChild(teamScore);
                
                // Show team members only for modes where individual scores matter
                if (winType !== 'LAST_KNIGHT_STANDING') {
                    const members = Object.values(players).filter(p => p.teamId === team.id);
                    if (members.length > 0) {
                        const memberList = document.createElement('div');
                        memberList.className = 'text-xs mt-1';
                        members.forEach(member => {
                            const memberEl = document.createElement('div');
                            memberEl.textContent = `${member.name}: ${member.score}`;
                            memberEl.style.color = member.color;
                            memberList.appendChild(memberEl);
                        });
                        teamEl.appendChild(memberList);
                    }
                }
                
                teamsContainer.appendChild(teamEl);
            });
            
            scoreboard.appendChild(teamsContainer);
        }
    } else {
        // Show individual scores
        const sortedPlayers = Object.values(players).sort((a, b) => b.score - a.score);
        sortedPlayers.forEach(p => {
            const scoreEl = document.createElement('span');
            scoreEl.textContent = `${p.name}: ${p.score}`;
            scoreEl.style.color = p.color;
            scoreboard.appendChild(scoreEl);
        });
    }
}