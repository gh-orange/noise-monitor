const AudioRecorder = require("./audioRecorder");
const AudioPlayer = require("./audioPlayer");
const AudioCapture = require("./audioCapture");
const BrightnessController = require('./brightnessController');
const VolumeController = require('./volumeController');
const EventEmitter = require("events");

class NoiseMonitor extends EventEmitter {
  constructor(config) {
   super();
   this.config = {
    threshold: 65,
    delayBeforeRecord: 2,
    keepRecordingAfterSilence: 10,
    playDelay: 3,
      playDuration: "full",
      resumeDetectionDelay: 2,
    maxRecordDuration: 10800,
    gainFactor: 901,
    pauseDetectionDuringPlayback: true,
    ...config
  };
   
   this.currentDecibel = 0;
   this.aboveThresholdStartTime = null;
   this.belowThresholdStartTime = null;
   this.isAboveThreshold = false;
   this.isRecording = false;
   this.isRunning = false;
   this.peakDecibel = 0;
   this.isDetectingPaused = false;
  
   this.audioRecorder = new AudioRecorder(this.config);
   this.audioPlayer = new AudioPlayer(this.config);
   this.audioCapture = new AudioCapture(this.config);
   this.brightnessController = new BrightnessController();
   this.volumeController = new VolumeController();

   this.brightnessController.setBrightness(0);
   this.volumeController.setVolume(100);
   this.setupRecorderCallbacks();
   this.setupPlayerCallbacks();
   this.setupCaptureCallbacks();
 }
  
  setupCaptureCallbacks() {
    this.audioCapture.on("audioData", (data) => {
      this.processAudioData(data);
    });
    
    this.audioCapture.on("started", () => {
      console.log("Audio capture started");
    });
    
    this.audioCapture.on("stopped", () => {
      console.log("Audio capture stopped");
    });
    
    this.audioCapture.on("error", (error) => {
      console.error("Audio capture error:", error);
    });
  }
  
  setupRecorderCallbacks() {
   this.audioRecorder.on("onRecordingStarted", () => {
     this.isRecording = true;
     this.peakDecibel = 0;
     this.emit("recordingStarted", { filename: this.audioRecorder.recordingFilename });
   });
   
   this.audioRecorder.on("onRecordingEnded", (recording) => {
     this.isRecording = false;
     this.emit("recordingStopped", { filename: this.audioRecorder.recordingFilename, recording: recording });
      
      // Auto-play with delay
      if (this.audioRecorder.recordingFilename) {
        console.log("[DEBUG] Scheduling playback with delay:", this.config.playDelay, "seconds");
        this.audioPlayer.schedulePlayback(this.audioRecorder.recordingFilename, this.config.playDelay);
      }
   });
 }
  
  setupPlayerCallbacks() {
  this.audioPlayer.on("onPlaybackScheduled", (data) => {
    if (this.config.pauseDetectionDuringPlayback) {
      this.isDetectingPaused = true;
      console.log(`[NoiseMonitor] Playback scheduled, pausing threshold detection, will resume in ${data.delay} s`);
    }
    this.emit("playbackScheduled", data);
  });
  
  this.audioPlayer.on("onPlaybackStarted", (data) => {
    console.log("[NoiseMonitor] Playback started");
    this.emit("playbackStarted", data);
  });
  
  this.audioPlayer.on("onPlaybackStopped", () => {
      if (this.config.pauseDetectionDuringPlayback) {
        console.log(`[NoiseMonitor] Playback ended, will resume threshold detection in ${this.config.resumeDetectionDelay} s`);
        setTimeout(() => {
          this.isDetectingPaused = false;
          console.log("[NoiseMonitor] Resumed threshold detection");
        }, this.config.resumeDetectionDelay * 1000);
      }
      this.emit("playbackStopped");
    });
}
  
  start() {
    if (this.isRunning) {
      console.log("Already running");
      return;
    }
    
    console.log("Starting detection...");
    this.audioCapture.start();
    this.isRunning = true;
  }
  
  stop() {
    if (!this.isRunning) {
      console.log("Not running");
      return;
    }
    
    console.log("Stopping detection...");
    if (this.isRecording) {
      this.stopRecording();
    }
    
    this.audioCapture.stop();
    this.isRunning = false;
  }
  
  processAudioData(data) {
     if (!Buffer.isBuffer(data)) {
       console.warn("Not a Buffer, skipping audio data");
       return;
     }
     
     const decibel = this.calculateDecibel(data);
     console.log("Processing audio data:", data.length, "bytes, decibel:", decibel.toFixed(2));
     this.currentDecibel = decibel;
     
     if (this.isRecording && decibel > this.peakDecibel) {
       this.peakDecibel = decibel;
       this.audioRecorder.updatePeakDecibel(decibel);
     }
    
    this.emit("decibel", { decibel: decibel, timestamp: Date.now(), isRecording: this.isRecording, isAboveThreshold: this.isAboveThreshold });
  
   if (!this.isDetectingPaused) {
     this.detectThreshold(decibel);
   }
   
    if (this.isRecording) {
      this.audioRecorder.writeAudioData(data);
    }
  }
  
  calculateDecibel(data) {
     const samples = [];
     for (let i = 0; i < data.length; i += 2) {
       const sample = data.readInt16LE(i);
       samples.push(sample);
     }
     
     if (samples.length === 0) return 0;
     
     let sum = 0;
     for (const sample of samples) {
       sum += sample * sample;
     }
     
     const rms = Math.sqrt(sum / samples.length);
     
     const reference = 1000;
     const decibel = 20 * Math.log10(rms / reference);
     
     const adjustedDecibel = decibel + 96;
     return Math.max(0, adjustedDecibel);
  }
  
  detectThreshold(decibel) {
    const isAbove = decibel >= this.config.threshold;
    
    if (isAbove !== this.isAboveThreshold) {
      if (isAbove) {
        this.aboveThresholdStartTime = Date.now();
        this.belowThresholdStartTime = null;
      } else {
        this.belowThresholdStartTime = Date.now();
        this.aboveThresholdStartTime = null;
      }
      this.isAboveThreshold = isAbove;
    }
    
    const now = Date.now();
    
    if (isAbove && this.aboveThresholdStartTime) {
      const duration = (now - this.aboveThresholdStartTime) / 1000;
      console.log("[DEBUG] Above threshold, duration:", duration.toFixed(2), "s, delayBeforeRecord:", this.config.delayBeforeRecord, "s, isRecording:", this.isRecording);
      if (duration >= this.config.delayBeforeRecord && !this.isRecording) {
        console.log("[DEBUG] STARTING RECORDING! Duration:", duration, "seconds");
        this.startRecording();
      }
    }
    
    if (!isAbove && this.belowThresholdStartTime) {
      const duration = (now - this.belowThresholdStartTime) / 1000;
      console.log("[DEBUG] Below threshold, duration:", duration.toFixed(2), "s, keepRecordingAfterSilence:", this.config.keepRecordingAfterSilence, "s, isRecording:", this.isRecording);
      if (duration >= this.config.keepRecordingAfterSilence && this.isRecording) {
        console.log("[DEBUG] STOPPING RECORDING! Duration:", duration, "seconds");
        this.stopRecording();
      }
    }
  }

  startRecording() {
    if (this.isRecording) {
      console.log("Already recording");
      return;
    }
    
    console.log("[DEBUG] startRecording() called, starting...");
    this.audioRecorder.startRecording();
  }
  
  stopRecording() {
    if (!this.isRecording) {
      console.log("Not recording");
      return;
    }
    
    console.log("[DEBUG] stopRecording() called, stopping...");
    this.audioRecorder.stopRecording();
  }
  
  playRecording(filename) {
    console.log("Playing recording:", filename);
    this.audioPlayer.play(filename);
  }

  stopPlayback() {
    console.log("Stopping playback");
    this.audioPlayer.stop();
  }

  on(event, callback) {
    super.on(event, callback);
 }
  
  updateConfig(newConfig) {
    console.log("Updating config:", newConfig);
    this.config = { ...this.config, ...newConfig };
    
    if (this.audioCapture && this.audioCapture.updateConfig) {
      this.audioCapture.updateConfig(this.config);
    }
    
    if (this.audioRecorder && this.audioRecorder.updateConfig) {
      this.audioRecorder.updateConfig(this.config);
    }
    
    if (this.audioPlayer && this.audioPlayer.updateConfig) {
      this.audioPlayer.updateConfig(this.config);
    }
  }
  
  getCurrentDecibel() {
    return this.currentDecibel;
  }
  
  getPeakDecibel() {
    return this.peakDecibel;
  }
  
  isDetecting() {
    return this.isRunning;
  }
  
  isCurrentlyRecording() {
    return this.isRecording;
  }
}

module.exports = NoiseMonitor;


