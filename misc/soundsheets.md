# Sound sheets

Playing reference for the `firmware/synth` sketch. The 12 keypad buttons are the
12 semitones of one octave, so anything written here has to fit inside a single
octave. The frequency pot moves which octave that is, not how wide it is.

## Key map

```
1 2 3      C   C#  D
4 5 6      D#  E   F
7 8 9      F#  G   G#
* 0 #      A   A#  B
```

| Key | Note | Key | Note |
| --- | --- | --- | --- |
| 1 | C | 7 | F# |
| 2 | C# | 8 | G |
| 3 | D | 9 | G# |
| 4 | D# | * | A |
| 5 | E | 0 | A# |
| 6 | F | # | B |

The white keys of a piano are `1 3 5 6 8 * #`. The black keys are `2 4 7 9 0`.

## Octave switch

The frequency pot on GP27 snaps to five positions, roughly one fifth of the
rotation each.

| Pot rotation | ADC range | Setting | Multiplier | Octave |
| --- | --- | --- | --- | --- |
| 0-20% | 0-818 | -2 | x0.25 | C2 |
| 20-40% | 819-1637 | -1 | x0.5 | C3 |
| 40-60% | 1638-2456 | 0 | x1.0 | C4 |
| 60-80% | 2457-3275 | +1 | x2.0 | C5 |
| 80-100% | 3276-4095 | +2 | x4.0 | C6 |

## Frequencies

Hz for each key at each octave setting.

| Key | Note | -2 | -1 | 0 | +1 | +2 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | C | 65.41 | 130.82 | 261.63 | 523.26 | 1046.52 |
| 2 | C# | 69.30 | 138.59 | 277.18 | 554.36 | 1108.72 |
| 3 | D | 73.42 | 146.83 | 293.66 | 587.32 | 1174.64 |
| 4 | D# | 77.78 | 155.57 | 311.13 | 622.26 | 1244.52 |
| 5 | E | 82.41 | 164.82 | 329.63 | 659.26 | 1318.52 |
| 6 | F | 87.31 | 174.62 | 349.23 | 698.46 | 1396.92 |
| 7 | F# | 92.50 | 185.00 | 369.99 | 739.98 | 1479.96 |
| 8 | G | 98.00 | 196.00 | 392.00 | 784.00 | 1568.00 |
| 9 | G# | 103.83 | 207.65 | 415.30 | 830.60 | 1661.20 |
| * | A | 110.00 | 220.00 | 440.00 | 880.00 | 1760.00 |
| 0 | A# | 116.54 | 233.08 | 466.16 | 932.32 | 1864.64 |
| # | B | 123.47 | 246.94 | 493.88 | 987.76 | 1975.52 |

Standard concert A440 is key `*` at setting 0. Use it to check tuning by ear
against a reference tone.

## Scales

| Scale | Keys |
| --- | --- |
| C major | 1 3 5 6 8 * # |
| C natural minor | 1 3 4 6 8 9 0 |
| C major pentatonic | 1 3 5 8 * |
| C minor pentatonic | 1 4 6 8 0 |
| C blues | 1 4 6 7 8 0 |
| Whole tone | 1 3 5 7 9 0 |
| Chromatic | 1 2 3 4 5 6 7 8 9 * 0 # |

The chromatic run is also the quickest way to check every key works. Play it
slowly and listen for a pitch that repeats or skips.

## Chords

Three notes each, which stays inside the four voice headroom.

| Chord | Notes | Keys |
| --- | --- | --- |
| C major | C E G | 1 5 8 |
| D minor | D F A | 3 6 * |
| E minor | E G B | 5 8 # |
| F major | F A C | 6 * 1 |
| G major | G B D | 8 # 3 |
| A minor | A C E | * 1 5 |
| C diminished | C D# F# | 1 4 7 |
| C augmented | C E G# | 1 5 9 |

Some of these are voiced with the root above the other notes, since everything
has to stay inside one octave. They sound like inversions rather than root
position chords, which is fine for chord recognition but means a bass line does
not sit underneath them.

### Progressions

| Name | Chords | Keys |
| --- | --- | --- |
| I-V-vi-IV | C G Am F | (1 5 8) (8 # 3) (* 1 5) (6 * 1) |
| ii-V-I | Dm G C | (3 6 *) (8 # 3) (1 5 8) |
| I-vi-IV-V | C Am F G | (1 5 8) (* 1 5) (6 * 1) (8 # 3) |

## Melodies

Each line is one phrase. Spaces separate notes, `|` separates bars.

### Twinkle Twinkle Little Star

```
1 1 8 8 * * 8 | 6 6 5 5 3 3 1
8 8 6 6 5 5 3 | 8 8 6 6 5 5 3
1 1 8 8 * * 8 | 6 6 5 5 3 3 1
```

### Mary Had a Little Lamb

```
5 3 1 3 5 5 5 | 3 3 3 5 8 8
5 3 1 3 5 5 5 | 5 3 3 5 3 1
```

### Ode to Joy

```
5 5 6 8 | 8 6 5 3 | 1 1 3 5 | 5 3 3
5 5 6 8 | 8 6 5 3 | 1 1 3 5 | 3 1 1
```

### Frere Jacques

```
1 3 5 1 | 1 3 5 1
5 6 8 | 5 6 8
8 * 8 6 5 1 | 8 * 8 6 5 1
1 8 1 | 1 8 1
```

Note the last line drops below C, which does not exist on this keyboard. It is
written here an octave up, so it sits above the phrase instead of below it.

## What does not fit

Anything spanning more than twelve semitones needs the octave pot turned
mid-tune, which is not practical to play. Happy Birthday is the common example:
it reaches an octave above its starting note, so the top C has nowhere to go.
Tunes like it need either a second octave of keys or a wider keyboard.
