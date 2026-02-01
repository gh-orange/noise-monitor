const EventEmitter = require("events");
const fs = require("fs");
const path = require("path");
const wavPlayer = require("node-wav-player");
const wav = require("wav");
const { Transform } = require("stream");

class GainTransform extends Transform {
  constructor(options) {
    super(options);
    this.bitDepth = options.bitDepth || 16;
    this.channels = options.channels || 1;
    this.gainFactor = options.gainFactor || 1.0;
    this.noiseGateThreshold = options.noiseGateThreshold || 0;
    this.noiseGateRatio = options.noiseGateRatio || 0.1;

    if (this.bitDepth === 16) {
      this.maxValue = 32767;
      this.minValue = -32768;
    } else if (this.bitDepth === 8) {
      this.maxValue = 255;
      this.minValue = 0;
    } else {
      console.warn("[Gain] Unsupported bit depth " + this.bitDepth + "，will skip gain");
      this.skip = true;
    }
  }

  _transform(chunk, encoding, callback) {
    try {
      if (!this.skip) {
        if (this.bitDepth === 16) {
          this.applyGain16Bit(chunk);
        } else if (this.bitDepth === 8) {
          this.applyGain8Bit(chunk);
        }
      }
      this.push(chunk);
      callback();
    } catch (err) {
      callback(err);
    }
  }

  applyGain16Bit(chunk) {
    const samples = new Int16Array(chunk.buffer, chunk.byteOffset, chunk.length / 2);
    for (let i = 0; i < samples.length; i++) {
      let val = samples[i];
      if (this.noiseGateThreshold > 0) {
        const absVal = Math.abs(val);
        if (absVal < this.noiseGateThreshold) {
          val = val * this.noiseGateRatio;
        }
      }
      val = val * this.gainFactor;
      samples[i] = val > this.maxValue ? this.maxValue :
                   val < this.minValue ? this.minValue :
                   Math.round(val);
    }
  }

  applyGain8Bit(chunk) {
    for (let i = 0; i < chunk.length; i++) {
      let val = chunk[i];
      if (this.noiseGateThreshold > 0) {
        const absVal = Math.abs(val - 128);
        if (absVal < this.noiseGateThreshold) {
          val = 128 + (val - 128) * this.noiseGateRatio;
        }
      }
      val = val * this.gainFactor;
      chunk[i] = val > this.maxValue ? this.maxValue :
                 val < this.minValue ? this.minValue :
                 Math.round(val);
    }
  }
}

class AudioPlayer extends EventEmitter {
  constructor(config) {
    super();
    this.config = {
      tempPath: "./temp",
      gainFactor: 901,
      noiseGateThreshold: 1000,
      noiseGateRatio: 0.1,
      playDuration: "full",
      ...config
    };
    this.isPlaying = false;
    this.enhancedAudioFile = null;
    this.ensureTempDir();
  }

  ensureTempDir() {
    if (!fs.existsSync(this.config.tempPath)) {
      fs.mkdirSync(this.config.tempPath, { recursive: true });
    }
  }

  async play(filename) {
    if (this.isPlaying) this.stop();

    const absPath = path.resolve(filename);
    console.log("Playing: " + absPath + " (Gain x" + this.config.gainFactor + ", Noise gate: " + this.config.noiseGateThreshold + ")");

    if (!fs.existsSync(absPath)) {
      console.log("File does not exist: " + absPath);
      return;
    }

    this.isPlaying = true;

    try {
      let playFile = absPath;
      if (this.config.gainFactor !== 1.0 || this.config.noiseGateThreshold > 0) {
        playFile = await this.applyGain(absPath);
      }

        const duration = await this.getWavDuration(playFile);
        console.log("[AudioPlayer] File duration: " + duration.toFixed(2) + "s");

        // Calculate actual playback duration
        let actualPlayDuration = duration;
        if (this.config.playDuration !== "full") {
          const limitDuration = parseInt(this.config.playDuration);
          actualPlayDuration = Math.min(duration, limitDuration);
          console.log("[AudioPlayer] Limiting playback duration to: " + actualPlayDuration + "s");
        }

        this.emit("onPlaybackStarted", { filename: absPath, duration: duration });

        if (this.config.playDuration === "full") {
          if (actualPlayDuration > 3)
            await this.playWithHA()
          await this.playWithWavPlayer(playFile);
        } else {
          await this.playWithTimeout(playFile, actualPlayDuration);
        }
      console.log("Playback completed");
    } catch (err) {
      console.error("Playback failed: " + (err.message || err));
//      throw err;
    } finally {
      this.isPlaying = false;
      this.stop();
      this.emit("onPlaybackStopped");
    }
  }

  async getWavDuration(filename) {
    return new Promise((resolve, reject) => {
      const reader = new wav.Reader();
      let formatInfo = null;
      let dataSize = 0;

      reader.on("format", (format) => {
        formatInfo = format;
      });

      reader.on("data", (chunk) => {
        dataSize += chunk.length;
      });

      reader.on("end", () => {
        if (formatInfo) {
          const bytesPerSample = formatInfo.bitDepth / 8;
          const totalSamples = dataSize / bytesPerSample / formatInfo.channels;
          const duration = totalSamples / formatInfo.sampleRate;
          resolve(duration);
        } else {
          reject(new Error("Cannot get WAV file format information"));
        }
      });

      reader.on("error", reject);

      const fileStream = fs.createReadStream(filename);
      fileStream.pipe(reader);

      fileStream.on("error", reject);
    });
  }

  async applyGain(filename) {
    return new Promise((resolve, reject) => {
      const reader = new wav.Reader();
      const outputPath = path.join(this.config.tempPath, "enhanced_" + Date.now() + ".wav");
      
      reader.on("format", (format) => {
        console.log("[AudioPlayer] Format: " + format.bitDepth + "bit " + format.channels + "ch " + format.sampleRate + "Hz");
        
        const gain = new GainTransform({
          bitDepth: format.bitDepth,
          channels: format.channels,
          gainFactor: this.config.gainFactor,
          noiseGateThreshold: this.config.noiseGateThreshold,
          noiseGateRatio: this.config.noiseGateRatio
        });

        const writer = new wav.FileWriter(outputPath, format);
        
        const fileStream = fs.createReadStream(filename);
        fileStream.pipe(new wav.Reader()).pipe(gain).pipe(writer);
        
        writer.on("finish", () => {
          console.log("[AudioPlayer] Gain processing completed: " + outputPath);
          this.enhancedAudioFile = outputPath;
          resolve(outputPath);
        });
        
        writer.on("error", reject);
      });
      
      reader.on("error", reject);
      
      const fileStream = fs.createReadStream(filename);
      fileStream.pipe(reader);
      
      fileStream.on("error", reject);
    });
  }

  async playWithWavPlayer(filename) {
    return wavPlayer.play({
      path: filename,
      sync: true
    });
  }

  async playWithHA() {
    try {
    } catch(err) {
    }
  }

  async playWithTimeout(filename, durationSeconds) {
    console.log("[AudioPlayer] Starting playback, will stop in " + durationSeconds + " s automatically");

    // Use setTimeout to implement timeout stop
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => {
        console.log("[AudioPlayer] Playback timeout, stopping actively");
        this.stop();
        resolve();
      }, durationSeconds * 1000);
    });

    const playPromise = this.playWithWavPlayer(filename);

    try {
      await Promise.race([playPromise, timeoutPromise]);
    } finally {
      console.log("[AudioPlayer] Playback completed");
    }
  }


  stop() {
    console.log("Stop playback");
    if (this.isPlaying) {
      try {
        wavPlayer.stop();
        console.log("Playback has been stopped");
      } catch (err) {
        console.warn("Stop playback warning: " + err.message);
      }
      this.isPlaying = false;
      this.emit("onPlaybackStopped");
    }
    this.cleanup();
  }

  on(event, callback) {
    super.on(event, callback);
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    console.log("Audio player config updated: " + JSON.stringify(this.config));
  }

  schedulePlayback(filename, delay = 0) {
    if (this.playbackTimer) {
      clearTimeout(this.playbackTimer);
    }
    const actualDelay = delay > 0 ? delay : this.config.playDelay;
    console.log("Scheduled to play in " + actualDelay + " seconds: " + filename);
    // Emit event immediately to pause detection when scheduled
    this.emit("onPlaybackScheduled", { filename, delay: actualDelay });
    if (actualDelay >= 0) {
      this.playbackTimer = setTimeout(() => {
        this.play(filename);
      }, actualDelay * 1000);
    }
  }
  cleanup() {
    if (this.enhancedAudioFile && fs.existsSync(this.enhancedAudioFile)) {
      try {
        fs.unlinkSync(this.enhancedAudioFile);
        console.log("[AudioPlayer] Deleted temporary file: " + this.enhancedAudioFile);
      } catch (e) {
        console.warn("Delete temporary file warning: " + e.message);
      }
      this.enhancedAudioFile = null;
    }
  }
}

module.exports = AudioPlayer;

