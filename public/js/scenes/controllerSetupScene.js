// public/js/scenes/controllerSetupScene.js

/**
 * Controller Setup Scene
 * Allows players to claim input methods (keyboard or controllers) and customize their settings
 */

import { showScreen } from '../ui/uiManager.js';
import { localPlayerManager } from '../input/localPlayerManager.js';
import { gamepadManager } from '../input/gamepadManager.js';
import { getPlayModeContext } from './playModeScene.js';

let updateInterval = null;
let pendingPlayers = []; // Players waiting to claim input

/**
 * Initialize the controller setup scene
 */
export function initControllerSetupScene() {
    const container = document.getElementById('controller-setup-screen');
    if (!container) {
        console.error('Controller setup screen container not found');
        return;
    }
    
    // Clear existing content
    container.innerHTML = '';
    
    // Clear previous local players
    localPlayerManager.clearAllPlayers();
    pendingPlayers = [];
    
    // Create layout
    createLayout(container);
    
    // Start polling for input
    startInputPolling();
}

/**
 * Create the scene layout
 */
function createLayout(container) {
    // Title
    const title = document.createElement('h2');
    title.className = 'text-4xl font-bold mb-4 text-white';
    title.textContent = 'Controller Setup';
    container.appendChild(title);
    
    // Instructions
    const instructions = document.createElement('p');
    instructions.className = 'text-lg mb-2 text-gray-300';
    instructions.textContent = 'Press ENTER on keyboard or START on controller to join';
    container.appendChild(instructions);
    
    const subInstructions = document.createElement('p');
    subInstructions.className = 'text-sm mb-8 text-gray-400';
    subInstructions.textContent = '(Use any button on controller to test connection)';
    container.appendChild(subInstructions);
    
    // Available inputs section
    const availableSection = document.createElement('div');
    availableSection.id = 'available-inputs';
    availableSection.className = 'mb-8 p-4 bg-gray-800 rounded-lg max-w-2xl w-full';
    container.appendChild(availableSection);
    
    // Player slots section
    const slotsSection = document.createElement('div');
    slotsSection.id = 'player-slots';
    slotsSection.className = 'mb-8 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl w-full';
    container.appendChild(slotsSection);
    
    // Buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'flex gap-4';
    
    const continueBtn = document.createElement('button');
    continueBtn.id = 'continue-btn';
    continueBtn.className = 'bg-green-600 hover:bg-green-500 text-white px-8 py-3 rounded-lg text-lg transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed';
    continueBtn.textContent = 'Continue';
    continueBtn.disabled = true;
    continueBtn.onclick = handleContinue;
    buttonContainer.appendChild(continueBtn);
    
    const backBtn = document.createElement('button');
    backBtn.className = 'bg-gray-600 hover:bg-gray-500 text-white px-8 py-3 rounded-lg text-lg transition-colors';
    backBtn.textContent = 'Back';
    backBtn.onclick = handleBack;
    buttonContainer.appendChild(backBtn);
    
    container.appendChild(buttonContainer);
    
    // Initial render
    renderAvailableInputs();
    renderPlayerSlots();
}

/**
 * Start polling for input to detect new players
 */
function startInputPolling() {
    if (updateInterval) {
        clearInterval(updateInterval);
    }
    
    updateInterval = setInterval(() => {
        checkForNewInputs();
        renderAvailableInputs();
    }, 100);
}

/**
 * Stop polling
 */
function stopInputPolling() {
    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
    }
}

/**
 * Check for new input presses
 */
function checkForNewInputs() {
    // Keyboard is handled by keydown event listener (only Enter key)
    
    // Check gamepads for START button specifically
    const gamepads = gamepadManager.getAllConnectedControllers();
    gamepads.forEach(gamepadData => {
        const index = gamepadData.index;
        
        // Skip if already assigned
        if (localPlayerManager.isInputMethodAssigned('gamepad', index)) {
            return;
        }
        
        // Check if START button pressed (button index 9 on standard mapping)
        const startButtonPressed = gamepadData.input.buttons[9]; // START button
        
        if (startButtonPressed) {
            addPendingPlayer('gamepad', index);
        }
    });
}

/**
 * Add a pending player
 */
function addPendingPlayer(inputMethod, controllerIndex = null) {
    // Check if already pending
    const existing = pendingPlayers.find(p => 
        p.inputMethod === inputMethod && p.controllerIndex === controllerIndex
    );
    if (existing) return;
    
    // Check if can add more
    if (!localPlayerManager.canAddPlayer()) {
        console.log('Maximum players reached');
        return;
    }
    
    const playerNum = localPlayerManager.getPlayerCount() + 1;
    const inputLabel = inputMethod === 'keyboard' ? 'Keyboard' : `Controller ${controllerIndex + 1}`;
    
    pendingPlayers.push({
        inputMethod,
        controllerIndex,
        name: `Player ${playerNum}`,
        color: null // Will be assigned when confirmed
    });
    
    console.log(`Player ${playerNum} claimed ${inputLabel}`);
    
    // Add to local player manager
    const player = localPlayerManager.addLocalPlayer({
        name: `Player ${playerNum}`,
        inputMethod,
        controllerIndex,
        socketId: myId || 'temp'
    });
    
    if (player) {
        renderPlayerSlots();
        updateContinueButton();
    }
}

/**
 * Remove a player
 */
function removePlayer(playerId) {
    localPlayerManager.removeLocalPlayer(playerId);
    renderPlayerSlots();
    updateContinueButton();
}

/**
 * Render available inputs
 */
function renderAvailableInputs() {
    const container = document.getElementById('available-inputs');
    if (!container) return;
    
    container.innerHTML = '<h3 class="text-xl font-bold mb-3 text-white">Available Inputs</h3>';
    
    const inputList = document.createElement('div');
    inputList.className = 'flex flex-wrap gap-2';
    
    // Keyboard
    const keyboardAssigned = localPlayerManager.isInputMethodAssigned('keyboard');
    const keyboardChip = createInputChip('⌨️ Keyboard', keyboardAssigned);
    inputList.appendChild(keyboardChip);
    
    // Controllers
    const gamepads = gamepadManager.getAllConnectedControllers();
    for (let i = 0; i < 4; i++) {
        const connected = gamepads.some(g => g.index === i);
        const assigned = localPlayerManager.isInputMethodAssigned('gamepad', i);
        
        if (connected) {
            const controllerChip = createInputChip(`🎮 Controller ${i + 1}`, assigned);
            inputList.appendChild(controllerChip);
        }
    }
    
    container.appendChild(inputList);
}

/**
 * Create an input chip element
 */
function createInputChip(label, assigned) {
    const chip = document.createElement('div');
    chip.className = `px-4 py-2 rounded-full text-sm font-medium ${
        assigned ? 'bg-gray-600 text-gray-400' : 'bg-blue-600 text-white'
    }`;
    chip.textContent = assigned ? `${label} (In Use)` : label;
    return chip;
}

/**
 * Render player slots
 */
function renderPlayerSlots() {
    const container = document.getElementById('player-slots');
    if (!container) return;
    
    container.innerHTML = '';
    
    const players = localPlayerManager.getAllPlayers();
    
    // Show up to 4 slots
    for (let i = 0; i < 4; i++) {
        const player = players[i];
        const slotEl = createPlayerSlot(i + 1, player);
        container.appendChild(slotEl);
    }
}

/**
 * Create a player slot element
 */
function createPlayerSlot(slotNumber, player) {
    const slot = document.createElement('div');
    slot.className = `p-4 rounded-lg border-2 ${
        player ? 'border-blue-500 bg-gray-800' : 'border-gray-600 bg-gray-900'
    }`;
    
    if (player) {
        // Player assigned
        const header = document.createElement('div');
        header.className = 'flex justify-between items-center mb-3';
        
        const title = document.createElement('h4');
        title.className = 'text-lg font-bold';
        title.style.color = player.color;
        title.textContent = `Player ${slotNumber}`;
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'text-red-500 hover:text-red-400 text-sm';
        removeBtn.textContent = '✕ Remove';
        removeBtn.onclick = () => removePlayer(player.id);
        
        header.appendChild(title);
        header.appendChild(removeBtn);
        slot.appendChild(header);
        
        // Input method
        const inputLabel = player.inputMethod === 'keyboard' 
            ? '⌨️ Keyboard' 
            : `🎮 Controller ${player.controllerIndex + 1}`;
        const inputEl = document.createElement('div');
        inputEl.className = 'text-sm text-gray-400 mb-3';
        inputEl.textContent = inputLabel;
        slot.appendChild(inputEl);
        
        // Name input
        const nameLabel = document.createElement('label');
        nameLabel.className = 'block text-sm text-gray-400 mb-1';
        nameLabel.textContent = 'Name:';
        slot.appendChild(nameLabel);
        
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none mb-3';
        nameInput.value = player.name;
        nameInput.maxLength = 20;
        nameInput.onchange = (e) => {
            player.name = e.target.value || `Player ${slotNumber}`;
        };
        slot.appendChild(nameInput);
        
        // Color indicator
        const colorLabel = document.createElement('label');
        colorLabel.className = 'block text-sm text-gray-400 mb-1';
        colorLabel.textContent = 'Color:';
        slot.appendChild(colorLabel);
        
        const colorBox = document.createElement('div');
        colorBox.className = 'w-full h-8 rounded border border-gray-600';
        colorBox.style.backgroundColor = player.color;
        slot.appendChild(colorBox);
        
    } else {
        // Empty slot
        const emptyText = document.createElement('div');
        emptyText.className = 'text-center text-gray-500 py-8';
        emptyText.textContent = 'Empty Slot';
        slot.appendChild(emptyText);
    }
    
    return slot;
}

/**
 * Update continue button state
 */
function updateContinueButton() {
    const continueBtn = document.getElementById('continue-btn');
    if (!continueBtn) return;
    
    const playerCount = localPlayerManager.getPlayerCount();
    continueBtn.disabled = playerCount === 0;
}

/**
 * Handle continue button
 */
function handleContinue() {
    stopInputPolling();
    
    const context = getPlayModeContext();
    
    if (context === 'create') {
        // Go to mode select
        showScreen('MODE_SELECT');
    } else {
        // Join the room with local players
        const code = window.pendingRoomCode;
        const name = window.playerName;
        if (code && name) {
            socket.emit('joinRoom', { roomCode: code, playerName: name });
        }
    }
}

/**
 * Handle back button
 */
function handleBack() {
    stopInputPolling();
    localPlayerManager.clearAllPlayers();
    showScreen('PLAY_MODE');
}

/**
 * Cleanup when leaving scene
 */
export function cleanupControllerSetupScene() {
    stopInputPolling();
}

// Keyboard detection - only Enter key
document.addEventListener('keydown', (e) => {
    // Only detect when on controller setup screen
    if (window.uiState !== 'CONTROLLER_SETUP') return;
    
    // Only respond to Enter key
    if (e.code !== 'Enter' && e.key !== 'Enter') return;
    
    // Skip if keyboard already assigned
    if (localPlayerManager.isInputMethodAssigned('keyboard')) return;
    
    // Add keyboard player
    addPendingPlayer('keyboard', null);
});
