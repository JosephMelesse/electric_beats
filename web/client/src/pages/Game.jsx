import { useCallback, useEffect, useRef, useState } from "react";

import { createEngine } from "../game/engine.js";
import songs from "../assets/song.json";
import bgUrl from "../assets/black.png";
import shipUrl from "../assets/playerShip1_blue.png";
import meteorUrl from "../assets/meteorBrown_big1.png";
import laserImgUrl from "../assets/laserBlue01.png";

const SLOT_RADIUS = 28;
const METEOR_SIZE = 60;
const SHIP_SIZE = 64;

function loadImage(url) {
  const img = new Image();
  img.src = url;
  return img;
}

export default function Game({ width = 800, height = 600 }) {
  const canvasRef = useRef(null);
  const menuRef = useRef(null);
  const engineRef = useRef(null);
  const socketRef = useRef(null);
  const [songIndex, setSongIndex] = useState(0);
  const [runId, setRunId] = useState(0);
  const [started, setStarted] = useState(false);
  const [over, setOver] = useState(false);
  const song = songs[songIndex];

  // Start, retry and song picks round-trip through the server so every
  // screen acts on the same message and the runs stay in step.
  const applyControl = useCallback((message) => {
    if (message.action === "start") {
      setStarted(true);
    } else if (message.action === "retry") {
      setRunId((id) => id + 1);
    } else if (message.action === "song") {
      setSongIndex(message.index);
      setRunId((id) => id + 1);
      setStarted(false);
      menuRef.current?.removeAttribute("open");
    }
  }, []);

  // One socket per page rather than one per run, so a control message
  // cannot land while the engine is being rebuilt.
  useEffect(() => {
    const socket = new WebSocket(`ws://${location.host}/ws`);
    socketRef.current = socket;
    socket.addEventListener("message", (ev) => {
      const message = JSON.parse(ev.data);
      if (message.type === "key") {
        engineRef.current?.press(message.key, performance.now());
      } else if (message.type === "control") {
        applyControl(message);
      }
    });
    return () => {
      socketRef.current = null;
      socket.close();
    };
  }, [applyControl]);

  const sendControl = (message) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "control", ...message }));
    } else {
      // No server reachable: drive this screen on its own.
      applyControl(message);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let animationFrameId;
    let reportedOver = false;
    setOver(false);

    const engine = createEngine({ width, height, song });
    engineRef.current = engine;
    const { state } = engine;

    const bg = loadImage(bgUrl);
    const ship = loadImage(shipUrl);
    const meteor = loadImage(meteorUrl);
    const laser = loadImage(laserImgUrl);

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
      ctx.textAlign = "right";
      ctx.fillStyle = "white";
      ctx.fillText(`${Math.ceil(state.timeLeftMs / 1000)}s`, width - 12, 20);
    };

    const loop = () => {
      if (started) engine.update(performance.now());
      if (state.over && !reportedOver) {
        reportedOver = true;
        setOver(true);
      }
      draw();
      animationFrameId = requestAnimationFrame(loop);
    };
    loop();

    // Cleanup prevents duplicate loops (important with StrictMode)
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [width, height, song, runId, started]);

  return (
    <div className="game">
      <details ref={menuRef} className="dropdown">
        <summary className="btn btn-outline btn-primary btn-sm">
          Song: {song.title} &#9662;
        </summary>
        <ul className="menu dropdown-content z-10 mt-1 w-56 rounded-box border border-base-300 bg-base-100 p-2 shadow">
          {songs.map((entry, index) => (
            <li key={entry.title}>
              <button
                type="button"
                className={index === songIndex ? "menu-active" : ""}
                onClick={() => sendControl({ action: "song", index })}
              >
                {entry.title}
              </button>
            </li>
          ))}
        </ul>
      </details>
      <div className="game-stage">
        <canvas ref={canvasRef} width={width} height={height} />
        {!started && (
          <button
            type="button"
            className="game-overlay game-start"
            onClick={() => sendControl({ action: "start" })}
            aria-label="Start run"
          >
            <span className="game-start-triangle" />
          </button>
        )}
        {over && (
          <div className="game-overlay">
            <p className="font-mono text-sm tracking-widest">RUN OVER</p>
            <p className="text-2xl italic">
              hits {engineRef.current?.state.score} &middot; misses{" "}
              {engineRef.current?.state.misses}
            </p>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => sendControl({ action: "retry" })}
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
