const fs = require("fs");
const path = require("path");
const wav = require("wav");

class AudioRecorder {
  constructor(config) {
    this.config = {
      recordingsPath: path.join(__dirname, "../recordings"),
      maxRecordDuration: 10800,
      sampleRate: 16000,
      channels: 1,
      ...config
    };
    this.isRecording = false;
    this.recordStartTime = null;
    this.recordingFilename = null;
    this.wavWriter = null;
    this.outputStream = null;
    this.peakDecibel = 0;
    this.callbacks = {
      onRecordingStarted: null,
      onRecordingEnded: null
    };
    this.ensureRecordingsDir();
  }

  ensureRecordingsDir() {
    if (!fs.existsSync(this.config.recordingsPath)) {
      fs.mkdirSync(this.config.recordingsPath, { recursive: true });
    }
  }

  startRecording() {
    if (this.isRecording) return;
    console.log("Start recording...");
    this.isRecording = true;
    this.recordStartTime = new Date();
    this.peakDecibel = 0;
    const dateStr = this.recordStartTime.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, "-");
    const timeStr = this.recordStartTime.toTimeString().split(" ")[0].replace(/:/g, "");
    const dateDir = path.join(this.config.recordingsPath, dateStr);
    if (!fs.existsSync(dateDir)) {
      fs.mkdirSync(dateDir, { recursive: true });
    }
    this.recordingFilename = path.join(dateDir, timeStr + ".wav");
    try {
      this.outputStream = fs.createWriteStream(this.recordingFilename);
      this.wavWriter = new wav.Writer({
        sampleRate: this.config.sampleRate,
        channels: this.config.channels,
        bitDepth: 16
      });
      this.wavWriter.pipe(this.outputStream);
      console.log("Recording started, file:", this.recordingFilename);
      if (this.callbacks.onRecordingStarted) {
        this.callbacks.onRecordingStarted();
      }
    } catch (error) {
      console.error("Failed to start recording:", error);
      this.isRecording = false;
    }
  }

  stopRecording() {
    if (!this.isRecording) return;
    console.log("Stop recording...");
    this.isRecording = false;
    const duration = ((new Date() - this.recordStartTime) / 1000).toFixed(2);
    console.log("Recording stopped, duration:", duration, "seconds");
    const recording = {
      id: this.recordStartTime.getTime(),
      filename: this.recordingFilename,
      startTime: this.recordStartTime.toISOString(),
           duration: parseFloat(duration),
           peakDecibel: this.peakDecibel
    };
    
    if (this.wavWriter) {
      this.wavWriter.end();
      this.wavWriter = null;
    }
    
    if (this.outputStream) {
      this.outputStream.on('finish', () => {
        console.log("File writing completed:", this.recordingFilename);
        if (this.callbacks.onRecordingEnded) {
          this.callbacks.onRecordingEnded(recording);
        }
      });
      this.outputStream.end();
      this.outputStream = null;
    } else {
      if (this.callbacks.onRecordingEnded) {
        this.callbacks.onRecordingEnded(recording);
      }
    }
  }

  writeAudioData(data) {
    if (!this.isRecording || !this.wavWriter) return;
    try {
      this.wavWriter.write(data);
    } catch (error) {
      console.error("Error writing audio data:", error);
    }
  }

  updatePeakDecibel(decibel) {
    if (decibel > this.peakDecibel) {
      this.peakDecibel = decibel;
    }
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  on(event, callback) {
    if (this.callbacks.hasOwnProperty(event)) {
      this.callbacks[event] = callback;
    }
  }
}

module.exports = AudioRecorder;

