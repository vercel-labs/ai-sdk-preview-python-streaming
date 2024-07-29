import { Metadata } from "next";

export const metadata: Metadata = {
  title: "useChat with tools",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
