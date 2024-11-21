import { motion } from "framer-motion";
import Link from "next/link";

import { MessageIcon } from "./icons";
import { LogoPython } from "@/app/icons";

export const Overview = () => {
  return (
    <motion.div
      key="overview"
      className="max-w-3xl mx-auto md:mt-20"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ delay: 0.5 }}
    >
      <div className="rounded-xl p-6 flex flex-col gap-8 leading-relaxed text-center max-w-xl">
        <p className="flex flex-row justify-center gap-4 items-center">
          <LogoPython size={32} />
          <span>+</span>
          <MessageIcon size={32} />
        </p>
        <p>
          This is an{" "}
          <Link
            className="font-medium underline underline-offset-4"
            href="https://github.com/vercel-labs/ai-sdk-preview-python-streaming"
            target="_blank"
          >
            open source
          </Link>{" "}
          template that demonstrates the usage of{" "}
          <Link
            className="font-medium underline underline-offset-4"
            href="https://sdk.vercel.ai/docs/ai-sdk-ui/stream-protocol#data-stream-protocol"
            target="_blank"
          >
            Data Stream Protocol
          </Link>{" "}
          to stream chat completions from a Python function (
          <Link
            className="font-medium underline underline-offset-4"
            href="https://fastapi.tiangolo.com"
            target="_blank"
          >
            FastAPI
          </Link>
          ) along with the
          <code className="rounded-md bg-muted px-1 py-0.5">useChat</code> hook
          on the client to create a seamless chat experience.
        </p>
        <p>
          You can learn more about the AI SDK by visiting the{" "}
          <Link
            className="font-medium underline underline-offset-4"
            href="https://sdk.vercel.ai/docs"
            target="_blank"
          >
            docs
          </Link>
          .
        </p>
      </div>
    </motion.div>
  );
};
