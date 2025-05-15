"use client";

import { useEffect, useState } from "react";
import { PreviewMessage, ThinkingMessage } from "@/components/message";
import { MultimodalInput } from "@/components/multimodal-input";
import { Overview } from "@/components/overview";
import { useScrollToBottom } from "@/hooks/use-scroll-to-bottom";
import { useADKWebSocket } from "@/hooks/useADKWebSocket";
import { Message, CreateMessage, ChatRequestOptions } from "ai";
import { toast } from "sonner";

export function Chat() {
  const chatId = "001";

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const append = async (
    message: Message | CreateMessage,
    chatRequestOptions?: ChatRequestOptions
  ) => {
    setMessages((prev) => [...prev, message as Message]);
    return message.id;
  };

  const stop = () => {
    // Optionally implement stop signal over WebSocket later
  };

  const {
    sendUserMessage,
    startListening,
    stopListening,
    isConnected,
    isRecording,
  } = useADKWebSocket({
    onTextMessage: (chunk: string, isFinal = false) => {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
  
        // If we're recording, show interim results as user messages
        if (isRecording && !isFinal) {
          if (last?.role === "user") {
            return [
              ...prev.slice(0, -1),
              { ...last, content: chunk },
            ];
          }
          return [
            ...prev,
            {
              id: `user-${Date.now()}`,
              role: "user",
              content: chunk,
            },
          ];
        }
  
        // For non-recording messages (assistant responses)
        if (last?.role === "assistant" && !isFinal) {
          return [
            ...prev.slice(0, -1),
            { ...last, content: last.content + chunk },
          ];
        }
  
        if (chunk && !isFinal) {
          return [
            ...prev,
            {
              id: `assistant-${Date.now()}`,
              role: "assistant",
              content: chunk,
            },
          ];
        }

        return prev;
      });
  
      if (isFinal) setIsLoading(false);
    },
    onTurnComplete: () => setIsLoading(false),
    onAudioMessage: (buffer: ArrayBuffer) => {
      try {
        const audioContext = new AudioContext();
        audioContext.decodeAudioData(buffer).then((decoded) => {
          const source = audioContext.createBufferSource();
          source.buffer = decoded;
          source.connect(audioContext.destination);
          source.start(0);
        }).catch(err => {
          console.error("[Audio] Failed to decode audio:", err);
        });
      } catch (err) {
        console.error("[Audio] Failed to create audio context:", err);
      }
    },
  });

  useEffect(() => {
    if (!isConnected) {
      toast.error("WebSocket connection lost. Attempting to reconnect...");
    } else {
      toast.success("WebSocket connected");
    }
  }, [isConnected]);

  const handleSubmit = (
    event?: { preventDefault?: () => void },
    chatRequestOptions?: ChatRequestOptions
  ) => {
    if (event?.preventDefault) {
      event.preventDefault();
    }
    
    if (!input.trim()) return;

    if (!isConnected) {
      toast.error("Cannot send message: WebSocket is not connected");
      return;
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input,
    };

    append(userMessage);
    sendUserMessage(input);
    setInput("");
    setIsLoading(true);
  };

  const [messagesContainerRef, messagesEndRef] =
    useScrollToBottom<HTMLDivElement>();

  return (
    <div className="flex flex-col min-w-0 h-[calc(100dvh-52px)] bg-background">
      <div
        ref={messagesContainerRef}
        className="flex flex-col min-w-0 gap-6 flex-1 overflow-y-scroll pt-4"
      >
        {messages.length === 0 && <Overview />}

        {messages.map((message, index) => (
          <PreviewMessage
            key={message.id}
            chatId={chatId}
            message={message}
            isLoading={isLoading && messages.length - 1 === index}
          />
        ))}

        {isLoading &&
          messages.length > 0 &&
          messages[messages.length - 1].role === "user" && <ThinkingMessage />}

        <div
          ref={messagesEndRef}
          className="shrink-0 min-w-[24px] min-h-[24px]"
        />
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex mx-auto px-4 bg-background pb-4 md:pb-6 gap-2 w-full md:max-w-3xl"
      >
        <MultimodalInput
          chatId={chatId}
          input={input}
          setInput={setInput}
          handleSubmit={handleSubmit}
          isLoading={isLoading}
          stop={stop}
          messages={messages}
          setMessages={setMessages}
          append={append}
          startListening={startListening}
          stopListening={stopListening}
          isRecording={isRecording}
        />
      </form>
    </div>
  );
}
