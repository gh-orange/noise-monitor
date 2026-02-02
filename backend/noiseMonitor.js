const AudioRecorder = require("./audioRecorder");
const AudioPlayer = require("./audioPlayer");
const AudioCapture = require("./audioCapture");
const BrightnessController = require('./brightnessController');
const VolumeController = require('./volumeController');
const EventEmitter = require("events");
const FFT = require('fft-js').fft;
const IFFT = require('fft-js').ifft;

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
    useFastDecibel: true,
    enableAWeighting: false,
    voiceFrequencyRange: { min: 85, max: 801 },
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
   this.voiceDetected = false;
  this.aWeightingCoefficients = this.precomputeAWeightingCoefficients();
  
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

  precomputeAWeightingCoefficients() {
    const coefficients = {};
    const sampleRate = this.config.sampleRate || 16000;
    
    for (let freq = 20; freq <= sampleRate / 2; freq += 1) {
      coefficients[freq] = this.calculateAWeightingCoefficient(freq);
    }
    
    return coefficients;
  }

  calculateAWeightingCoefficient(f) {
    if (f <= 0) return 0;
    
    const f2 = f * f;
    const ra = 12200 * 12200;
    const rb = 20.6 * 20.6;
    const rc = 107.7 * 107.7;
    const rd = 737.9 * 737.9;
    
    const numerator = ra * f2 * f2 * f2 * f2;
    const denominator = (f2 + rb) * Math.sqrt((f2 + rc) * (f2 + rd)) * (f2 + ra) * (f2 + 12200 * 12200);
    
    const aWeight = numerator / denominator;
    
    const aWeightDb = 20 * Math.log10(aWeight) + 2.0;

    return Math.pow(10, aWeightDb / 20);
  }

  applyAWeighting(samples) {
    if (!this.config.enableAWeighting) {
      return samples;
    }
    
    const sampleRate = this.config.sampleRate || 16000;
    const phasors = FFT(samples);
    
    for (let i = 0; i < phasors.length; i++) {
      const freq = (i * sampleRate) / phasors.length;
      
      const freqIndex = Math.min(Math.max(Math.round(freq), 20), Math.floor(sampleRate / 2));
      const coefficient = this.aWeightingCoefficients[freqIndex] || 1;
      
      phasors[i][0] *= coefficient;
      phasors[i][1] *= coefficient;
    }
    
    const weightedSamples = IFFT(phasors);
    
    return weightedSamples.map(val => Math.round(val));
  }

  applyFrequencyRangeFilter(samples) {
    if (!this.config.voiceFrequencyRange) {
      return samples;
    }
    
    const { min, max } = this.config.voiceFrequencyRange;
    const sampleRate = this.config.sampleRate || 16000;
    
    if (min >= max) {
      return samples;
    }
    
    const phasors = FFT(samples);
    const nyquist = sampleRate / 2;
    
    const minIndex = Math.floor((min / sampleRate) * phasors.length);
    const maxIndex = Math.ceil((max / sampleRate) * phasors.length);
    
    for (let i = 0; i < phasors.length; i++) {
      const freq = (i * sampleRate) / phasors.length;
      
      if (freq < min || freq > max) {
        phasors[i][0] = 0;
        phasors[i][1] = 0;
      }
    }
    
    const filteredSamples = IFFT(phasors);
    
    return filteredSamples.map(val => Math.round(val[0]));
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
     
     let processedSamples = samples;
     if (this.config.voiceFrequencyRange && 
         (this.config.voiceFrequencyRange.min > 0 || this.config.voiceFrequencyRange.max < 8000)) {
       processedSamples = this.applyFrequencyRangeFilter(processedSamples);
     }
     
     if (this.config.enableAWeighting) {
       processedSamples = this.applyAWeighting(processedSamples);
     }
      
      if (this.config.useFastDecibel) {
        return this.calculateFastDecibel(processedSamples);
      }
      
      return this.calculateStandardDecibel(processedSamples);
  }
  
  calculateFastDecibel(samples) {
     if (samples.length === 0) return 0;
     
     let peak = 0;
     for (let i = 0; i < samples.length; i++) {
       const abs = Math.abs(samples[i]);
       if (abs > peak) peak = abs;
     }
     
     let sumAbs = 0;
     for (let i = 0; i < samples.length; i++) {
       sumAbs += Math.abs(samples[i]);
     }
     const avgAbs = sumAbs / samples.length;
     
     const rms = (peak * 0.7 + avgAbs * 0.3) / Math.sqrt(2);
     
     // Use a lower reference value (0.3x) for increased sensitivity
     const reference = 1000;
     const effectiveReference = reference * 0.3;
     
     // 添加保护：确保 log10 的参数有效
     const logArg = (rms + 1) / effectiveReference;
     if (logArg <= 0 || !isFinite(logArg)) return 0;
     const decibel = 20 * Math.log10(logArg);
     
     // Adjust the offset
     const adjustedDecibel = decibel + 86;
     
     return Math.max(0, adjustedDecibel);
  }
  
  calculateStandardDecibel(samples) {
     if (samples.length === 0) return 0;
     
     let sum = 0;
     for (const sample of samples) {
       sum += sample * sample;
     }
     
     const rms = Math.sqrt(sum / samples.length);
     const reference = 1000;
     // 添加保护：如果 rms 太小或无效，返回 0 而不是 NaN
     if (rms <= 0 || !isFinite(rms)) return 0;
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
    
   if (newConfig.sampleRate) {
     this.aWeightingCoefficients = this.precomputeAWeightingCoefficients();
   }
    
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
