import { useEffect, useRef, useState, useCallback } from "react";

// Add Web Speech API type definitions
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
  interpretation: any;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionError extends Event {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionError) => void;
  onend: () => void;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
  prototype: SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionConstructor;
    webkitSpeechRecognition: SpeechRecognitionConstructor;
  }
}

type Props = {
  onTextMessage: (textChunk: string, isFinal?: boolean) => void;
  onAudioMessage?: (audioBuffer: ArrayBuffer) => void;
  onTurnComplete?: () => void;
};

export function useADKWebSocket({
  onTextMessage,
  onAudioMessage,
  onTurnComplete,
}: Props) {
  const ws = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeout = useRef<NodeJS.Timeout>();
  const reconnectAttempts = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 1000; // 1 second
  const audioContext = useRef<AudioContext | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const interimMessageRef = useRef<string>("");

  // Store callbacks in refs to prevent unnecessary reconnections
  const callbacksRef = useRef({
    onTextMessage,
    onAudioMessage,
    onTurnComplete,
  });

  // Update callbacks without triggering reconnection
  useEffect(() => {
    callbacksRef.current = {
      onTextMessage,
      onAudioMessage,
      onTurnComplete,
    };
  }, [onTextMessage, onAudioMessage, onTurnComplete]);

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const sessionId = "001"; // You can randomize or parametrize this
    const wsUrl = `ws://localhost:8000/ws/${sessionId}?is_audio=false`; // Always start in text mode
    
    try {
      const socket = new WebSocket(wsUrl);
      ws.current = socket;

      socket.onopen = () => {
        console.log("[WS] Connected.");
        setIsConnected(true);
        reconnectAttempts.current = 0;
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          // Handle turn completion first
          if (message.turn_complete) {
            console.log("[WS] Turn complete received");
            callbacksRef.current.onTextMessage("", true); // Mark final message complete
            if (callbacksRef.current.onTurnComplete) {
              callbacksRef.current.onTurnComplete();
            }
            return;
          }

          // Handle text
          if (message.mime_type === "text/plain") {
            callbacksRef.current.onTextMessage(message.data, false);
          }

          // Handle audio (optional)
          else if (message.mime_type === "audio/pcm" && callbacksRef.current.onAudioMessage) {
            try {
              const binary = atob(message.data);
              const buffer = new Uint8Array(binary.length);
              for (let i = 0; i < binary.length; i++) {
                buffer[i] = binary.charCodeAt(i);
              }
              callbacksRef.current.onAudioMessage(buffer.buffer);
            } catch (err) {
              console.error("[WS] Failed to decode audio:", err);
            }
          }
        } catch (err) {
          console.error("[WS] Failed to parse message:", err);
        }
      };

      socket.onerror = (err) => {
        console.error("[WS] Error:", err);
        setIsConnected(false);
      };

      socket.onclose = () => {
        console.log("[WS] Disconnected.");
        setIsConnected(false);
        
        // Only attempt to reconnect if we're not intentionally closing
        if (!isRecording && reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts.current += 1;
          console.log(`[WS] Attempting to reconnect (${reconnectAttempts.current}/${MAX_RECONNECT_ATTEMPTS})...`);
          reconnectTimeout.current = setTimeout(connect, RECONNECT_DELAY * reconnectAttempts.current);
        } else {
          console.error("[WS] Max reconnection attempts reached or recording stopped.");
        }
      };
    } catch (err) {
      console.error("[WS] Failed to create WebSocket:", err);
      setIsConnected(false);
    }
  }, []);

  // Only connect once on mount
  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      if (ws.current) {
        ws.current.close();
      }
      if (audioContext.current) {
        audioContext.current.close();
      }
    };
  }, [connect]);

  const sendUserMessage = useCallback((text: string) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        mime_type: "text/plain",
        data: text
      }));
      console.log("[WS] Sent text message:", text);
    } else {
      console.error("[WS] Cannot send message: WebSocket is not connected");
    }
  }, []);

  const startListening = useCallback(async () => {
    if (isRecording) {
      stopListening();
      return;
    }

    try {
      // Initialize speech recognition
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        throw new Error("Speech recognition not supported in this browser");
      }

      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }

        // Update the UI with interim results as a user message
        if (interimTranscript && interimTranscript !== interimMessageRef.current) {
          interimMessageRef.current = interimTranscript;
          // Show interim results as a user message
          callbacksRef.current.onTextMessage(interimTranscript, false);
        }
        
        // When we have a final result, just store it
        if (finalTranscript) {
          const finalText = finalTranscript.trim();
          if (finalText) {
            interimMessageRef.current = finalText;
          }
        }
      };

      recognition.onerror = (event) => {
        console.error("[Speech] Recognition error:", event.error);
        if (event.error === 'no-speech') {
          // Restart recognition if no speech is detected
          recognition.stop();
          recognition.start();
        }
      };

      recognition.onend = () => {
        // Only restart recognition if we're still recording
        if (isRecording) {
          recognition.start();
        }
      };

      recognition.start();

      // Close existing WebSocket connection before starting new one
      if (ws.current) {
        ws.current.close();
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // Create audio context and analyzer
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      
      source.connect(processor);
      processor.connect(audioContext.destination);
      
      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        // Convert Float32Array to Int16Array (PCM format)
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
        }
        
        if (ws.current?.readyState === WebSocket.OPEN) {
          const base64 = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
          ws.current.send(JSON.stringify({
            mime_type: "audio/pcm",
            data: base64,
          }));
        }
      };
      
      setIsRecording(true);
      // Connect WebSocket with audio mode enabled
      connect();
      console.log("[Audio] Started recording");
    } catch (err) {
      console.error("[Audio] Failed to start recording:", err);
      stopListening(); // Clean up if there's an error
    }
  }, [isRecording, connect, sendUserMessage]);

  const stopListening = useCallback(() => {
    // Set isRecording to false first to prevent any new messages from being sent
    setIsRecording(false);

    // Stop speech recognition
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    // Stop audio processing
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Send final transcript if we have one
    if (interimMessageRef.current) {
      const finalText = interimMessageRef.current;
      interimMessageRef.current = "";
      
      // Ensure we have a connection before sending
      if (ws.current?.readyState === WebSocket.OPEN) {
        sendUserMessage(finalText);
      } else {
        console.error("WebSocket not connected when trying to send final transcription");
        // Try to reconnect and send
        connect();
        setTimeout(() => {
          if (ws.current?.readyState === WebSocket.OPEN) {
            sendUserMessage(finalText);
          }
        }, 1000);
      }
    }

    // Close WebSocket connection
    if (ws.current) {
      ws.current.close();
    }
    console.log("[Audio] Stopped recording");
  }, [connect, sendUserMessage]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  return { sendUserMessage, isConnected, startListening, stopListening, isRecording };
}
