- [x] Scores are not resetting at the end of a match when returning to the lobby.
- [x] The Laser weapon fires at the end of the countdown, even if the player was killed during the powerup.
- [x] the bounding box of the player seems to be square when the players is round. The hitbox should be the circle of the main body of the player.
- [x] LMS Team Battle HUD shows individual player scores instead of only team scores.



Scenarios/Tests

- Deathmatch (Individual)
    - Last Man Standing
        - HUD: Individual scores displayed
        - WIN: Player gets a round win point for being the last man standing. Player that reaches the total wins number wins the match.
    - Time Based Win
        - HUD: Shows the individual players scores and the Time remaining.
        - WIN: player with the highest score at the end of the timer wins.
    - Kill Based Win
        - HUD: Shows the individual players scores
        - WIN: Player that meets the target score first wins.

- Team Battles
    - Last Man Standing (x Rounds to win)
        - HUD: Should only display the team scores, players individual scores should not be seen.
        - WIN CONDITION: The last team standing wins the round. Match is won when the team reaches the win.
    - Time Based Win
        - HUD: Show team total that is a sum of the players. Individual player scores also visible.
        - WIN CONDITION: When the time is up, the team with the most kills wins.
    - Kill Based Win
        - HUD: Show team total that is a sum of the players. Individual player scores also visible.
        - WIN CONDITION: When the team score reaches the win condition, that team wins.