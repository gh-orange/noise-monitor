import {useState, useEffect, useCallback, useRef, useTransition} from "react";

const WS_URL = "ws://localhost:3000";

const DEBUG = process.env.NODE_ENV === 'development';
const debugLog = (...args) => {
  if (DEBUG) {
    console.log(...args);
  }
};

export function useWebSocket() {
    const [isPending, startTransition] = useTransition();
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
    const reconnectTimeoutRef = useRef(null);
    const messageQueueRef = useRef([]);
    const isRecordingRef = useRef(false);
    const isPlayingRef = useRef(false);
    
    useEffect( () => {
        configRef.current = config;
    }
    , [config]);
    
    useEffect( () => {
        isDetectingRef.current = isDetecting;
    }
    , [isDetecting]);

    useEffect( () => {
        isRecordingRef.current = isRecording;
    }
    , [isRecording]);

    useEffect( () => {
        isPlayingRef.current = isPlaying;
    }
    , [isPlaying]);
    
    const handleMessage = useCallback((data) => {
        if (data.type !== 'decibelUpdate') {
            debugLog("Received message:", data.type, data);
        }
        
        try {
            switch (data.type) {
            case "config":
                startTransition(() => {
                    setConfig(prev => ({
                        ...prev,
                        ...data.config
                    }));
                });
                break;
            case "decibel":
            case "decibelUpdate":
                setDecibel(parseFloat(data.decibel));
                break;
            case "recordings":
                startTransition(() => {
                    setRecordings(data.recordings || []);
                });
                break;
            case "status":
                if (!isRecordingRef.current && !isPlayingRef.current)
                    setIsDetecting(data.running);
                break;
            case "recordingStarted":
                setIsRecording(true);
                debugLog("Started recording");
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
                debugLog("Unknown message type:", data.type);
                break;
            }
        } catch (error) {
            console.error("Error handling message:", error, data);
        }
    }, []);
    
    const sendMessage = useCallback( (message) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            messageQueueRef.current.push(message);
            return false;
        }
        
        try {
            wsRef.current.send(JSON.stringify(message));
            return true;
        } catch (error) {
            console.error("Error sending message:", error, message);
            return false;
        }
    }
    , []);
    
    const flushMessageQueue = useCallback(() => {
        while (messageQueueRef.current.length > 0) {
            const message = messageQueueRef.current.shift();
            sendMessage(message);
        }
    }, [sendMessage]);
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const connect = useCallback(() => {
        try {
            wsRef.current = new WebSocket(WS_URL);
            
            wsRef.current.onopen = () => {
                debugLog("WebSocket connected successfully");
                setIsConnected(true);
                
                sendMessage({
                    type: "getState"
                });
                
                flushMessageQueue();
            };
            
            wsRef.current.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    handleMessage(data);
                } catch (e) {
                    console.error("Message parsing error:", e, event.data);
                }
            };
            
            wsRef.current.onerror = (error) => {
                console.error("WebSocket error:", error);
            };
            
            wsRef.current.onclose = (event) => {
                debugLog("WebSocket disconnected, code:", event.code, "reason:", event.reason);
                setIsConnected(false);
                
                if (reconnectTimeoutRef.current) {
                    clearTimeout(reconnectTimeoutRef.current);
                }
                
                reconnectTimeoutRef.current = setTimeout(() => {
                    debugLog("Attempting to reconnect...");
                    connect();
                }, 3000);
            };
        } catch (error) {
            console.error("Error creating WebSocket:", error);
        }
    }, []);
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect( () => {
        connect();
        
        return () => {
            // 清理 WebSocket 连接
            if (wsRef.current) {
                wsRef.current.close();
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                messageQueueRef.current = [];
            }
        };
    }, []);
    
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
        isPending,
        startDetection,
        stopDetection,
        updateConfig,
        playRecording,
        deleteRecording,
        cancelPlayback
    };
}
