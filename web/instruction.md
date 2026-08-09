# Running the demo on two computers

The Pico must be plugged into the machine running the server, because the
server reads the keypad over USB serial. The projector is driven by a
second machine that loads the same page in a browser. Both screens show
the game and stay in step.

- Server machine: runs the server, has the Pico on USB, shows the game.
- Projector machine: browser only, on the same network.

## Server machine

```
cd web
npm i
npm run start
```

That builds the client and starts the server on port 5173. Leave it
running. It prints two lines when healthy:

```
electric_beats on http://localhost:5173
keypad connected on /dev/ttyACM0
```

If it prints `keypad unavailable`, the Pico is not on `/dev/ttyACM0`.
Check that it is plugged in and that nothing else holds the port; a
serial monitor such as `screen` will block the server.

Open the game locally at:

```
http://localhost:5173
```

Find the machine's address for the projector machine to use:

```
ip -4 addr show scope global | grep -oP 'inet \K[\d.]+'
```

Pick the address on your actual network. On this machine that is
currently `172.28.88.71`, so the projector machine would open
`http://172.28.88.71:5173`. The address changes between networks, so
check it again at the venue.

## Projector machine

Open a browser and go to `http://<server-address>:5173`. Nothing to
install. Press F11 for fullscreen.

If the page does not load, work through these in order:

1. Both machines are on the same network, not one on guest wifi.
2. `ping <server-address>` from the projector machine.
3. The server machine's firewall allows port 5173. On Ubuntu, either
   `sudo ufw allow 5173` or turn the firewall off for the demo.
4. You used `http://`, not `https://`.

## How the two screens stay in step

Every screen runs its own copy of the game and draws natively, so both
look sharp. Keeping them together works like this:

- Key presses come from the Pico, through the server, out to every
  connected browser at once.
- Start, Retry and song selection do not act locally. The browser sends
  the request to the server, the server relays it to every browser, and
  each one acts when the message arrives. That includes the browser that
  sent it, so no screen jumps ahead.

The runs are therefore driven by the same events from the same instant
and stay together for the length of a song. They are separate engines,
not a video feed, so the two screens can drift by a frame. Scores match.

If the server is unreachable the buttons still drive the local screen
alone, so a single machine works with no server for layout work.

## Notes

- Start the demo from one screen only. Pressing Start on both is
  harmless, but pressing it twice sends two messages.
- Refreshing the projector machine mid-run gives it a fresh engine, so
  it will be out of step until the next Start or song change.
- Both browsers should be at the same zoom level, otherwise the canvas
  is scaled differently on each screen.

## Fallback

If the network at the venue blocks this, mirror the screen instead. On
the server machine run `x11vnc -display :0` and connect from the
projector machine with any VNC viewer, fullscreen. That is pixel
identical and needs no game changes, but it is a video stream, so it
looks softer and adds a little latency.
