# electric_beats

A rhythm space shooter played on a 4x3 matrix keypad. A song stored in JSON
schedules asteroids onto twelve slots arranged under a spaceship; pressing
the matching key in time makes the ship face the asteroid and shoot it.
All audio comes from the Pico's speaker, not the browser. The firmware
README documents the wiring, the synth patch, and the pot-selected effects.

## Modules

- `firmware/` keypad scan, `K <key>` serial output, and all sound.
- `web/server/` serves the client, bridges serial to the `/ws` websocket.
- `web/client/src/game/engine.js` pure game state: slots, song clock,
  spawn and expiry, hit detection, score.
- `web/client/src/pages/Game.jsx` canvas rendering and websocket input.
- `web/client/src/assets/song.json` tempo and the key sequence.

## Non-goals

Out of scope: multiple songs, keyboard input, score persistence.

Backlog: lives and a game over screen, hit timing grades, explosion
animation, bandlimited oscillators, audio effects (echo, bitcrush, wah).

## Riskiest parts

The engine's beat clock and hit windows, and the firmware's preset
switching at zone boundaries. No tests for this hack; verify by playing.

## Commands

- Server, from `web/`: `npm i`, then `npm run start`. Runs on
  http://localhost:5173.
- Client, from `web/client/`: `npm i`, then `npm run build` or
  `npm run watch`.
- No required environment variables. The serial device is hardcoded to
  `/dev/ttyACM0` in `web/server/index.js`; without the keypad the game
  runs but receives no input.
