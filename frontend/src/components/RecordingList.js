import { useState, useEffect } from "react";

export default function RecordingList({ recordings, currentPlayingId, playbackDuration, playbackStartTime, onPlay, onDelete }) {
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [selectAll, setSelectAll] = useState(false);

  // Expand all date groups by default
  useEffect(() => {
    if (recordings.length > 0) {
      const grouped = {};
      recordings.forEach(recording => {
        const date = new Date(recording.created);
        const dateKey = date.toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, "-");
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push(recording);
      });
      setExpandedGroups(new Set(Object.keys(grouped)));
    }
  }, [recordings]);

  // Update playback progress
  useEffect(() => {
    if (playbackStartTime && playbackDuration && currentPlayingId) {
      const interval = setInterval(() => {
        const elapsed = Date.now() - playbackStartTime;
        const progress = Math.min((elapsed / playbackDuration) * 100, 100);
        setPlaybackProgress(progress);
      }, 100);
      return () => clearInterval(interval);
    } else {
      setPlaybackProgress(0);
    }
  }, [playbackStartTime, playbackDuration, currentPlayingId]);

  const formatDuration = (seconds) => {
    if (!seconds || isNaN(seconds)) return "0s";
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`;
  };

  const toggleDateGroup = (dateKey) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(dateKey)) {
      newExpanded.delete(dateKey);
    } else {
      newExpanded.add(dateKey);
    }
    setExpandedGroups(newExpanded);
  };

  const toggleSelectAll = () => {
    const newSelectAll = !selectAll;
    setSelectAll(newSelectAll);
    if (newSelectAll) {
      setSelectedItems(new Set(recordings.map(r => r.path)));
    } else {
      setSelectedItems(new Set());
    }
  };

  const toggleItemSelection = (path) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(path)) {
      newSelected.delete(path);
    } else {
      newSelected.add(path);
    }
    setSelectedItems(newSelected);
  };

  const batchDelete = () => {
    if (selectedItems.size === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedItems.size} selected recordings?`)) return;
    selectedItems.forEach(path => onDelete(path));
    setSelectedItems(new Set());
    setSelectAll(false);
  };

  if (recordings.length === 0) {
    return (
      <div className="recordings">
        <div className="recordings-header">
          <h3>Recordings</h3>
        </div>
        <div className="recordings-list">
          <p className="empty">No recordings</p>
        </div>
      </div>
    );
  }

  const grouped = {};
  recordings.forEach(recording => {
    const date = new Date(recording.created);
    const dateKey = date.toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, "-");
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(recording);
  });

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div className="recordings">
      <div className="recordings-header">
        <h3>Recordings</h3>
        <div className="recordings-toolbar">
          <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
            <input type="checkbox" id="selectAll" checked={selectAll} onChange={toggleSelectAll} />
            <span>Select All</span>
          </label>
          <button className="btn btn-small btn-danger" onClick={batchDelete} disabled={selectedItems.size === 0}>
            Batch Delete
          </button>
        </div>
      </div>
      <div className="recordings-list">
        {sortedDates.map(dateKey => {
          const dateRecordings = grouped[dateKey];
          const dateObj = new Date(dateKey);
          const formattedDate = `${dateObj.getFullYear()}/${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
          const isExpanded = expandedGroups.has(dateKey);
          return (
            <div key={dateKey} className="date-group">
              <div className="date-header" onClick={() => toggleDateGroup(dateKey)}>
                <span className="date-title">{formattedDate} <span className="date-count">{dateRecordings.length} items</span></span>
                <span className="expand-icon">{isExpanded ? "▼" : "▶"}</span>
              </div>
              <div className="date-content" style={{ display: isExpanded ? "block" : "none" }}>
                {dateRecordings.map(recording => {
                  const date = new Date(recording.created);
                  const timeStr = date.toLocaleTimeString();
                  const endDate = new Date(date.getTime() + recording.duration * 1000);
                  const endTimeStr = endDate.toLocaleTimeString();
                  const isPlaying = currentPlayingId === recording.path;
                  const isSelected = selectedItems.has(recording.path);
                  return (
                    <div key={recording.path}>
                      <div className={`recording-item ${isPlaying ? "playing" : ""}`}>
                        <input type="checkbox" className="recording-checkbox" checked={isSelected}
                          onChange={() => toggleItemSelection(recording.path)} />
                        <div className="recording-info">
                          <span className="recording-time">{timeStr} - {endTimeStr}</span>
                          <span className="recording-duration">{formatDuration(recording.duration)}</span>
                          {recording.peak && <span className="recording-peak">Peak: {recording.peak.toFixed(1)} dB</span>}
                        </div>
                        <button className="btn btn-small btn-play" onClick={() => onPlay(recording.path)} disabled={isPlaying}>
                          {isPlaying ? "Playing" : "Play"}
                        </button>
                        <button className="btn btn-small btn-danger" onClick={() => { if (window.confirm("Are you sure you want to delete this recording?")) onDelete(recording.path); }}>
                          Delete
                        </button>
                      </div>
                      {isPlaying && (
                        <div className="playback-progress-bar">
                          <div className="playback-progress" style={{ width: `${playbackProgress}%` }}></div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
