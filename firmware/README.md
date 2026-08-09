# Firmware

Reads twelve individual buttons, sends `K <key>` lines over USB serial at
115200, and synthesizes all game audio on the Pico. The browser is silent.

## Wiring

Each button connects its GPIO to GND; the firmware uses internal pull-ups.

| Signal | Pico 2 | Physical pin |
| --- | --- | --- |
| Buttons 1-6 | GP2, GP3, GP4, GP5, GP6, GP7 | 4, 5, 6, 7, 9, 10 |
| Button * | GP8 | 11 |
| Button 0 | GP9 | 12 |
| Button 9 | GP10 | 14 |
| Button 8 | GP11 | 15 |
| Button 7 | GP12 | 16 |
| Button # | GP13 | 17 |
| Amp I2S DIN | GP15 | 20 |
| Amp I2S BCLK | GP19 | 25 |
| Amp I2S LRC | GP20 | 26 |
| Amp VIN | VBUS 5V | 40 |
| Volume pot wiper | GP26 / ADC0 | 31 |
| Effect pot wiper | GP27 / ADC1 | 32 |
| Pot outer legs | 3V3 out and GND | 36, 38 |

The speaker (4 ohm, 3 W) connects directly to the amp's output terminals.
Do not put a resistor in the amp's power feed; if hardware attenuation is
ever needed again, it goes in series with a speaker wire.

## Sound

Each key plays one semitone of a chromatic scale from C4: `1` = C4 up to
`#` = B4, with `0` = A4 and `*` = A#4.

The volume pot (ADC0) sets the master level with a squared taper; full
clockwise is the MAX_VOLUME constant in `code.py`. The effect pot (ADC1)
selects the preset in three zones, left to right. A preset change only
affects new key presses, and prints `P <name>` over serial. Zone edges
have a dead band so a knob resting on a boundary does not flicker.

Presets are mirrored in `web/client/src/assets/song.json` (two for
Twinkle Twinkle, one for Hot Cross Buns) and keyed by zone:

| | twinkle-shimmer (left) | twinkle-vibrato (middle) | hotcross-tremolo (right) |
| --- | --- | --- | --- |
| Waveform | chime | soft saw | organ |
| Effect | detune shimmer | 5.5 Hz vibrato | 4 Hz tremolo |
| Filter | low-pass 5 kHz | low-pass 3 kHz | low-pass 4 kHz |

All waveforms are built additively from sine harmonics that stay below
Nyquist, so naive saw/square aliasing cannot occur; filters are gentle
(Q 0.707) and note amplitudes are budgeted so summed voices cannot clip
inside the synth.

## Deploy

CircuitPython 10.x for the Pico 2 (flash the .uf2 from circuitpython.org
once), then copy `code.py` to the CIRCUITPY drive. It auto-reloads on
every copy; no build step. Everything used is built into CircuitPython,
no libraries to install.

Note: with CircuitPython the serial port carries the Python console, so
the server may see REPL noise besides the `K` lines; its parser ignores
anything that is not a key line.
