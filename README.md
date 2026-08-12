# electric_beats

UCLA Engineering TR-1 Hack Project. A Pico 2 keypad wired to a browser. This
repo consists of the firmware, the web client and local server code, and any
miscellaneous files that are involved with the project.

It is a rhythm space shooter. A song stored in JSON schedules asteroids onto
twelve slots under a spaceship; press the matching key in time and the ship
turns and shoots. The Pico synthesizes the note it plays, so all audio comes
from the speaker on the board and the browser stays silent.

## Quick start

Copy the firmware to the board, then run the server:

```
cp firmware/code.py /media/$USER/CIRCUITPY/
cd web
npm install
npm start
```

Open http://localhost:5173 and press a key. Three songs ship in
`web/client/src/assets/song.json`; pick one from the menu above the canvas.

The board needs CircuitPython 10.x flashed once first, see `firmware/README.md`.

No board handy? The server still starts and serves the page, the game just
gets no input. There is no keyboard fallback.

Running the demo across two machines, one with the Pico and one on the
projector, is written up in `web/instruction.md`.

## Layout

| Path | What it is |
| --- | --- |
| `firmware/` | CircuitPython `code.py`, plus wiring and synth notes |
| `web/server/` | Serial bridge, websocket relay, static host |
| `web/client/` | React game canvas, bundled with esbuild |
| `misc/` | Sound sheets, pinout image, playing reference |

`DESIGN.md` covers the module split and what was cut.
