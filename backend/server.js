const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const cors = require("cors");
const NoiseMonitor = require("./noiseMonitor");
const path = require("path");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));

const config = {
  threshold: 65,
  delayBeforeRecord: 0,
  keepRecordingAfterSilence: 2,
  playDelay: 2,
  playDuration: "full",
  resumeDetectionDelay: 2,
  maxRecordDuration: 10800,
  gainFactor: 901,
  recordingsPath: path.join(__dirname, "../recordings")
};

const monitor = new NoiseMonitor(config);

let clients = [];
let recordings = [];

function loadRecordings() {
  try {
    const recordingsPath = config.recordingsPath;
    if (!fs.existsSync(recordingsPath)) {
      fs.mkdirSync(recordingsPath, { recursive: true });
      return;
    }
    const dateDirs = fs.readdirSync(recordingsPath)
      .filter(dir => fs.statSync(path.join(recordingsPath, dir)).isDirectory());
    const allFiles = [];
    dateDirs.forEach(dateDir => {
      const datePath = path.join(recordingsPath, dateDir);
      const files = fs.readdirSync(datePath)
        .filter(file => file.endsWith(".wav"))
        .map(file => {
          const filePath = path.join(datePath, file);
          const stats = fs.statSync(filePath);
          return {
            filename: file,
            path: "/" + dateDir + "/" + file,
            size: stats.size,
            duration: (stats.size / (16000 * 1 * 2)).toFixed(2),
            created: stats.mtime,
            url: "/recordings/" + dateDir + "/" + file
          };
        });
      allFiles.push(...files);
    });
    recordings = allFiles.sort((a, b) => b.created - a.created);
    console.log("Loaded " + recordings.length + " recordings from " + dateDirs.length + " dates");
  } catch (error) {
    console.error("Failed to load recordings", error);
  }
}

wss.on("connection", (ws) => {
  console.log("Client connected");
  clients.push(ws);
  ws.send(JSON.stringify({ type: "connected" }));
  ws.send(JSON.stringify({ type: "recordings", recordings: recordings }));
  ws.send(JSON.stringify({ type: "config", config: config }));
  
  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      handleMessage(ws, data);
    } catch (error) {
      console.error("Failed to parse message", error);
    }
  });
  
  ws.on("close", () => {
    console.log("Client disconnected");
    clients = clients.filter(client => client !== ws);
  });
});

function handleMessage(ws, data) {
  switch (data.type) {
    case "start":
      monitor.start();
      ws.send(JSON.stringify({ type: "status", running: true, playing: monitor.audioPlayer.isPlaying }));
      break;
    case "stop":
      monitor.stop();
      ws.send(JSON.stringify({ type: "status", running: false }));
      break;
    case "playRecording":
      if (data.id) {
        const filePath = path.join(config.recordingsPath, data.id.replace(/^\//, ""));
        console.log("Playing file:", filePath);
        monitor.playRecording(filePath);
      }
      break;
    case "stopPlayback":
      monitor.stopPlayback();
      break;
    case "deleteRecording":
      if (data.id) {
        const filePath = path.join(__dirname, "../recordings", data.id.replace(/^\//, ""));
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          loadRecordings();
          clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ type: "deleteResult", success: true }));
              client.send(JSON.stringify({ type: "recordings", recordings: recordings }));
              client.send(JSON.stringify({ type: "config", config: config }));
            }
          });
        } else {
          ws.send(JSON.stringify({ type: "deleteResult", success: false, error: "File not found" }));
        }
      }
      break;
    case "updateConfig":
      if (data.config) {
        Object.assign(config, data.config);
        monitor.updateConfig(data.config);
        ws.send(JSON.stringify({ type: "config", config: config }));
      }
      break;
    case "getRecordings":
      loadRecordings();
      ws.send(JSON.stringify({ type: "recordings", recordings: recordings }));
      ws.send(JSON.stringify({ type: "config", config: config }));
      break;
    case "getState":
      ws.send(JSON.stringify({ 
        type: "state", 
        running: monitor.isDetecting(),
        recording: monitor.isCurrentlyRecording(),
        playing: monitor.audioPlayer.isPlaying
      }));
      break;
  }
}

monitor.on("decibel", (data) => {
  console.log("Sending decibel update:", data.decibel);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: "decibelUpdate", decibel: data.decibel }));
    }
  });
});

monitor.on("recordingStarted", (data) => {
  console.log("Recording started", data.filename);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: "recordingStarted", data }));
    }
  });
});

monitor.on("recordingStopped", (data) => {
  console.log("Recording ended", data.filename);
  loadRecordings();
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: "recordingStopped" }));
      client.send(JSON.stringify({ type: "recordings", recordings: recordings }));
    }
  });
});

monitor.on("playbackStarted", (data) => {
    console.log("[DEBUG] Broadcasting playbackStarted to clients, data:", data);
  console.log("Playback started", data.filename);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: "playbackStarted", data }));
    }
  });
});

monitor.on("playbackStopped", () => {
  console.log("Playback stopped");
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: "playbackStopped" }));
    }
  });
});

app.get("/recordings/:date/:filename", (req, res) => {
  const { date, filename } = req.params;
  const filePath = path.join(__dirname, "../recordings", date, filename);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send("File not found");
  }
});

app.get("/api/recordings", (req, res) => {
  loadRecordings();
  res.json(recordings);
});

app.get("/api/status", (req, res) => {
  res.json({
    isRunning: monitor.isRunning,
    currentDecibel: monitor.currentDecibel,
    threshold: monitor.config.threshold,
    isRecording: monitor.isRecording
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running at http://localhost:" + PORT);
  loadRecordings();
  monitor.start();
  console.log("Detection started automatically");
});

