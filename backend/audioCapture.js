const EventEmitter = require("events");
const portAudio = require("naudiodon");

class AudioCapture extends EventEmitter {
  constructor(config) {
    super();
    this.config = {
      sampleRate: 16000,
      channels: 1,
      bitDepth: 16,
      deviceId: -1,
      ...config
    };
    this.audioIO = null;
    this.isCapturing = false;
    this.dataCount = 0;
  }

  start() {
    if (this.isCapturing) {
      console.log("Already running");
      return;
    }
    console.log("Starting audio capture...");
    this.startNaudiodonCapture();
    this.isCapturing = true;
    this.emit("started");
  }

  startNaudiodonCapture() {
    try {
      this.audioIO = new portAudio.AudioIO({
        inOptions: {
          channelCount: this.config.channels,
          sampleFormat: portAudio.SampleFormat16Bit,
          sampleRate: this.config.sampleRate,
          deviceId: this.config.deviceId,
          closeOnError: false,
          highwaterMark: 4096,
          maxQueue: 64
        }
      });

      this.audioIO.on("data", (data) => {
        this.dataCount++;
        if (this.dataCount % 100 === 0) {
          console.log("Read audio data:", data.length, "bytes, count:", this.dataCount);
        }
        this.emit("audioData", data);
      });

      this.audioIO.on("error", (err) => {
        console.error("Audio capture error:", err);
        this.emit("error", err);
        this.stop();
      });

      this.audioIO.on("close", () => {
        console.log("Audio stream closed");
      });

      this.audioIO.start();
      console.log("Audio capture started with naudiodon");
    } catch (error) {
      console.error("Failed to start audio capture:", error);
      this.emit("error", error);
      this.isCapturing = false;
    }
  }

  stop() {
    if (!this.isCapturing) {
      console.log("Not running");
      return;
    }
    console.log("Stopping audio capture...");
    if (this.audioIO) {
      this.audioIO.quit(() => {
        console.log("Audio capture stopped, total data count:", this.dataCount);
        this.audioIO = null;
        this.isCapturing = false;
        this.dataCount = 0;
        this.emit("stopped");
      });
    } else {
      this.isCapturing = false;
      console.log("Audio capture stopped");
      this.emit("stopped");
    }
  }

  isRunning() {
    return this.isCapturing;
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    console.log("Audio capture config updated:", this.config);
  }
}

module.exports = AudioCapture;
