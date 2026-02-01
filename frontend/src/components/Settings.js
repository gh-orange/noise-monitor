export default function Settings({ config, onConfigChange }) {

  const handleRangeChange = (key, value) => {
    onConfigChange({ [key]: parseInt(value) });
  };

  const handleSelectChange = (key, value) => {
    onConfigChange({ [key]: value });
  };

  const handleCheckboxChange = (key, checked) => {
    onConfigChange({ [key]: checked });
  };

  const durationMap = {
    300: "5 min",
    1800: "30 min",
    3600: "1 hour",
    7200: "2 hours",
    10800: "3 hours"
  };

  return (
    <div className="settings">
      <h3>⚙️ Settings</h3>
      <div className="setting-item">
        <label>
          <span className="setting-label">Noise Threshold</span>
          <span className="setting-value neon-cyan">{config.threshold} dB</span>
        </label>
        <input type="range" min="20" max="100" value={config.threshold}
          className="neon-range cyan-range"
          onChange={(e) => handleRangeChange("threshold", e.target.value)} />
      </div>
      <div className="setting-item">
        <label>
          <span className="setting-label">Recording Delay</span>
          <span className="setting-value neon-blue">{config.delayBeforeRecord}  s</span>
        </label>
        <input type="range" min="0" max="10" value={config.delayBeforeRecord}
          className="neon-range blue-range"
          onChange={(e) => handleRangeChange("delayBeforeRecord", e.target.value)} />
      </div>
      <div className="setting-item">
        <label>
          <span className="setting-label">Silence Before Stop</span>
          <span className="setting-value neon-pink">{config.keepRecordingAfterSilence}  s</span>
        </label>
        <input type="range" min="1" max="60" value={config.keepRecordingAfterSilence}
          className="neon-range pink-range"
          onChange={(e) => handleRangeChange("keepRecordingAfterSilence", e.target.value)} />
      </div>
      <div className="setting-item">
        <select value={config.maxRecordDuration}
          className="neon-select"
          onChange={(e) => handleSelectChange("maxRecordDuration", e.target.value)}>
          <option value="300">5 min</option>
          <option value="1800">30 min</option>
          <option value="3600">1 hour</option>
          <option value="7200">2 hours</option>
          <option value="10800">3 hours</option>
        </select>
      </div>
      <div className="setting-item">
        <label className="neon-checkbox-label">
          <input type="checkbox" checked={config.pauseDetectionDuringPlayback}
            className="neon-checkbox"
            onChange={(e) => handleCheckboxChange("pauseDetectionDuringPlayback", e.target.checked)} />
          <span className="checkbox-text">Pause Detection During Playback</span>
          <span className="checkmark"></span>
        </label>
      </div>
      <div className="setting-item">
        <label>
          <span className="setting-label">Playback Delay</span>
          <span className="setting-value neon-green">{config.playDelay}  s</span>
        </label>
        <input type="range" min="-1" max="30" value={config.playDelay}
          className="neon-range green-range"
          onChange={(e) => handleRangeChange("playDelay", e.target.value)} />
      </div>
      <div className="setting-item">
        <label>
          <span className="setting-label">Gain Factor</span>
          <span className="setting-value neon-orange">{config.gainFactor} x</span>
        </label>
        <input type="range" min="1" max="1501" step="10" value={config.gainFactor}
          className="neon-range orange-range"
          onChange={(e) => handleRangeChange("gainFactor", e.target.value)} />
      </div>
      <div className="setting-item">
        <label>
          <span className="setting-label">Resume Detection Delay</span>
          <span className="setting-value neon-purple">{config.resumeDetectionDelay} s</span>
        </label>
        <input type="range" min="0" max="10" step="1" value={config.resumeDetectionDelay}
          className="neon-range purple-range"
          onChange={(e) => handleRangeChange("resumeDetectionDelay", e.target.value)} />
      </div>
      <div className="setting-item">
        <label>
          <span className="setting-label">Playback Duration</span>
        </label>
        <select value={config.playDuration}
          className="neon-select"
          onChange={(e) => handleSelectChange("playDuration", e.target.value)}>
          <option value="full">Full</option>
          <option value="10">10 s</option>
          <option value="30">30 s</option>
          <option value="60">1 min</option>
        </select>
      </div>
    </div>
  );
}
