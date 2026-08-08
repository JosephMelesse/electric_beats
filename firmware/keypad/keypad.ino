#include <Arduino.h>
#include <I2S.h>

// ---- keypad ----

static const uint8_t ROW_PINS[4] = {2, 3, 4, 5};
static const uint8_t COL_PINS[3] = {6, 7, 8};

static const uint8_t NUM_KEYS = 12;

static const char KEY_CHAR[NUM_KEYS] = {'1', '2', '3', '4', '5', '6',
                                        '7', '8', '9', '*', '0', '#'};

// Chromatic from C4: 1=C4 ... 0=A4, *=A#4, #=B4 (KEY_CHAR order).
static const float NOTE_FREQ[NUM_KEYS] = {261.63f, 277.18f, 293.66f, 311.13f,
                                          329.63f, 349.23f, 369.99f, 392.00f,
                                          415.30f, 466.16f, 440.00f, 493.88f};

static const uint8_t DEBOUNCE_PASSES = 2;
static const uint16_t SCAN_INTERVAL_MS = 2;

static bool keyState[NUM_KEYS];
static uint8_t keyCount[NUM_KEYS];
static uint32_t lastScanMs = 0;

// ---- presets, picked by the effect pot split into thirds ----

enum Wave { W_SINE, W_SAW, W_SQUARE };
enum FiltType { F_LOWPASS, F_BANDPASS };

struct Preset {
  Wave osc1, osc2;
  float osc2Ratio;  // OSC2 pitch: 1.0 = same, 0.5 = -12 semitones
  float mix;        // OSC2 share of the blend
  FiltType filt;
  float cutoff;
  float q;  // linear; low-pass values converted from the UI's dB Q
  float attackS, decayS, sustain, releaseS;
};

// Values copied from the synth designer screenshots.
static const Preset PRESETS[3] = {
    // acid: saw + 15% square, low-pass 600 Hz Q 16 dB, ADSR 0/0.10/0.6%/0.20
    {W_SAW, W_SQUARE, 1.0f, 0.15f, F_LOWPASS, 600.0f, 6.31f,
     0.00f, 0.10f, 0.006f, 0.20f},
    // organ: square + 60% sine, band-pass 1 kHz Q 2, ADSR 0.01/0.05/0.9%/0.15
    {W_SQUARE, W_SINE, 1.0f, 0.60f, F_BANDPASS, 1000.0f, 2.0f,
     0.01f, 0.05f, 0.009f, 0.15f},
    // bass_lead: saw + 40% square at -12, low-pass 800 Hz Q 4 dB,
    // ADSR 0.01/0.30/0.2%/0.00
    {W_SAW, W_SQUARE, 0.5f, 0.40f, F_LOWPASS, 800.0f, 1.585f,
     0.01f, 0.30f, 0.002f, 0.00f},
};

static uint8_t presetIdx = 0;
static const uint16_t ZONE_BAND = 30;  // ADC hysteresis around boundaries

// Attack and release of 0 s still get short ramps so they do not click.
static const float MIN_ATTACK_S = 0.002f;
static const float MIN_RELEASE_S = 0.005f;

// ---- synth ----

static const uint32_t SAMPLE_RATE = 22050;
static const float AMP_PEAK = 0.02f;  // level with the volume pot fully up
static const float AMP_FLOOR = 1e-4f;

enum EnvStage { ENV_IDLE, ENV_ATTACK, ENV_DECAY, ENV_RELEASE };

static I2S i2s(OUTPUT);
static float phase1 = 0.0f, step1 = 0.0f;
static float phase2 = 0.0f, step2 = 0.0f;
static float amp = 0.0f;
static float attackStep, sustainLevel, decayFactor, releaseFactor;
static EnvStage stage = ENV_IDLE;
static int8_t currentKey = -1;

// Biquad filter (RBJ cookbook), transposed direct form II.
static float fb0, fb1, fb2, fa1, fa2;
static float fz1 = 0.0f, fz2 = 0.0f;

// ---- pots ----

static const uint8_t VOLUME_PIN = 26;  // ADC0
static const uint8_t PRESET_PIN = 27;  // ADC1
static const uint16_t POT_INTERVAL_MS = 16;
static uint32_t lastPotMs = 0;
static float volTarget = 0.0f;
static float masterVol = 0.0f;
static const float VOL_SLEW = 0.0005f;  // per sample, ~90 ms to settle

static void applyPreset(uint8_t i) {
  const Preset &p = PRESETS[i];
  presetIdx = i;

  float w0 = 2.0f * PI * p.cutoff / SAMPLE_RATE;
  float alpha = sinf(w0) / (2.0f * p.q);
  float c = cosf(w0);
  float a0 = 1.0f + alpha;
  if (p.filt == F_LOWPASS) {
    fb0 = ((1.0f - c) / 2.0f) / a0;
    fb1 = (1.0f - c) / a0;
    fb2 = ((1.0f - c) / 2.0f) / a0;
  } else {  // band-pass, constant 0 dB peak
    fb0 = alpha / a0;
    fb1 = 0.0f;
    fb2 = -alpha / a0;
  }
  fa1 = (-2.0f * c) / a0;
  fa2 = (1.0f - alpha) / a0;
  fz1 = 0.0f;
  fz2 = 0.0f;

  attackStep = AMP_PEAK / (SAMPLE_RATE * max(p.attackS, MIN_ATTACK_S));
  sustainLevel = AMP_PEAK * p.sustain;
  decayFactor = expf(logf(0.001f) / (p.decayS * SAMPLE_RATE));
  releaseFactor =
      expf(logf(0.001f) / (max(p.releaseS, MIN_RELEASE_S) * SAMPLE_RATE));
}

static float osc(Wave w, float phase) {
  switch (w) {
    case W_SINE:
      return sinf(2.0f * PI * phase);
    case W_SAW:
      return 2.0f * phase - 1.0f;
    default:
      return (phase < 0.5f) ? 1.0f : -1.0f;
  }
}

static void noteOn(uint8_t k) {
  // Phases stay continuous across retriggers so the wave never jumps.
  step1 = NOTE_FREQ[k] / SAMPLE_RATE;
  step2 = step1 * PRESETS[presetIdx].osc2Ratio;
  currentKey = k;
  stage = ENV_ATTACK;
}

static void noteOff(uint8_t k) {
  if (k == (uint8_t)currentKey && (stage == ENV_ATTACK || stage == ENV_DECAY)) {
    stage = ENV_RELEASE;
  }
}

static void readPots(uint32_t now) {
  if (now - lastPotMs < POT_INTERVAL_MS) {
    return;
  }
  lastPotMs = now;

  // Squared for an audio taper feel on a linear pot.
  float v = analogRead(VOLUME_PIN) / 1023.0f;
  volTarget = v * v;

  // Zone selection with a dead band so a boundary reading cannot flicker.
  int sel = analogRead(PRESET_PIN);
  static const int LO[3] = {0, 341, 682};
  static const int HI[3] = {341, 682, 1023};
  if (sel < LO[presetIdx] - ZONE_BAND || sel > HI[presetIdx] + ZONE_BAND) {
    uint8_t next = min(sel / 342, 2);
    if (next != presetIdx) {
      applyPreset(next);
    }
  }
}

static void fillAudio() {
  const Preset &p = PRESETS[presetIdx];
  while (i2s.availableForWrite() > 0) {
    float x = 0.0f;
    if (stage != ENV_IDLE) {
      x = ((1.0f - p.mix) * osc(p.osc1, phase1) +
           p.mix * osc(p.osc2, phase2)) *
          amp;
      phase1 += step1;
      if (phase1 >= 1.0f) phase1 -= 1.0f;
      phase2 += step2;
      if (phase2 >= 1.0f) phase2 -= 1.0f;

      if (stage == ENV_ATTACK) {
        amp += attackStep;
        if (amp >= AMP_PEAK) {
          amp = AMP_PEAK;
          stage = ENV_DECAY;
        }
      } else if (stage == ENV_DECAY) {
        amp = sustainLevel + (amp - sustainLevel) * decayFactor;
      } else {
        amp *= releaseFactor;
        if (amp < AMP_PEAK * AMP_FLOOR) {
          amp = 0.0f;
          stage = ENV_IDLE;
        }
      }
    }

    // Filter always runs so its resonance rings out naturally.
    float y = fb0 * x + fz1;
    fz1 = fb1 * x - fa1 * y + fz2;
    fz2 = fb2 * x - fa2 * y;

    masterVol += (volTarget - masterVol) * VOL_SLEW;
    float out = y * masterVol;
    if (out > 1.0f) out = 1.0f;
    if (out < -1.0f) out = -1.0f;

    i2s.write16((int16_t)(out * 32767.0f), (int16_t)(out * 32767.0f));
  }
}

static void scanRow(uint8_t r) {
  pinMode(ROW_PINS[r], OUTPUT);
  digitalWrite(ROW_PINS[r], LOW);
  delayMicroseconds(30);

  for (uint8_t c = 0; c < 3; c++) {
    bool pressed = (digitalRead(COL_PINS[c]) == LOW);
    uint8_t k = r * 3 + c;

    if (pressed == keyState[k]) {
      keyCount[k] = 0;
      continue;
    }
    if (++keyCount[k] < DEBOUNCE_PASSES) {
      continue;
    }
    keyCount[k] = 0;
    keyState[k] = pressed;

    if (pressed) {
      Serial.printf("K %c\n", KEY_CHAR[k]);
      noteOn(k);
    } else {
      noteOff(k);
    }
  }

  pinMode(ROW_PINS[r], INPUT);
}

void setup() {
  Serial.begin(115200);

  for (uint8_t i = 0; i < 4; i++) {
    pinMode(ROW_PINS[i], INPUT);
  }
  for (uint8_t i = 0; i < 3; i++) {
    pinMode(COL_PINS[i], INPUT_PULLUP);
  }

  applyPreset(0);

  i2s.setBCLK(19);  // LRC is BCLK + 1 = GP20
  i2s.setDATA(15);
  i2s.setBitsPerSample(16);
  i2s.setBuffers(8, 64);  // ~23 ms of headroom against underruns
  i2s.begin(SAMPLE_RATE);
}

void loop() {
  fillAudio();

  uint32_t now = millis();
  readPots(now);
  if (now - lastScanMs >= SCAN_INTERVAL_MS) {
    lastScanMs = now;
    for (uint8_t r = 0; r < 4; r++) {
      scanRow(r);
    }
  }
}
