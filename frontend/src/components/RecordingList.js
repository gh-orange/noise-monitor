import { useState, useEffect, useRef, useMemo, memo, useTransition, useCallback } from "react";

const RecordingItem = memo(({ recording, currentPlayingId, isSelected, playbackProgress, onPlay, onDelete, onToggleSelection }) => {
  const date = new Date(recording.created);
  const timeStr = date.toLocaleTimeString();
  const endDate = new Date(date.getTime() + recording.duration * 1000);
  const endTimeStr = endDate.toLocaleTimeString();
  const isPlaying = currentPlayingId === recording.path;
  
  const formattedDuration = useMemo(() => {
    if (!recording.duration || isNaN(recording.duration)) return "0s";
    const minutes = Math.floor(recording.duration / 60);
    const secs = Math.floor(recording.duration % 60);
    return minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`;
  }, [recording.duration]);

  const handlePlay = useCallback(() => {
    onPlay(recording.path);
  }, [onPlay, recording.path]);

  const handleDelete = useCallback(() => {
    if (window.confirm("Are you sure you want to delete this recording?")) {
      onDelete(recording.path);
    }
  }, [onDelete, recording.path]);

  const handleToggleSelection = useCallback(() => {
    onToggleSelection(recording.path);
  }, [onToggleSelection, recording.path]);

  return (
    <div>
      <div className={`recording-item ${isPlaying ? "playing" : ""}`}>
        <input type="checkbox" className="recording-checkbox" checked={isSelected} onChange={handleToggleSelection} />
        <div className="recording-info">
          <span className="recording-time">{timeStr} - {endTimeStr}</span>
          <span className="recording-duration">{formattedDuration}</span>
          {recording.peak && <span className="recording-peak">Peak: {recording.peak.toFixed(1)} dB</span>}
        </div>
        <button className="btn btn-small btn-play" onClick={handlePlay} disabled={isPlaying}>
          {isPlaying ? "Playing" : "Play"}
        </button>
        <button className="btn btn-small btn-danger" onClick={handleDelete}>
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
});

RecordingItem.displayName = "RecordingItem";

const DateGroup = memo(({ dateKey, dateRecordings, currentPlayingId, selectedItems, playbackProgress, isExpanded, onPlay, onDelete, onToggleSelection, onToggleGroup }) => {
  const dateObj = new Date(dateKey);
  const formattedDate = `${dateObj.getFullYear()}/${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
  
  const handleToggleGroup = useCallback(() => {
    onToggleGroup(dateKey);
  }, [onToggleGroup, dateKey]);
  
  return (
    <div className="date-group">
      <div className="date-header" onClick={handleToggleGroup}>
        <span className="date-title">{formattedDate} <span className="date-count">{dateRecordings.length} items</span></span>
        <span className="expand-icon">{isExpanded ? "▼" : "▶"}</span>
      </div>
      <div 
        className="date-content" 
        style={{ 
          display: isExpanded ? "block" : "none",
          contentVisibility: isExpanded ? "visible" : "auto",
          containIntrinsicSize: "1px 500px"
        }}
      >
        {dateRecordings.map(recording => (
          <RecordingItem
            key={recording.path}
            recording={recording}
            currentPlayingId={currentPlayingId}
            isSelected={selectedItems.has(recording.path)}
            playbackProgress={playbackProgress}
            onPlay={onPlay}
            onDelete={onDelete}
            onToggleSelection={onToggleSelection}
          />
        ))}
      </div>
    </div>
  );
});

DateGroup.displayName = "DateGroup";

export default function RecordingList({ recordings, currentPlayingId, playbackDuration, playbackStartTime, onPlay, onDelete }) {
  const [, startTransition] = useTransition();
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const initializedRef = useRef(false);
  const previousRecordingsLengthRef = useRef(0);

  const groupedRecordings = useMemo(() => {
    const grouped = {};
    recordings.forEach(recording => {
      const date = new Date(recording.created);
      const dateKey = date.toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, "-");
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(recording);
    });
    return grouped;
  }, [recordings]);

  const sortedDates = useMemo(() => {
    return Object.keys(groupedRecordings).sort((a, b) => b.localeCompare(a));
  }, [groupedRecordings]);

  const toggleDateGroup = useCallback((dateKey) => {
    setExpandedGroups(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(dateKey)) {
        newExpanded.delete(dateKey);
      } else {
        newExpanded.add(dateKey);
      }
      return newExpanded;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectAll(prev => {
      const newSelectAll = !prev;
      if (newSelectAll) {
        setSelectedItems(new Set(recordings.map(r => r.path)));
      } else {
        setSelectedItems(new Set());
      }
      return newSelectAll;
    });
  }, [recordings]);

  const toggleItemSelection = useCallback((path) => {
    setSelectedItems(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(path)) {
        newSelected.delete(path);
      } else {
        newSelected.add(path);
      }
      return newSelected;
    });
  }, []);

  const batchDelete = useCallback(() => {
    if (selectedItems.size === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedItems.size} selected recordings?`)) return;
    selectedItems.forEach(path => onDelete(path));
    setSelectedItems(new Set());
    setSelectAll(false);
  }, [selectedItems, onDelete]);

  useEffect(() => {
    if (!initializedRef.current && recordings.length > 0 && previousRecordingsLengthRef.current === 0) {
      startTransition(() => {
        setExpandedGroups(new Set(Object.keys(groupedRecordings)));
        initializedRef.current = true;
      });
    }
    // Update previous length ref
    previousRecordingsLengthRef.current = recordings.length;
  }, [recordings, groupedRecordings, startTransition]);

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
      <div className="recordings-list" style={{ contentVisibility: "auto", overflowY: "scroll" }}>
        {sortedDates.map(dateKey => (
          <DateGroup
            key={dateKey}
            dateKey={dateKey}
            dateRecordings={groupedRecordings[dateKey]}
            currentPlayingId={currentPlayingId}
            selectedItems={selectedItems}
            playbackProgress={playbackProgress}
            isExpanded={expandedGroups.has(dateKey)}
            onPlay={onPlay}
            onDelete={onDelete}
            onToggleSelection={toggleItemSelection}
            onToggleGroup={toggleDateGroup}
          />
        ))}
      </div>
    </div>
  );
}
