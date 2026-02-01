export default function ControlButtons({ isDetecting, isPlaying, onStart, onStop, onCancelPlayback }) {

  return (
    <div className="controls">
      <button className="btn btn-primary" onClick={onStart} disabled={isDetecting}>
        Start Detection
      </button>
      <button className="btn btn-secondary" onClick={onStop} disabled={!isDetecting}>
        Stop Detection
      </button>
      <button className="btn btn-warning" onClick={onCancelPlayback} disabled={!isPlaying}>
        Cancel Playback
      </button>
    </div>
  );
}
