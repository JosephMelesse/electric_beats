import { useRef, useEffect } from "react";

export default function GameCanvas({ width = 800, height = 600 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let animationFrameId;

    const [key, setKey] = useState("");

    useEffect(() => {
      const socket = new WebSocket(`ws://${location.host}/ws`);

      socket.addEventListener("message", (ev) => {
        const message = JSON.parse(ev.data);
        if (message.type === "key") {
          setKey(message.key);
        }
      });

      return () => socket.close();
    }, []);

    // Game state lives in plain variables, NOT React state
    const state = {
      x: 50,
      y: 50,
      vx: 2,
      vy: 2,
    };

    const update = () => {
      state.x += state.vx;
      state.y += state.vy;
      if (state.x < 0 || state.x > width - 20) state.vx *= -1;
      if (state.y < 0 || state.y > height - 20) state.vy *= -1;
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "tomato";
      ctx.fillRect(state.x, state.y, 20, 20);
    };

    const loop = () => {
      update();
      draw();
      animationFrameId = requestAnimationFrame(loop);
    };
    loop();

    // Cleanup prevents duplicate loops (important with StrictMode)
    return () => cancelAnimationFrame(animationFrameId);
  }, [width, height]);

  return <canvas ref={canvasRef} width={width} height={height} />;
}
