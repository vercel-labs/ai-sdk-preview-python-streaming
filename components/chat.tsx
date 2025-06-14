"use client";

import { PreviewMessage, ThinkingMessage } from "@/components/message";
import { MultimodalInput } from "@/components/multimodal-input";
import { Overview } from "@/components/overview";
import { useScrollToBottom } from "@/hooks/use-scroll-to-bottom";
import React, { useState, useEffect } from "react";
import { toast } from "sonner";

export function Chat() {
  const chatId = "001";
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messagesContainerRef, messagesEndRef] = useScrollToBottom<HTMLDivElement>();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) return;
    const userMessage = { id: Date.now(), role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setInput("");
    try {
      const res = await fetch("http://127.0.0.1:8000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage.content }),
      });
      if (!res.ok) throw new Error("Failed to send message");
      const data = await res.json();
      const botMessage = {
        id: Date.now() + 1,
        role: "assistant",
        content: data.response,
      };
      setMessages((prev) => [...prev, botMessage]);
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 2, role: "assistant", content: "Erro ao enviar mensagem." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

      <form className="flex mx-auto px-4 bg-background pb-4 md:pb-6 gap-2 w-full md:max-w-3xl" onSubmit={handleSubmit}>
        <MultimodalInput
          chatId={chatId}
          input={input}
          setInput={setInput}
          handleSubmit={(
            event?: { preventDefault?: (() => void) | undefined },
            chatRequestOptions?: any
          ) => {
            if (event && event.preventDefault) event.preventDefault();
            // Optionally, you can adapt handleSubmit to accept these params if needed
            handleSubmit({ preventDefault: () => {} } as React.FormEvent<HTMLFormElement>);
          }}
          isLoading={isLoading}
          stop={() => {}}
          messages={messages}
          setMessages={setMessages}
          append={async (msg: any, _chatRequestOptions?: any) => {
            setMessages((prev) => [...prev, msg]);
            return null;
          }}
        />
      </form>
    </div>
  );
}
