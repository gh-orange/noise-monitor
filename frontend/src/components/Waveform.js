import React, { useState, useEffect, useRef } from "react";
import ReactECharts from "echarts-for-react";

export default function Waveform({ decibel }) {
  const [waveformData, setWaveformData] = useState([]);
  const prevDecibelRef = useRef(null);

  useEffect(() => {
    if (prevDecibelRef.current !== decibel) {
      prevDecibelRef.current = decibel;
      setWaveformData(prev => {
        const newData = [...prev, decibel];
        if (newData.length > 100) {
          newData.shift();
        }
        return newData.length > 0 ? newData : [decibel];
      });
    }
  }, [decibel]);

  const getOption = () => ({
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "line", lineStyle: { type: "dashed", color: "#00FFFF" } },
      formatter: (params) => {
        const relativeTime = (params[0].dataIndex * 0.1).toFixed(1);
        return "Noise Level: " + params[0].value.toFixed(1) + " dB (" + relativeTime + "s ago)";
      },
      backgroundColor: "rgba(10, 14, 39, 0.9)",
      borderColor: "rgba(0, 255, 255, 0.3)",
      textStyle: { color: "#E2E8F0" }
    },
    grid: { left: 0, right: 0, top: 0, bottom: 0 },
    xAxis: { type: "category", data: waveformData.map((_, idx) => idx), show: false },
    yAxis: { type: "value", show: false, min: 0, max: 200 },
    series: [{
      type: "line",
      data: waveformData,
      smooth: true,
      symbol: "none",
      lineStyle: { width: 3, color: "#00FFFF", shadowColor: "#00FFFF", shadowBlur: 20 },
      areaStyle: {
        color: {
          type: "linear",
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [{
            offset: 0, color: "rgba(0, 255, 255, 0.4)"
          }, {
            offset: 1, color: "rgba(0, 255, 255, 0.02)"
          }]
        }
      }
    }]
  });

  return <ReactECharts option={getOption()} style={{ width: "100%", height: "300px" }} />;
}

