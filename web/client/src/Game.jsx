import { useEffect, useRef } from "react";

import { createEngine } from "./game/engine.js";
import song from "./assets/song.json";
import bgUrl from "./assets/black.png";
import shipUrl from "./assets/playerShip1_blue.png";
import meteorUrl from "./assets/meteorBrown_big1.png";
import laserImgUrl from "./assets/laserBlue01.png";

const SLOT_RADIUS = 28;
const METEOR_SIZE = 60;
const SHIP_SIZE = 64;

function loadImage(url) {
  const img = new Image();
  img.src = url;
  return img;
}

export default function GameCanvas({ width = 800, height = 600 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let animationFrameId;

    const engine = createEngine({ width, height, song });
    const { state } = engine;

    const bg = loadImage(bgUrl);
    const ship = loadImage(shipUrl);
    const meteor = loadImage(meteorUrl);
    const laser = loadImage(laserImgUrl);

    const socket = new WebSocket(`ws://${location.host}/ws`);
    socket.addEventListener("message", (ev) => {
      const message = JSON.parse(ev.data);
      if (message.type !== "key") return;
      engine.press(message.key, performance.now());
    });

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      if (bg.complete) {
        ctx.fillStyle = ctx.createPattern(bg, "repeat");
        ctx.fillRect(0, 0, width, height);
      }

      // Placeholder slots, gray until an asteroid pops up.
      ctx.font = "16px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const slot of state.slots.values()) {
        ctx.beginPath();
        ctx.arc(slot.x, slot.y, SLOT_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(128, 128, 128, 0.25)";
        ctx.fill();
        ctx.strokeStyle = "gray";
        ctx.stroke();
        ctx.fillStyle = "gray";
        ctx.fillText(slot.key, slot.x, slot.y);
      }

      // Asteroids grow from small to full size over their hit window,
      // as if approaching from deep space.
      for (const asteroid of state.asteroids.values()) {
        const slot = state.slots.get(asteroid.key);
        const progress = Math.min(
          1,
          Math.max(
            0,
            (state.beat - asteroid.spawnBeat) /
              (asteroid.expiresBeat - asteroid.spawnBeat),
          ),
        );
        const size = METEOR_SIZE * (0.2 + 0.8 * progress);
        ctx.drawImage(
          meteor,
          slot.x - size / 2,
          slot.y - size / 2,
          size,
          size,
        );
      }

      // Laser beams from the ship to the slot just shot.
      for (const beam of state.lasers) {
        const slot = state.slots.get(beam.key);
        const dx = slot.x - state.ship.x;
        const dy = slot.y - state.ship.y;
        const length = Math.hypot(dx, dy);
        ctx.save();
        ctx.translate(state.ship.x, state.ship.y);
        ctx.rotate(Math.atan2(dy, dx) + Math.PI / 2);
        ctx.drawImage(laser, -4, -length, 9, length);
        ctx.restore();
      }

      // Ship, sprite points up so offset the rotation by a quarter turn.
      ctx.save();
      ctx.translate(state.ship.x, state.ship.y);
      ctx.rotate(state.shipAngle + Math.PI / 2);
      ctx.drawImage(ship, -SHIP_SIZE / 2, -SHIP_SIZE / 2, SHIP_SIZE, SHIP_SIZE);
      ctx.restore();

      // HUD.
      ctx.textAlign = "left";
      ctx.fillStyle = "white";
      ctx.fillText(`hits ${state.score}  misses ${state.misses}`, 12, 20);
      ctx.fillStyle = "gray";
      ctx.fillText(song.title, 12, 40);
    };

    const loop = () => {
      engine.update(performance.now());
      draw();
      animationFrameId = requestAnimationFrame(loop);
    };
    loop();

    // Cleanup prevents duplicate loops (important with StrictMode)
    return () => {
      cancelAnimationFrame(animationFrameId);
      socket.close();
    };
  }, [width, height]);

  return <canvas ref={canvasRef} width={width} height={height} />;
}
