import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SerialSource } from "./serial.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIR = path.resolve(HERE, "..", "client");

const PORT = 5173;
const SERIAL_PATH = "/dev/ttyACM0";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

async function serveStatic(req, res) {
  const url = new URL(req.url, "http://localhost");
  const rel = url.pathname === "/" ? "/index.html" : url.pathname;
  const file = path.resolve(CLIENT_DIR, "." + rel);
  if (!file.startsWith(CLIENT_DIR)) {
    res.writeHead(403).end("forbidden");
    return;
  }
  try {
    const body = await fs.readFile(file);
    res.writeHead(200, {
      "content-type": MIME[path.extname(file)] ?? "application/octet-stream",
    });
    res.end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
}

async function main() {
  const clients = new Set();
  // Last preset and volume the keypad reported. Held so a browser that
  // connects later is told the current ones instead of waiting for a
  // knob to move.
  let currentPreset = null;
  let currentVolume = null;
  const broadcast = (message) => {
    const payload = JSON.stringify(message);
    for (const socket of clients) {
      if (socket.readyState === 1) {
        socket.send(payload);
      }
    }
  };

  const server = http.createServer(serveStatic);

  let WebSocketServer;
  try {
    ({ WebSocketServer } = await import("ws"));
  } catch {
    console.error("ws is not installed. Run: npm install");
    process.exit(1);
  }

  const wss = new WebSocketServer({ server, path: "/ws" });

  // Control messages (start, retry, song) are relayed to every client,
  // sender included, so all screens act on the same message and stay in
  // step. Clients never apply a control locally when the socket is up.
  wss.on("connection", (socket) => {
    clients.add(socket);
    if (currentPreset !== null) {
      socket.send(JSON.stringify({ type: "preset", name: currentPreset }));
    }
    if (currentVolume !== null) {
      socket.send(JSON.stringify({ type: "volume", value: currentVolume }));
    }
    socket.on("message", (data) => {
      let message;
      try {
        message = JSON.parse(data);
      } catch {
        return;
      }
      if (message?.type === "control") {
        broadcast(message);
      }
    });
    socket.on("close", () => clients.delete(socket));
  });

  const serial = new SerialSource({ path: SERIAL_PATH });
  serial.on("key", (key) => broadcast({ type: "key", key }));
  serial.on("preset", (name) => {
    currentPreset = name;
    broadcast({ type: "preset", name });
  });
  serial.on("volume", (value) => {
    if (value === currentVolume) {
      return;
    }
    currentVolume = value;
    broadcast({ type: "volume", value });
  });

  let serialConnected = null;
  serial.on("status", ({ connected, reason }) => {
    if (connected === serialConnected) {
      return;
    }
    serialConnected = connected;
    console.log(
      connected
        ? `keypad connected on ${SERIAL_PATH}`
        : `keypad unavailable (${reason})`,
    );
  });
  await serial.start();

  server.listen(PORT, () => {
    console.log(`electric_beats on http://localhost:${PORT}`);
  });
}

main();
