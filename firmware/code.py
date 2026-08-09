# electric_beats firmware, CircuitPython 10.x on a Pico 2.
# Reads twelve buttons, prints "K <key>" over USB serial, and plays each
# key's note through the I2S amp using synthio. The volume pot on ADC0
# sets the master level; the effect pot on ADC1 picks one of three
# presets in three zones. Presets mirror the entries stored in
# web/client/src/assets/song.json (two for Twinkle Twinkle, one for
# Hot Cross Buns).

import math
import time

import analogio
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

# Waveforms are built additively from sine harmonics so they contain
# nothing above Nyquist: no aliasing fizz from naive saw/square edges.
WAVE_LEN = 256
WAVE_AMP = 12000


def additive(harmonics):
    x = np.linspace(0, 2 * math.pi, num=WAVE_LEN, endpoint=False)
    wave = np.zeros(WAVE_LEN)
    for k, amp in harmonics:
        wave = wave + amp * np.sin(k * x)
    peak = max(np.max(wave), -np.min(wave))
    return np.array(wave * (WAVE_AMP / peak), dtype=np.int16)


CHIME = additive(((1, 1.0), (2, 0.35), (3, 0.10), (4, 0.12)))
SOFT_SAW = additive(tuple((k, 1.0 / k) for k in range(1, 9)))
ORGAN = additive(((1, 0.9), (2, 0.6), (3, 0.4), (4, 0.25)))

VIBRATO = synthio.LFO(rate=5.5, scale=0.012)  # pitch wobble, ~15 cents
TREMOLO = synthio.LFO(rate=4.0, scale=0.25, offset=0.75)  # level 0.5-1.0

# One preset per effect-pot zone, left to right. "detune" adds a second
# oscillator slightly sharp for a shimmer; "bend"/"tremolo" attach an
# LFO to pitch or amplitude. Filters are gentle low-passes (Q 0.707),
# there to darken, not resonate.
PRESETS = (
    {
        "name": "twinkle-shimmer", "wave": CHIME, "detune": 1.006,
        "filter": 5000,
        "env": synthio.Envelope(
            attack_time=0.005, decay_time=0.25,
            sustain_level=0.5, release_time=0.3,
        ),
    },
    {
        "name": "twinkle-vibrato", "wave": SOFT_SAW, "bend": VIBRATO,
        "filter": 3000,
        "env": synthio.Envelope(
            attack_time=0.02, decay_time=0.10,
            sustain_level=0.6, release_time=0.2,
        ),
    },
    {
        "name": "hotcross-tremolo", "wave": ORGAN, "tremolo": TREMOLO,
        "filter": 4000,
        "env": synthio.Envelope(
            attack_time=0.01, decay_time=0.05,
            sustain_level=0.8, release_time=0.15,
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

# Volume pot: squared taper so the useful range is not crammed into the
# first few degrees. Full clockwise is MAX_VOLUME, full range by default.
MAX_VOLUME = 1.0
POT_POLL = 0.02  # seconds between pot reads

pot_volume = analogio.AnalogIn(board.GP26)
pot_preset = analogio.AnalogIn(board.GP27)

# Preset pot zone edges, with a dead band so a knob resting on an edge
# does not flicker between presets.
ZONE_EDGES = (65536 // 3, 2 * 65536 // 3)
ZONE_DEAD = 3000


def preset_zone(raw, current):
    if raw < ZONE_EDGES[0] - ZONE_DEAD:
        return 0
    if ZONE_EDGES[0] + ZONE_DEAD < raw < ZONE_EDGES[1] - ZONE_DEAD:
        return 1
    if raw > ZONE_EDGES[1] + ZONE_DEAD:
        return 2
    return current


def pot_to_level(avg):
    return (avg / 65535) ** 2 * MAX_VOLUME


vol_avg = pot_volume.value
level = pot_to_level(vol_avg)
mixer.voice[0].level = level
preset_index = preset_zone(pot_preset.value, 0)
next_poll = time.monotonic()

keys = keypad.Keys(KEY_PINS, value_when_pressed=False, pull=True)

active = {}  # key number -> tuple of notes


def make_notes(k):
    p = PRESETS[preset_index]
    filt = synthio.Biquad(synthio.FilterMode.LOW_PASS, p["filter"], Q=0.707)
    note = synthio.Note(
        frequency=NOTE_FREQ[k], waveform=p["wave"],
        envelope=p["env"], filter=filt,
    )
    if "bend" in p:
        note.bend = p["bend"]
    if "tremolo" in p:
        note.amplitude = p["tremolo"]
    detune = p.get("detune")
    if not detune:
        return (note,)
    note.amplitude = 0.5
    return (note, synthio.Note(
        frequency=NOTE_FREQ[k] * detune, waveform=p["wave"],
        envelope=p["env"], filter=filt, amplitude=0.5,
    ))


while True:
    now = time.monotonic()
    if now >= next_poll:
        next_poll = now + POT_POLL
        # Light smoothing keeps ADC noise from making the level jitter.
        vol_avg += (pot_volume.value - vol_avg) * 0.2
        new_level = pot_to_level(vol_avg)
        if abs(new_level - level) > MAX_VOLUME / 200:
            level = new_level
            mixer.voice[0].level = level
        zone = preset_zone(pot_preset.value, preset_index)
        if zone != preset_index:
            preset_index = zone
            print("P", PRESETS[zone]["name"])

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
