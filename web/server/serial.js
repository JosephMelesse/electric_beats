import { EventEmitter } from "node:events";

const KEY_LINE = /^K ([0-9*#])$/;

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
        const match = KEY_LINE.exec(line.trim());
        if (match !== null) {
          this.emit("key", match[1]);
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
