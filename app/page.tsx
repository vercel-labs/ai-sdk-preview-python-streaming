import { Inter } from "next/font/google";
import Link from "next/link";

const inter = Inter({ subsets: ["latin"] });

const examples = [
  {
    title: "useChat",
    link: "/chat",
  },
  // {
  //   title: "useChat with tools",
  //   link: "/chat-tools",
  // },
  {
    title: "useChat with attachments",
    link: "/chat-attachments",
  },
];

export default function Home() {
  return (
    <main className={`flex flex-col gap-2 p-2 ${inter.className}`}>
      {examples.map((example, index) => (
        <Link key={example.link} className="flex flex-row" href={example.link}>
          <div className="w-8 text-zinc-400">{index + 1}.</div>
          <div className="hover:underline">{example.title}</div>
        </Link>
      ))}
    </main>
  );
}
