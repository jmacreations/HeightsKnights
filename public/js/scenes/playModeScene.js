// public/js/scenes/playModeScene.js

/**
 * Play Mode Selection Scene
 * Allows users to choose between Online Only and Local Multiplayer modes
 */

import { showScreen } from '../ui/uiManager.js';

let currentContext = null; // 'create' or 'join'

/**
 * Initialize the play mode selection scene
 * @param {string} context - Either 'create' (creating room) or 'join' (joining room)
 */
export function initPlayModeScene(context) {
    currentContext = context;
    
    const container = document.getElementById('play-mode-screen');
    if (!container) {
        console.error('Play mode screen container not found');
        return;
    }
    
    // Clear existing content
    container.innerHTML = '';
    
    // Create title
    const title = document.createElement('h2');
    title.className = 'text-4xl font-bold mb-8 text-white';
    title.textContent = context === 'create' ? 'Create Room' : 'Join Room';
    container.appendChild(title);
    
    // Create subtitle
    const subtitle = document.createElement('p');
    subtitle.className = 'text-xl mb-8 text-gray-300';
    subtitle.textContent = 'Select play mode:';
    container.appendChild(subtitle);
    
    // Create button container
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'flex flex-col gap-4 w-full max-w-md';
    
    // Online Only button
    const onlineBtn = createModeButton(
        'Online Only',
        'Standard online multiplayer - one player per device',
        () => handleModeSelection('online')
    );
    buttonContainer.appendChild(onlineBtn);
    
    // Local Multiplayer button
    const localBtn = createModeButton(
        'Local Multiplayer',
        'Multiple players on this device (keyboard + controllers)',
        () => handleModeSelection('local')
    );
    buttonContainer.appendChild(localBtn);
    
    container.appendChild(buttonContainer);
    
    // Back button
    const backBtn = document.createElement('button');
    backBtn.className = 'mt-8 bg-gray-600 hover:bg-gray-500 text-white px-6 py-3 rounded-lg text-lg transition-colors';
    backBtn.textContent = 'Back';
    backBtn.onclick = () => {
        showScreen('MENU');
    };
    container.appendChild(backBtn);
}

/**
 * Create a mode selection button
 */
function createModeButton(title, description, onClick) {
    const button = document.createElement('button');
    button.className = 'bg-blue-600 hover:bg-blue-500 text-white p-6 rounded-lg text-left transition-colors transform hover:scale-105';
    
    const titleEl = document.createElement('div');
    titleEl.className = 'text-2xl font-bold mb-2';
    titleEl.textContent = title;
    
    const descEl = document.createElement('div');
    descEl.className = 'text-sm text-gray-200';
    descEl.textContent = description;
    
    button.appendChild(titleEl);
    button.appendChild(descEl);
    button.onclick = onClick;
    
    return button;
}

/**
 * Handle mode selection
 */
function handleModeSelection(mode) {
    window.playMode = mode;
    
    if (mode === 'online') {
        // Skip controller setup, go directly to room creation/joining
        if (currentContext === 'create') {
            showScreen('MODE_SELECT');
        } else {
            // For join, join the room directly
            const code = window.pendingRoomCode;
            const name = window.playerName;
            if (code && name) {
                socket.emit('joinRoom', { roomCode: code, playerName: name });
            }
        }
    } else {
        // Go to controller setup
        showScreen('CONTROLLER_SETUP');
    }
}

/**
 * Get current play mode
 */
export function getPlayMode() {
    return window.playMode || 'online';
}

/**
 * Get current context (create/join)
 */
export function getPlayModeContext() {
    return currentContext;
}
