# Noise Monitor

A real-time noise monitoring and recording system built with Node.js and React.

## Features

- **Real-time Noise Detection**: Monitor ambient noise levels with customizable threshold
- **Automatic Recording**: Automatically record when noise exceeds threshold
- **Audio Playback**: Play recorded audio with gain control
- **Real-time Waveform Display**: Visualize noise levels with interactive waveform chart
- **Recording Management**: View, play, and delete recordings organized by date
- **Batch Operations**: Select and delete multiple recordings at once
- **Theme Support**: Light, dark, and auto theme modes
- **WebSocket Communication**: Real-time updates between backend and frontend

## Architecture

```
noiseMonitor/
|-- backend/           # Node.js Express server + WebSocket
|   |-- audioCapture.js    # Audio capture module
|   |-- audioPlayer.js     # Audio playback with gain control
|   |-- noiseMonitor.js    # Noise detection and recording logic
|   |-- server.js          # Express server entry point
|   |-- temp/              # Temporary audio storage
|   `-- package.json
|-- frontend/          # React 19 web application
|   |-- src/
|   |   |-- components/    # React components
|   |   |   |-- ControlButtons.js
|   |   |   |-- Header.js
|   |   |   |-- RecordingList.js
|   |   |   |-- Settings.js
|   |   |   `-- Waveform.js
|   |   |-- hooks/         # Custom React hooks
|   |   |   `-- useWebSocket.js
|   |   |-- App.js         # Main application component
|   |   |-- App.css        # Application styles
|   |   `-- themes.css     # Theme styles
|   |-- public/            # Static assets
|   `-- package.json
|-- recordings/        # Recording files organized by date (YYYY-MM-DD)
`-- start.bat          # Quick start script
```

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Microphone access permission

## Installation

### Backend Setup

```bash
cd backend
npm install
```

### Frontend Setup

```bash
cd frontend
npm install
```

## Usage

### Quick Start

Run the following command from the project root:

```bash
start.bat
```

This will automatically start both the backend server and frontend application in separate windows:
- Backend runs on `http://localhost:3000`
- Frontend opens in your browser

### Manual Start

If you prefer to start the services manually:

**Start Backend:**

```bash
cd backend
npm start
```

The backend server will start on `http://localhost:3000`

**Start Frontend:**

In a new terminal:

```bash
cd frontend
npm start
```

The React application will open in your browser at `http://localhost:3001`

## Configuration

### Settings

Adjust the following settings in the frontend interface:

- **Noise Threshold**: Trigger recording when noise exceeds this level (20-100 dB)
- **Recording Delay**: Delay before starting recording after threshold exceeded (0-10 s)
- **Silence Before Stop**: Wait time before stopping recording when noise drops (1-60 s)
- **Max Record Duration**: Maximum recording length (5 min, 30 min, 1h, 2h, 3h)
- **Pause Detection During Playback**: Pause noise detection during audio playback
- **Playback Delay**: Delay before playing recorded audio (-1 to 30 s, -1 = disabled)
- **Gain Factor**: Amplification factor for playback (1-1501x)
- **Resume Detection Delay**: Delay before resuming detection after playback (0-10 s)
- **Playback Duration**: How much of the recording to play (Full, 10s, 30s, 1 min)

## Backend Dependencies

- `express`: Web server framework
- `ws`: WebSocket server
- `naudiodon`: Audio capture from microphone
- `loudness`: Audio loudness calculation
- `wav`: WAV file encoding
- `node-wav-player`: Audio playback
- `cors`: Cross-origin resource sharing

## Frontend Dependencies

- `react`: UI library
- `echarts-for-react`: Waveform visualization
- `react-scripts`: Build tooling

## Development

### Backend Development

```bash
cd backend
npm start
```

### Frontend Development

```bash
cd frontend
npm start
```

Hot reload is enabled for frontend development.

### Build for Production

```bash
cd frontend
npm run build
```

## Recording Storage

Recordings are saved in the `recordings/` directory, organized by date:

```
recordings/
├── 2024-01-15/
│   ├── recording_001.wav
│   └── recording_002.wav
└── 2024-01-16/
    └── recording_003.wav
```

## WebSocket API

### Server → Client Messages

- `decibel`: Current noise level update
- `recordings`: List of recordings
- `status`: Detection status
- `recordingStarted`: Recording started
- `recordingStopped`: Recording stopped
- `playbackStarted`: Playback started
- `playbackStopped`: Playback stopped
- `config`: Configuration update
- `state`: Current state

### Client → Server Messages

- `start`: Start detection
- `stop`: Stop detection
- `updateConfig`: Update configuration
- `playRecording`: Play a recording
- `deleteRecording`: Delete a recording
- `stopPlayback`: Stop current playback
- `getState`: Get current state

## Browser Support

- Chrome (recommended)
- Firefox
- Edge
- Safari

## Troubleshooting

### Microphone Access

Ensure your browser has permission to access the microphone. If prompted, allow microphone access.

### WebSocket Connection

If the frontend cannot connect to the backend:
1. Ensure the backend server is running on port 3000
2. Check browser console for error messages
3. Verify firewall settings

### Audio Playback Issues

If audio playback fails:
1. Check system volume settings
2. Ensure audio files exist in the recordings directory
3. Verify gain factor is not too high

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and questions, please open an issue on the project repository.