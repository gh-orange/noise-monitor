export default function DecibelDisplay({ decibel, threshold }) {

  const getDecibelClass = (db) => {
    if (db >= threshold) return "danger";
    if (db >= threshold * 0.7) return "warning";
    return "";
  };

  return (
    <div className="decibel-display">
      <span className={`decibel-value ${getDecibelClass(decibel)}`}>
        {decibel.toFixed(1)}
      </span>
      <span className="decibel-unit">dB</span>
    </div>
  );
}
