// Pure game state: slot layout, song clock, spawn/expiry, hit detection.
// No React, no canvas, no audio. Time comes in as milliseconds from the caller.

export const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "*", "#"];

const HIT_WINDOW_BEATS = 1.9; // asteroid lifetime after its beat
const LOOP_GAP_BEATS = 4; // silence before the song restarts
const LASER_MS = 150;
const TURN_RATE = 14; // radians per second toward the target angle
export const RUN_MS = 60000; // one run lasts a minute

// Positions traced from the design sketch, in sketch pixel coordinates.
// Two clusters arc down and inward, with the ship at top center between them.
const SKETCH = {
  ship: { x: 540, y: 40 },
  slots: {
    1: { x: 118, y: 177 },
    2: { x: 226, y: 185 },
    3: { x: 314, y: 231 },
    4: { x: 371, y: 310 },
    5: { x: 393, y: 399 },
    6: { x: 160, y: 406 }, // center of the 1-5 arc

    7: { x: 919, y: 135 },
    8: { x: 830, y: 150 },
    9: { x: 751, y: 206 },
    0: { x: 702, y: 293 },
    "*": { x: 693, y: 400 },
    "#": { x: 915, y: 361 }, // center of the 7-* arc
  },
};

export function layoutSlots(width, height) {
  const points = [SKETCH.ship, ...Object.values(SKETCH.slots)];
  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));

  // Uniform scale so the sketch keeps its shape, centered with a margin.
  const margin = 60;
  const scale = Math.min(
    (width - 2 * margin) / (maxX - minX),
    (height - 2 * margin) / (maxY - minY),
  );
  const place = (p) => ({
    x: (p.x - (minX + maxX) / 2) * scale + width / 2,
    y: (p.y - (minY + maxY) / 2) * scale + height / 2,
  });

  const ship = place(SKETCH.ship);
  const slots = new Map();
  for (const key of KEYS) {
    const { x, y } = place(SKETCH.slots[key]);
    slots.set(key, { key, x, y, angle: Math.atan2(y - ship.y, x - ship.x) });
  }
  return { ship, slots };
}

export function createEngine({ width, height, song }) {
  const { ship, slots } = layoutSlots(width, height);
  const beatMs = 60000 / song.bpm;

  const state = {
    ship,
    slots,
    asteroids: new Map(), // key -> { key, spawnBeat, expiresBeat }
    beat: 0,
    lasers: [], // { key, untilMs }
    score: 0,
    misses: 0,
    shipAngle: Math.PI / 2,
    targetAngle: Math.PI / 2,
    songIndex: 0,
    startMs: null,
    lastMs: null,
    runStartMs: null,
    timeLeftMs: RUN_MS,
    over: false,
  };

  function update(nowMs) {
    if (state.over) return;
    if (state.startMs === null) {
      state.startMs = nowMs;
      state.runStartMs = nowMs;
    }

    state.timeLeftMs = Math.max(0, RUN_MS - (nowMs - state.runStartMs));
    if (state.timeLeftMs === 0) {
      state.over = true;
      state.asteroids.clear();
      state.lasers = [];
      return;
    }
    const dt = state.lastMs === null ? 0 : (nowMs - state.lastMs) / 1000;
    state.lastMs = nowMs;
    const beat = (nowMs - state.startMs) / beatMs;
    state.beat = beat;

    // Spawn every step whose beat has arrived.
    while (
      state.songIndex < song.steps.length &&
      song.steps[state.songIndex].beat <= beat
    ) {
      const step = song.steps[state.songIndex];
      if (state.asteroids.has(step.key)) state.misses += 1; // unhit leftover
      state.asteroids.set(step.key, {
        key: step.key,
        spawnBeat: step.beat,
        expiresBeat: step.beat + HIT_WINDOW_BEATS,
      });
      state.songIndex += 1;
    }

    // Expire missed asteroids.
    for (const [key, asteroid] of state.asteroids) {
      if (beat > asteroid.expiresBeat) {
        state.asteroids.delete(key);
        state.misses += 1;
      }
    }

    // Loop the song after a gap once everything is resolved.
    if (state.songIndex >= song.steps.length && state.asteroids.size === 0) {
      state.songIndex = 0;
      state.startMs = nowMs + LOOP_GAP_BEATS * beatMs;
    }

    state.lasers = state.lasers.filter((l) => l.untilMs > nowMs);

    // Ease the ship toward its target angle.
    const diff = state.targetAngle - state.shipAngle;
    const turn = Math.sign(diff) * Math.min(Math.abs(diff), TURN_RATE * dt);
    state.shipAngle += turn;
  }

  // Returns true on a hit; the caller decides what sound to make.
  function press(key, nowMs) {
    if (state.over) return false;
    if (!state.slots.has(key)) return false;
    const asteroid = state.asteroids.get(key);
    if (asteroid === undefined) return false;
    state.asteroids.delete(key);
    state.score += 1;
    state.targetAngle = state.slots.get(key).angle;
    state.lasers.push({ key, untilMs: nowMs + LASER_MS });
    return true;
  }

  return { state, update, press };
}
