import {useState, useEffect, useCallback, useRef} from "react";

const WS_URL = "ws://localhost:3000";

export function useWebSocket() {
    const [isConnected,setIsConnected] = useState(false);
    const [isDetecting,setIsDetecting] = useState(false);
    const [isRecording,setIsRecording] = useState(false);
    const [isPlaying,setIsPlaying] = useState(false);
    const [decibel,setDecibel] = useState(0);
    const [recordings,setRecordings] = useState([]);
    const [config,setConfig] = useState({
        threshold: 65,
        delayBeforeRecord: 0,
        keepRecordingAfterSilence: 2,
        playDelay: 2,
        playDuration: "full",
        maxRecordDuration: 10800,
        gainFactor: 901,
        pauseDetectionDuringPlayback: true,
        resumeDetectionDelay: 2,
        useFastDecibel: true,
        enableAWeighting: false,
        voiceFrequencyRange: { min: 85, max: 801 }
    });
    const [currentPlayingId,setCurrentPlayingId] = useState(null);
    const [playbackDuration,setPlaybackDuration] = useState(null);
    const [playbackStartTime,setPlaybackStartTime] = useState(null);
    const wsRef = useRef(null);
    const isDetectingRef = useRef(false);
    const configRef = useRef(config);
    useEffect( () => {
        configRef.current = config;
    }
    , [config]);
    useEffect( () => {
        isDetectingRef.current = isDetecting;
    }
    , [isDetecting]);
    const handleMessage = useCallback( (data) => {
        console.log("Received message:", data.type, data);
        switch (data.type) {
        case "config":
            setConfig(prev => ({
                ...prev,
                ...data.config
            }));
            break;
        case "decibel":
        case "decibelUpdate":
            setDecibel(parseFloat(data.decibel));
            break;
        case "recordings":
            setRecordings(data.recordings || []);
            break;
        case "status":
            if (!isRecording && !isPlaying)
                setIsDetecting(data.running);
            break;
        case "recordingStarted":
            setIsRecording(true);
            console.log("Started recording");
            break;
        case "recordingStopped":
            setIsRecording(false);
            setIsDetecting(isDetectingRef.current);
            break;
        case "playbackStarted":
            setIsPlaying(true);
            if (data.data && data.data.filename) {
                const filename = data.data.filename.replace(/^.+[\\/]/, "");
                const dateMatch = data.data.filename.match(/[\\/](\d{4}-\d{2}-\d{2})[\\/]/);
                const id = dateMatch ? "/" + dateMatch[1] + "/" + filename : "/" + filename;
                setCurrentPlayingId(id);
            }
            if (data.data && data.data.duration !== undefined) {
                setPlaybackDuration(data.data.duration * 1000);
                setPlaybackStartTime(Date.now());
            }
            break;
        case "playbackStopped":
            setIsPlaying(false);
            setCurrentPlayingId(null);
            setPlaybackStartTime(null);
            setPlaybackDuration(null);
            setIsDetecting(isDetectingRef.current);
            break;
        case "state":
            if (data.running !== undefined)
                setIsDetecting(data.running);
            if (data.recording)
                setIsRecording(true);
            if (data.playing)
                setIsPlaying(true);
            break;
        default:
            break;
        }
    }
    , [isRecording, isPlaying]);
    const sendMessage = useCallback( (message) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN)
            wsRef.current.send(JSON.stringify(message));
    }
    , []);
    useEffect( () => {
        wsRef.current = new WebSocket(WS_URL);
        wsRef.current.onopen = () => {
            console.log("WebSocket connected successfully");
            setIsConnected(true);
            sendMessage({
                type: "getState"
            });
        }
        ;
        wsRef.current.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                handleMessage(data);
            } catch (e) {
                console.error("Message parsing error:", e);
            }
        }
        ;
        wsRef.current.onclose = () => {
            console.log("WebSocket disconnected, reconnecting in 3s...");
            setIsConnected(false);
            setTimeout( () => {
                wsRef.current = new WebSocket(WS_URL);
            }
            , 3000);
        }
        ;
        return () => {
            if (wsRef.current)
                wsRef.current.close();
        }
        ;
    }
    , [sendMessage, handleMessage]);
    const startDetection = useCallback( () => {
        sendMessage({
            type: "start"
        });
        setIsDetecting(true);
    }
    , [sendMessage]);
    const stopDetection = useCallback( () => {
        sendMessage({
            type: "stop"
        });
        setIsDetecting(false);
    }
    , [sendMessage]);
    const updateConfig = useCallback( (newConfig) => {
        setConfig(prev => ({
            ...prev,
            ...newConfig
        }));
        sendMessage({
            type: "updateConfig",
            config: {
                ...configRef.current,
                ...newConfig
            }
        });
    }
    , [sendMessage]);
    const playRecording = useCallback( (id) => {
        setCurrentPlayingId(id);
        sendMessage({
            type: "playRecording",
            id
        });
    }
    , [sendMessage]);
    const deleteRecording = useCallback( (id) => {
        sendMessage({
            type: "deleteRecording",
            id
        });
    }
    , [sendMessage]);
    const cancelPlayback = useCallback( () => {
        sendMessage({
            type: "stopPlayback"
        });
    }
    , [sendMessage]);
    return {
        isConnected,
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
        cancelPlayback
    };
}
