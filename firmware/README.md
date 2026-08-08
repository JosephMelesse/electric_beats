# Firmware

Scans the keypad, sends `K <key>` lines over USB serial at 115200, and
synthesizes all game audio on the Pico. The browser is silent.

## Wiring

| Signal | Pico 2 | Physical pin |
| --- | --- | --- |
| Keypad R1-R4 | GP2, GP3, GP4, GP5 | 4, 5, 6, 7 |
| Keypad C1-C3 | GP6, GP7, GP8 | 9, 10, 11 |
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

Volume pot: master volume, silent to loud.

Preset pot: split into three zones, turn the knob to pick the sound.

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

## Build

Arduino IDE with the arduino-pico (Earle Philhower) core, board set to
the Pico 2. The sketch is `keypad/keypad.ino`; it needs no libraries
beyond the core's bundled I2S.
