import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import ReactECharts from "echarts-for-react";
import * as echarts from "echarts";

export default function Waveform({ decibel }) {
  const [waveformData, setWaveformData] = useState([]);
  const prevDecibelRef = useRef(null);
  const dataRef = useRef([]);
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const rafRef = useRef(null);
  const lastOptionRef = useRef(null);

  useEffect(() => {
    if (chartRef.current) {
      const chart = echarts.getInstanceByDom(chartRef.current);
      if (chart) {
        chartInstanceRef.current = chart;
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.dispose();
        chartInstanceRef.current = null;
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  const baseOption = useMemo(() => ({
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
    xAxis: { type: "category", data: [], show: false },
    yAxis: { type: "value", show: false, min: 0, max: 200 },
    series: [{
      type: "line",
      data: [],
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
      },
      animation: false,
      progressive: 200,
      progressiveThreshold: 500
    }]
  }), []);

  const getOption = useCallback(() => {
    const newOption = {
      ...baseOption,
      xAxis: { ...baseOption.xAxis, data: waveformData.map((_, idx) => idx) },
      series: [{ ...baseOption.series[0], data: waveformData }]
    };
    
    const lastOption = lastOptionRef.current;
    if (lastOption && 
        JSON.stringify(lastOption.series[0].data) === JSON.stringify(newOption.series[0].data)) {
      return lastOption;
    }
    
    lastOptionRef.current = newOption;
    return newOption;
  }, [waveformData, baseOption]);

  const updateWaveformData = useCallback(() => {
    setWaveformData([...dataRef.current]);
  }, []);

  useEffect(() => {
    if (prevDecibelRef.current !== decibel) {
      prevDecibelRef.current = decibel;
      
      dataRef.current.push(decibel);
      if (dataRef.current.length > 100) {
        dataRef.current.shift();
      }
      
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      
      rafRef.current = requestAnimationFrame(updateWaveformData);
    }
  }, [decibel, updateWaveformData]);

  return (
    <ReactECharts 
      ref={chartRef}
      option={getOption()} 
      style={{ width: "100%", height: "300px" }}
      lazyUpdate={true}
      onEvents={{}}
    />
  );
}