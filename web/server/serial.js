import { EventEmitter } from "node:events";

const KEY_LINE = /^K ([0-9*#])$/;
const PRESET_LINE = /^P ([\w-]+)$/;
const VOLUME_LINE = /^V (\d{1,3})$/;

export class SerialSource extends EventEmitter {
  constructor({ path, baudRate = 115200, retryMs = 2000 }) {
    super();
    this.path = path;
    this.baudRate = baudRate;
    this.retryMs = retryMs;
    this.buffer = "";
    this.timer = null;
  }

  async start() {
    let SerialPort;
    try {
      ({ SerialPort } = await import("serialport"));
    } catch {
      this.emit("status", {
        connected: false,
        reason: "serialport not installed, run npm install",
      });
      return;
    }
    this.SerialPort = SerialPort;
    this.open();
  }

  open() {
    const port = new this.SerialPort({
      path: this.path,
      baudRate: this.baudRate,
      autoOpen: false,
    });

    port.open((err) => {
      if (err) {
        this.emit("status", { connected: false, reason: err.message });
        this.scheduleRetry();
        return;
      }
      this.buffer = "";
      this.emit("status", { connected: true });
    });

    port.on("data", (chunk) => {
      this.buffer += chunk.toString("utf8");
      const lines = this.buffer.split("\n");
      this.buffer = lines.pop();
      for (const line of lines) {
        const text = line.trim();
        const key = KEY_LINE.exec(text);
        if (key !== null) {
          this.emit("key", key[1]);
          continue;
        }
        const preset = PRESET_LINE.exec(text);
        if (preset !== null) {
          this.emit("preset", preset[1]);
          continue;
        }
        const volume = VOLUME_LINE.exec(text);
        if (volume !== null) {
          this.emit("volume", Math.min(100, Number(volume[1])));
        }
      }
    });

    port.on("error", (err) => {
      this.emit("status", { connected: false, reason: err.message });
    });

    port.on("close", () => {
      this.emit("status", { connected: false, reason: "port closed" });
      this.scheduleRetry();
    });
  }

  scheduleRetry() {
    if (this.timer !== null) {
      return;
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      this.open();
    }, this.retryMs);
    this.timer.unref?.();
  }
}
