# electric_beats

UCLA Engineering TR-1 Hack Project. A Pico 2 keypad wired to a browser. This
repo consists of the firmware, the web client and local server code, and any
miscelaneous files that are involved with the project.

Right now it does one thing: press a key on the keypad and the browser shows
that key, big. The synth and the rhythm game were stripped back out so the
input path could be rebuilt from the bottom. `DESIGN.md` lists what is coming
back.

## Quick start

Flash the board, then run the server:

```
arduino-cli compile -u -p /dev/ttyACM0 -b rp2040:rp2040:rpipico2 firmware/keypad
cd web
npm install
npm start
```

Open http://localhost:5173 and press a key.

No board handy? The server still starts and serves the page, it just has
nothing to show. There is no keyboard fallback yet.

## Layout

| Path | What it is |
| --- | --- |
| `firmware/` | Arduino sketch, plus wiring and flashing notes |
| `web/server/` | Serial bridge, static host |
| `web/client/` | React readout, bundled with esbuild |
| `misc/` | Sound sheets, pinout image, playing reference |

`DESIGN.md` covers the module split and what was cut.
