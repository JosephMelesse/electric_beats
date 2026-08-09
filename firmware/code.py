# electric_beats firmware, CircuitPython 10.x on a Pico 2.
# Reads twelve buttons, prints "K <key>" over USB serial, and plays each
# key's note through the I2S amp using synthio. Pots are disconnected for
# now: volume and preset are the constants VOLUME and PRESET_INDEX below.

import math

import audiobusio
import audiomixer
import board
import keypad
import synthio
import ulab.numpy as np

SAMPLE_RATE = 22050

# Buttons wire each GPIO to GND; internal pull-ups, pressed reads low.
KEY_CHARS = "123456789*0#"
KEY_PINS = (
    board.GP2, board.GP3, board.GP4, board.GP5, board.GP6, board.GP7,
    board.GP12, board.GP11, board.GP10, board.GP8, board.GP9, board.GP13,
)

# Chromatic from C4: 1=C4 ... 0=A4, *=A#4, #=B4 (KEY_CHARS order).
NOTE_FREQ = (
    261.63, 277.18, 293.66, 311.13, 329.63, 349.23,
    369.99, 392.00, 415.30, 466.16, 440.00, 493.88,
)

# Single-cycle waveforms.
WAVE_LEN = 256
WAVE_AMP = 28000
ramp = np.linspace(-WAVE_AMP, WAVE_AMP, num=WAVE_LEN, dtype=np.int16)
SAW = ramp
SQUARE = np.concatenate((
    np.full(WAVE_LEN // 2, WAVE_AMP, dtype=np.int16),
    np.full(WAVE_LEN // 2, -WAVE_AMP, dtype=np.int16),
))
SINE = np.array(
    np.sin(np.linspace(0, 2 * math.pi, num=WAVE_LEN, endpoint=False))
    * WAVE_AMP,
    dtype=np.int16,
)

# Presets copied from the synth designer. Low-pass Q converted from the
# UI's dB (Web Audio convention) to linear; band-pass Q is already linear.
# osc2_ratio 0.5 is a -12 semitone pitch offset. Zero attack/release get
# short ramps so they do not click.
PRESETS = (
    {
        "name": "acid",
        "osc1": SAW, "osc2": SQUARE, "osc2_ratio": 1.0, "mix": 0.15,
        "filter": ("lp", 600, 6.31),
        "env": synthio.Envelope(
            attack_time=0.002, decay_time=0.10,
            sustain_level=0.006, release_time=0.20,
        ),
    },
    {
        "name": "organ",
        "osc1": SQUARE, "osc2": SINE, "osc2_ratio": 1.0, "mix": 0.60,
        "filter": ("bp", 1000, 2.0),
        "env": synthio.Envelope(
            attack_time=0.01, decay_time=0.05,
            sustain_level=0.009, release_time=0.15,
        ),
    },
    {
        "name": "bass_lead",
        "osc1": SAW, "osc2": SQUARE, "osc2_ratio": 0.5, "mix": 0.40,
        "filter": ("lp", 800, 1.585),
        "env": synthio.Envelope(
            attack_time=0.01, decay_time=0.30,
            sustain_level=0.002, release_time=0.005,
        ),
    },
)

synth = synthio.Synthesizer(sample_rate=SAMPLE_RATE, channel_count=1)
i2s = audiobusio.I2SOut(
    bit_clock=board.GP19, word_select=board.GP20, data=board.GP15
)
mixer = audiomixer.Mixer(
    voice_count=1, sample_rate=SAMPLE_RATE, channel_count=1,
    bits_per_sample=16, samples_signed=True,
)
i2s.play(mixer)
mixer.voice[0].play(synth)
VOLUME = 0.03  # master volume, 0.0 to 1.0
PRESET_INDEX = 0  # 0 acid, 1 organ, 2 bass_lead

mixer.voice[0].level = VOLUME

keys = keypad.Keys(KEY_PINS, value_when_pressed=False, pull=True)

active = {}  # key number -> (note, note)


FILTER_MODES = {
    "lp": synthio.FilterMode.LOW_PASS,
    "bp": synthio.FilterMode.BAND_PASS,
}


def make_notes(k):
    p = PRESETS[PRESET_INDEX]
    kind, freq, q = p["filter"]
    filt = synthio.Biquad(FILTER_MODES[kind], freq, Q=q)
    shared = {"envelope": p["env"], "filter": filt}
    return (
        synthio.Note(
            frequency=NOTE_FREQ[k], waveform=p["osc1"],
            amplitude=1.0 - p["mix"], **shared,
        ),
        synthio.Note(
            frequency=NOTE_FREQ[k] * p["osc2_ratio"], waveform=p["osc2"],
            amplitude=p["mix"], **shared,
        ),
    )


while True:
    event = keys.events.get()
    if event:
        if event.pressed:
            print("K", KEY_CHARS[event.key_number])
            old = active.pop(event.key_number, None)
            if old:
                synth.release(old)
            notes = make_notes(event.key_number)
            active[event.key_number] = notes
            synth.press(notes)
        else:
            notes = active.pop(event.key_number, None)
            if notes:
                synth.release(notes)
