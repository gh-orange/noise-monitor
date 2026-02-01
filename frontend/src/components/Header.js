export default function Header({ isDetecting, isRecording, isPlaying, themeMode, setThemeMode }) {

  const getStatusText = () => {
    if (isRecording) return "Recording";
    if (isPlaying) return "Playing";
    if (isDetecting) return "Detecting";
    return "Idle";
  };

  const getStatusClass = () => {
    if (isRecording) return "recording";
    if (isPlaying) return "playing";
    if (isDetecting) return "detecting";
    return "idle";
  };

  const handleThemeChange = (mode) => {
    setThemeMode(mode);
  };

  return (
    <header>
      <h1>Noise Monitor</h1>
      <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
        <span className={`status ${getStatusClass()}`}>{getStatusText()}</span>
        <div className="theme-switcher">
          <button
            className={`theme-option ${themeMode === "light" ? "active" : ""}`}
            onClick={() => handleThemeChange("light")}
            title="Light Mode"
          >
            ☀️
          </button>
          <button
            className={`theme-option ${themeMode === "dark" ? "active" : ""}`}
            onClick={() => handleThemeChange("dark")}
            title="Dark Mode"
          >
            🌙
          </button>
          <button
            className={`theme-option ${themeMode === "auto" ? "active" : ""}`}
            onClick={() => handleThemeChange("auto")}
            title="Auto Follow System"
          >
            🔄
          </button>
        </div>
      </div>
    </header>
  );
}
