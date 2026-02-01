import { useWebSocket } from "./hooks/useWebSocket";
import { useTheme } from "./hooks/useTheme";
import Header from "./components/Header";
import Waveform from "./components/Waveform";
import DecibelDisplay from "./components/DecibelDisplay";
import ControlButtons from "./components/ControlButtons";
import Settings from "./components/Settings";
import RecordingList from "./components/RecordingList";
import "./App.css";
import "./themes.css";

function App() {
  const {
    isDetecting,
    isRecording,
    isPlaying,
    decibel,
    recordings,
    config,
    currentPlayingId,
    playbackDuration,
    playbackStartTime,
    startDetection,
    stopDetection,
    updateConfig,
    playRecording,
    deleteRecording,
    cancelPlayback,
  } = useWebSocket();

  const { themeMode, setThemeMode } = useTheme();

  return (
    <div id="app">
      <Header isDetecting={isDetecting} isRecording={isRecording} isPlaying={isPlaying} themeMode={themeMode} setThemeMode={setThemeMode} />
      <main>
        <div className="main-content">
          <div className="waveform-container">
            <Waveform decibel={decibel} />
            <DecibelDisplay decibel={decibel} threshold={config.threshold} />
          </div>
          <ControlButtons
            isDetecting={isDetecting}
            isPlaying={isPlaying}            onStart={startDetection}
            onStop={stopDetection}
            onCancelPlayback={cancelPlayback}
          />
          <Settings config={config} onConfigChange={updateConfig} />
        </div>
        <RecordingList
          recordings={recordings}
          currentPlayingId={currentPlayingId}
          playbackDuration={playbackDuration}
          playbackStartTime={playbackStartTime}
          onPlay={playRecording}
          onDelete={deleteRecording}
        />
      </main>
    </div>
  );
}

export default App;