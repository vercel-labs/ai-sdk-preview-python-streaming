"use client";

import type { UIMessage } from "@ai-sdk/react";
import { motion } from "framer-motion";

import { SparklesIcon } from "./icons";
import { Markdown } from "./markdown";
import { PreviewAttachment } from "./preview-attachment";
import { cn } from "@/lib/utils";
import { Weather } from "./weather";

export const PreviewMessage = ({
  message,
}: {
  chatId: string;
  message: UIMessage;
  isLoading: boolean;
}) => {
  return (
    <motion.div
      className="w-full mx-auto max-w-3xl px-4 group/message"
      initial={{ y: 5, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      data-role={message.role}
    >
      <div
        className={cn(
          "group-data-[role=user]/message:bg-primary group-data-[role=user]/message:text-primary-foreground flex gap-4 group-data-[role=user]/message:px-3 w-full group-data-[role=user]/message:w-fit group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl group-data-[role=user]/message:py-2 rounded-xl"
        )}
      >
        {message.role === "assistant" && (
          <div className="size-8 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border">
            <SparklesIcon size={14} />
          </div>
        )}

        <div className="flex flex-col gap-2 w-full">
          {message.parts &&
            message.parts.map((part: any, index: number) => {
              if (part.type === "text") {
                return (
                  <div key={index} className="flex flex-col gap-4">
                    <Markdown>{part.text}</Markdown>
                  </div>
                );
              }
              // Handle tool calls - type is "tool-{toolName}" in AI SDK v5
              if (part.type?.startsWith("tool-")) {
                const { toolCallId, state, output } = part;
                const toolName = part.type.replace("tool-", "");

                if (state === "output-available" && output) {
                  return (
                    <div key={toolCallId}>
                      {toolName === "get_current_weather" ? (
                        <Weather weatherAtLocation={output} />
                      ) : (
                        <pre>{JSON.stringify(output, null, 2)}</pre>
                      )}
                    </div>
                  );
                }
                // Show loading state while tool is executing
                if (
                  state === "input-streaming" ||
                  state === "input-available"
                ) {
                  return (
                    <div
                      key={toolCallId}
                      className={cn({
                        skeleton: ["get_current_weather"].includes(toolName),
                      })}
                    >
                      {toolName === "get_current_weather" ? <Weather /> : null}
                    </div>
                  );
                }
              }
              if (part.type === "file") {
                return (
                  <PreviewAttachment
                    key={index}
                    attachment={part}
                  />
                );
              }
              return null;
            })}
        </div>
      </div>
    </motion.div>
  );
};

export const ThinkingMessage = () => {
  const role = "assistant";

  return (
    <motion.div
      className="w-full mx-auto max-w-3xl px-4 group/message "
      initial={{ y: 5, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { delay: 1 } }}
      data-role={role}
    >
      <div
        className={cn(
          "flex gap-4 group-data-[role=user]/message:px-3 w-full group-data-[role=user]/message:w-fit group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl group-data-[role=user]/message:py-2 rounded-xl",
          {
            "group-data-[role=user]/message:bg-muted": true,
          }
        )}
      >
        <div className="size-8 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border">
          <SparklesIcon size={14} />
        </div>

        <div className="flex flex-col gap-2 w-full">
          <div className="flex flex-col gap-4 text-muted-foreground">
            Thinking...
          </div>
        </div>
      </div>
    </motion.div>
  );
};
