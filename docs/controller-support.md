# Controller Support

Heights Knights now supports game controllers using the standard Gamepad API! Connect an Xbox, PlayStation, or other standard controller to play with analog sticks and buttons.

## Xbox Controller Mapping (Standard Layout)

### Movement & Aiming
- **Left Analog Stick**: Move your knight (up/down/left/right)
- **Right Analog Stick**: Aim your weapon direction
- **D-Pad**: Alternative movement (if not using left stick)

### Combat Actions
- **Right Trigger (RT)**: Attack with current weapon
  - Hold for continuous fire (automatic weapons)
  - Release to stop attacking
- **A Button** (Bottom button): Lunge/Dash forward
- **Left Bumper (LB)**: Activate shield (when available)

### Menu & System
- **Start Button**: Pause menu (when implemented)

## PlayStation Controller Mapping

The controls map similarly to Xbox:
- **Left Stick**: Movement
- **Right Stick**: Aiming  
- **R2 Trigger**: Attack
- **X Button** (bottom): Lunge/Dash
- **L1 Bumper**: Shield
- **Options Button**: Pause menu

## Features

### Automatic Detection
- Controllers are automatically detected when connected
- A 🎮 icon appears in the HUD when a controller is active
- Plug-and-play - no configuration needed

### Mixed Input Support
- Use keyboard + mouse and controller simultaneously
- Controller input takes priority when analog sticks are moved
- Seamlessly switch between input methods

### Analog Precision
- **Dead Zone**: 15% stick dead zone prevents drift
- **Smooth Aiming**: Right stick provides 360° analog aiming
- **Variable Movement**: Analog stick allows walking vs. running speeds

### Trigger Sensitivity
- Analog trigger detection (10% threshold)
- Smooth attack activation
- Works with both analog and digital triggers

## Supported Controllers

Heights Knights supports any controller that follows the [Standard Gamepad mapping](https://w3c.github.io/gamepad/#remapping):

✅ Xbox One / Series X|S Controllers  
✅ PlayStation 4 / 5 DualShock/DualSense  
✅ Nintendo Switch Pro Controller  
✅ Steam Controller  
✅ Most third-party controllers with standard mapping  

## Browser Compatibility

Controller support works in:
- ✅ Google Chrome / Edge (Chromium)
- ✅ Mozilla Firefox
- ✅ Safari 14.1+
- ✅ Opera

## Tips for Best Experience

1. **Connect Before Starting**: Connect your controller before joining a game for instant recognition
2. **Use Right Stick for Aiming**: The right analog stick provides precise 360° aiming control
3. **Hold RT for Auto-Fire**: Keep right trigger held for continuous fire with automatic weapons
4. **Calibrate if Needed**: If experiencing drift, check your controller's dead zone settings in your system settings

## Troubleshooting

### Controller Not Detected
- Make sure the controller is connected before loading the game
- Check browser console for connection messages
- Try refreshing the page after connecting
- Verify controller works in your system settings

### Input Not Working
- Press some buttons to "wake up" the controller
- Make sure no other applications are using the controller
- Check that the controller shows as "standard" mapping in browser

### Stick Drift
- Increase dead zone value in `gamepadManager.js` (default: 0.15)
- Clean your controller's analog sticks
- Calibrate controller in system settings

## Technical Details

### Dead Zone
Default: 15% (0.15)
- Prevents unintentional movement from stick drift
- Values below dead zone are treated as zero
- Adjustable in `public/js/input/gamepadManager.js`

### Polling Rate
Controllers are polled every frame (~60 times per second) for responsive input.

### Button Layout Reference

Standard Gamepad Button Indices:
```
0  = A/Cross (Bottom)
1  = B/Circle (Right)  
2  = X/Square (Left)
3  = Y/Triangle (Top)
4  = LB/L1 (Left Bumper)
5  = RB/R1 (Right Bumper)
6  = LT/L2 (Left Trigger)
7  = RT/R2 (Right Trigger)
8  = Select/Share
9  = Start/Options
10 = L3 (Left Stick Press)
11 = R3 (Right Stick Press)
12 = D-Pad Up
13 = D-Pad Down
14 = D-Pad Left
15 = D-Pad Right
```

Standard Gamepad Axes:
```
0 = Left Stick X (horizontal)
1 = Left Stick Y (vertical)
2 = Right Stick X (horizontal)
3 = Right Stick Y (vertical)
```

## Future Enhancements

Planned features for controller support:
- [ ] Rumble/vibration feedback on hit/kill
- [ ] Button remapping in settings
- [ ] Menu navigation with controller
- [ ] Multiple controller support for local multiplayer
- [ ] Custom dead zone adjustment in settings
- [ ] Controller-specific button prompts in UI
