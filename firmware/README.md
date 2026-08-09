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

The pots are currently disconnected: volume and preset are the VOLUME
and PRESET_INDEX constants at the top of `code.py`. When the pots return,
the plan is volume on ADC0 and a three-zone preset selector on ADC1.

| | acid (left) | organ (middle) | bass_lead (right) |
| --- | --- | --- | --- |
| OSC 1 | sawtooth | square | sawtooth |
| OSC 2 | square | sine | square, -12 semitones |
| Mix | 15% | 60% | 40% |
| Filter | low-pass 600 Hz, Q 16 | band-pass 1 kHz, Q 2 | low-pass 800 Hz, Q 4 |
| ADSR | 0 / 0.10 / 0.6% / 0.20 | 0.01 / 0.05 / 0.9% / 0.15 | 0.01 / 0.30 / 0.2% / 0.00 |

Values are copied from the synth designer. Low-pass Q is in dB there
(Web Audio convention) and converted to linear Q in the code; band-pass Q
is already linear. Zero attack and release get 2-5 ms ramps so they do
not click. Zone edges have a dead band so a knob resting on a boundary
does not flicker between presets.

## Deploy

CircuitPython 10.x for the Pico 2 (flash the .uf2 from circuitpython.org
once), then copy `code.py` to the CIRCUITPY drive. It auto-reloads on
every copy; no build step. Everything used is built into CircuitPython,
no libraries to install.

Note: with CircuitPython the serial port carries the Python console, so
the server may see REPL noise besides the `K` lines; its parser ignores
anything that is not a key line.
