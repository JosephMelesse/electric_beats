#include <Arduino.h>

static const uint8_t ROW_PINS[4] = {2, 3, 4, 5};
static const uint8_t COL_PINS[3] = {6, 7, 8};

static const uint8_t NUM_KEYS = 12;

static const char KEY_CHAR[NUM_KEYS] = {'1', '2', '3', '4', '5', '6',
                                        '7', '8', '9', '*', '0', '#'};

static const uint8_t DEBOUNCE_PASSES = 2;
static const uint16_t SCAN_INTERVAL_MS = 2;

static bool keyState[NUM_KEYS];
static uint8_t keyCount[NUM_KEYS];

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
}

void loop() {
  for (uint8_t r = 0; r < 4; r++) {
    scanRow(r);
  }
  delay(SCAN_INTERVAL_MS);
}
