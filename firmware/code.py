# electric_beats firmware, CircuitPython 10.x on a Pico 2.
# Reads twelve buttons, prints "K <key>" over USB serial, and plays each
# key's note through the I2S amp using synthio. The volume pot on ADC0
# sets the master level; the effect pot on ADC1 picks one of three
# presets in three zones. Each preset is a different waveform and works
# with any song; the name is printed as "P <name>" for the web client.

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

# One preset per effect-pot zone, left to right, each a different
# waveform with a different effect on top. "detune" adds a second
# oscillator slightly sharp for a shimmer; "bend"/"tremolo" attach an
# LFO to pitch or amplitude. Filters are gentle low-passes (Q 0.707),
# there to darken, not resonate.
#
# None of these is tied to a particular song. Releases are kept under
# 0.2 s so that fast passages stay articulate: the tightest spacing in
# the charts is a sixteenth at 70 bpm, about 214 ms, and a longer tail
# would smear one note into the next.
PRESETS = (
    {
        "name": "bell", "wave": CHIME, "detune": 1.006,
        "filter": 5000,
        "env": synthio.Envelope(
            attack_time=0.003, decay_time=0.20,
            sustain_level=0.35, release_time=0.18,
        ),
    },
    {
        "name": "reed", "wave": SOFT_SAW, "bend": VIBRATO,
        "filter": 3000,
        "env": synthio.Envelope(
            attack_time=0.015, decay_time=0.10,
            sustain_level=0.6, release_time=0.15,
        ),
    },
    {
        "name": "organ", "wave": ORGAN, "tremolo": TREMOLO,
        "filter": 4000,
        "env": synthio.Envelope(
            attack_time=0.008, decay_time=0.04,
            sustain_level=0.8, release_time=0.12,
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


def read_volume():
    # This pot's outer legs are wired so the ADC reads high at the quiet
    # end. Inverting here means everything downstream, the mixer level
    # and the reported percent alike, sees plain knob position.
    return 65535 - pot_volume.value


vol_avg = read_volume()
level = pot_to_level(vol_avg)
mixer.voice[0].level = level
preset_index = preset_zone(pot_preset.value, 0)
next_poll = time.monotonic()

# Knob position as a whole percent, reported as "V <percent>" for the
# web client's volume bar. This is where the knob sits, not the level
# it produces: the taper below is squared, so a bar drawn from the
# level would sit at a quarter with the knob at half way.
volume_pct = int(vol_avg * 100 / 65535)

# Preset and volume are re-announced on this interval as well as on
# change. The server usually starts after the board is already running,
# so it would otherwise miss the boot announcement and show nothing
# until a knob was moved.
ANNOUNCE_EVERY = 2.0
next_announce = time.monotonic()

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
        vol_avg += (read_volume() - vol_avg) * 0.2
        new_level = pot_to_level(vol_avg)
        if abs(new_level - level) > MAX_VOLUME / 200:
            level = new_level
            mixer.voice[0].level = level
            # Reported here rather than every poll so ADC noise cannot
            # flicker the bar back and forth while the knob sits still.
            pct = int(vol_avg * 100 / 65535)
            if pct != volume_pct:
                volume_pct = pct
                print("V", volume_pct)
        zone = preset_zone(pot_preset.value, preset_index)
        if zone != preset_index:
            preset_index = zone
            next_announce = now
    if now >= next_announce:
        next_announce = now + ANNOUNCE_EVERY
        print("P", PRESETS[preset_index]["name"])
        print("V", volume_pct)

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
