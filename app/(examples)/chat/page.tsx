"use client";

import { useChat } from "ai/react";
import { toast } from "sonner";

export default function Page() {
  const { messages, input, handleSubmit, handleInputChange, isLoading } =
    useChat({
      streamMode: "text",
      onError: (error) => {
        if (error.message.includes("Too many requests")) {
          toast.error(
            "You are sending too many messages. Please try again later."
          );
        }
      },
    });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col p-2 gap-2">
        {messages.map((message) => (
          <div key={message.id} className="flex flex-row gap-2">
            <div className="w-24 text-zinc-500 flex-shrink-0">{`${message.role}: `}</div>

            <div className="flex flex-col gap-2">
              {message.content.replaceAll('"', "")}
            </div>
          </div>
        ))}
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-2 fixed bottom-0 p-2 w-full"
      >
        <input
          value={input}
          placeholder="Send message..."
          onChange={handleInputChange}
          className="bg-zinc-100 w-full p-2 rounded-md"
          disabled={isLoading}
        />
      </form>
    </div>
  );
}
