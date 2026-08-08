# DESIGN: keypad readout

## What it does

Press a key on the physical keypad and the browser shows that key's label,
filling the window. Nothing else. That is the whole product.

This is a reset. The point is to prove the path from a finger on the keypad to
a pixel in the browser end to end, with as little code in between as can be
written, so that everything added later is added onto something known good.

## Signal path

```
keypad -> Pico firmware -> USB CDC -> Node server -> WebSocket -> React
```

Every stage is a passthrough. The firmware decides which key was pressed and
nothing downstream reinterprets it: the label travels as the character printed
on the key, so no stage has to hold a copy of the keypad layout.

## Module split

| Module | Responsibility |
| --- | --- |
| `firmware/keypad` | Scan the matrix, debounce, print one line per press |
| `web/server/serial.js` | Open the port, frame lines, emit key presses |
| `web/server/index.js` | Static file serving, WebSocket broadcast |
| `web/client/src/App.jsx` | The one component, socket to screen |
| `web/client/src/main.jsx` | Mount |

The client is React, bundled by esbuild, and is one component holding one piece
of state. There is no `core/` layer because there is nothing yet that would be
worth keeping across a UI rewrite.

## Event protocol

Firmware to server, one line per debounced press:

```
K <label>
```

where `<label>` is one of `1 2 3 4 5 6 7 8 9 * 0 #`.

Server to browser:

```json
{ "type": "key", "key": "7" }
```

Releases are not reported. The readout shows the last key pressed and holds it
until the next one, so a key coming back up is not an event anyone needs.

There is no browser to server direction at all.

## The part most likely to be wrong

**Line framing in `web/server/serial.js`.** Serial data arrives in whatever
chunks USB feels like delivering, which has nothing to do with where the
newlines are. A press can arrive split across two chunks, three presses can
arrive in one chunk, and the board prints while the server is not yet listening
so the first chunk is usually a fragment of some earlier line. Getting this
wrong drops presses or invents them, and it fails intermittently and under
speed, which is the worst kind to chase.

There are no tests yet. The buffer holds everything after the last newline and
nothing is parsed until its newline arrives, which is the whole trick. When
this grows past ten lines it earns a test file, and these are the cases:

- A line split across two chunks, including a split inside the label.
- Several lines in one chunk.
- A leading fragment of a line that was never started.
- Noise lines that are not key lines, dropped without eating the lines around
  them.
- The same key twice in a row, which is a real repeat and must not be collapsed.
- Trailing carriage returns, since not every print path ends a line the same way.

## Implementation decisions

The code carries no explanatory comments, so the reasoning lives here.

### Firmware

- Idle keypad rows sit high impedance and only the scanned row is driven low.
  Driving the others high would let two keys in one column short two outputs
  together.
- A press must read the same way twice in a row to count. One reading is the
  contact bounce talking.
- Only the pressed edge prints. The release edge is tracked anyway because
  without it a held key would print on every pass.

### Server

- The serial source retries on failure instead of exiting, so the server runs
  and serves the page with no board attached, and picks the board up whenever
  it appears.
- The port and the serial path are constants in the source. There is one board
  and one machine, so a variable to override them is a setting nobody sets.
- Static file paths are resolved first and then checked for containment, so
  `..` cannot escape the client directory.
- Broadcast is fire and forget. A browser that missed a press while
  disconnected has missed it, and the next press replaces it anyway.

### Client

- One `useState` holding a string. The socket is the only input and the
  character is the only state, so anything more is scaffolding for features
  that do not exist yet.
- The effect closes the socket on cleanup. Without it, React's development
  double mount leaves a second socket alive forever.

## Non-goals: does not belong in this project

- Browser synthesis. When sound comes back, the hardware is the instrument.
- Multiplayer or network play.
- Accounts and hosted leaderboards.
- Mobile or touch input.

## Non-goals: cut to ship faster (backlog)

- Audio. The synth sketch is gone from this branch and comes back on its own.
- The rhythm game: charts, monsters, hit windows, scoring.
- Device timestamps in the event line, needed the moment timing is judged.
- Note-off events, needed the moment a key being held means something.
- A keyboard fallback for developing with no board attached.
- Reconnecting the WebSocket after the server restarts.
- Tests, once line framing is worth locking down.
- Anything from the pots and the effect switches on GP16-GP18.
- Showing more than one key at a time, which is what the keypad can actually
  report.

## Commands

Flash the controller:

```
arduino-cli compile -u -p /dev/ttyACM0 -b rp2040:rp2040:rpipico2 firmware/keypad
```

Run it. All Node code lives under `web/`, which is the npm root:

```
cd web
npm install
npm start
```

Then open `http://localhost:5173` and press a key. `npm start` builds the
client bundle first, so there is no separate build step to forget. While
iterating on the client, `npm run watch` rebuilds on change next to a running
`npm start`.

There are no tests yet, and no environment variables. Port `5173` and serial
path `/dev/ttyACM0` are constants at the top of `web/server/index.js`. There
are no secrets.
