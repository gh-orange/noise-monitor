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
      highwaterMark: 4096,
      maxQueue: 128,
      ...config
    };
    this.audioIO = null;
    this.isCapturing = false;
    this.dataCount = 0;
    this.overflowCount = 0;
    this.lastProcessTime = 0;
    this.processingTime = 0;
    this.isProcessing = false;
    this.droppedFrames = 0;
  }

  start() {
    if (this.isCapturing) {
      console.log("[AudioCapture] Already running");
      return;
    }
    console.log("[AudioCapture] Starting audio capture...");
    console.log("[AudioCapture] Config - sampleRate:", this.config.sampleRate, ", highwaterMark:", this.config.highwaterMark, ", maxQueue:", this.config.maxQueue);
    this.startNaudiodonCapture();
    this.isCapturing = true;
    this.dataCount = 0;
    this.overflowCount = 0;
    this.droppedFrames = 0;
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
          highwaterMark: this.config.highwaterMark,
          maxQueue: this.config.maxQueue
        }
      });

      this.audioIO.on("data", (data) => {
        const startTime = Date.now();
        
        if (this.isProcessing) {
          this.droppedFrames++;
          if (this.droppedFrames % 10 === 0) {
            console.warn(`[AudioCapture] Dropped ${this.droppedFrames} frames due to processing backlog`);
          }
          return;
        }
        
        this.isProcessing = true;
        this.dataCount++;
        
        if (this.dataCount % 100 === 0) {
          const avgProcessTime = this.processingTime / this.dataCount;
          console.log(`[AudioCapture] Read ${data.length} bytes, count: ${this.dataCount}, avg process: ${avgProcessTime.toFixed(2)}ms`);
          
          if (avgProcessTime > 100) {
            console.warn(`[AudioCapture] Processing too slow (${avgProcessTime.toFixed(2)}ms), may cause overflow`);
          }
        }
        
        this.emit("audioData", data);
        
        const endTime = Date.now();
        const processDuration = endTime - startTime;
        this.processingTime += processDuration;
        this.isProcessing = false;
      });

      this.audioIO.on("error", (err) => {
        console.error("[AudioCapture] Audio capture error:", err);
        
        if (err && err.message && err.message.includes("overflow")) {
          this.overflowCount++;
          console.warn(`[AudioCapture] Overflow detected (count: ${this.overflowCount}), dropped frames: ${this.droppedFrames}`);
          this.emit("overflow", { count: this.overflowCount, droppedFrames: this.droppedFrames });
          return;
        }
        
        this.emit("error", err);
        this.stop();
      });

      this.audioIO.on("close", () => {
        console.log("[AudioCapture] Audio stream closed");
      });

      this.audioIO.start();
      console.log("[AudioCapture] Audio capture started");
    } catch (error) {
      console.error("[AudioCapture] Failed to start audio capture:", error);
      this.emit("error", error);
      this.isCapturing = false;
    }
  }

  stop() {
    if (!this.isCapturing) {
      console.log("[AudioCapture] Not running");
      return;
    }
    console.log("[AudioCapture] Stopping audio capture...");
    console.log(`[AudioCapture] Statistics - Total frames: ${this.dataCount}, Overflows: ${this.overflowCount}, Dropped frames: ${this.droppedFrames}`);
    console.log(`[AudioCapture] Average processing time: ${(this.processingTime / Math.max(1, this.dataCount)).toFixed(2)}ms`);
    
    if (this.audioIO) {
      this.audioIO.quit(() => {
        console.log("[AudioCapture] Audio capture stopped");
        this.audioIO = null;
        this.isCapturing = false;
        this.dataCount = 0;
        this.overflowCount = 0;
        this.droppedFrames = 0;
        this.processingTime = 0;
        this.emit("stopped");
      });
    } else {
      this.isCapturing = false;
      console.log("[AudioCapture] Audio capture stopped");
      this.emit("stopped");
    }
  }

  isRunning() {
    return this.isCapturing;
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    console.log("[AudioCapture] Config updated:", this.config);
  }

  getStats() {
    return {
      dataCount: this.dataCount,
      overflowCount: this.overflowCount,
      droppedFrames: this.droppedFrames,
      avgProcessTime: this.processingTime / Math.max(1, this.dataCount),
      isProcessing: this.isProcessing
    };
  }
}

module.exports = AudioCapture;
