import "./globals.css";
import { GeistSans } from "geist/font/sans";
import { KasadaClient } from "@/utils/kasada/kasada-client";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";
import { Navbar } from "@/components/navbar";

export const metadata = {
  title: "Vercel AI SDK and FastAPI Example",
  description:
    "Example of using Vercel AI SDK in a Next.js application, powered by FastAPI.",
  openGraph: {
    images: [
      {
        url: "/og?title=Vercel AI SDK and FastAPI Example",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: [
      {
        url: "/og?title=Vercel AI SDK and FastAPI Example",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head></head>
      <body className={cn(GeistSans.className, "antialiased dark")}>
        <Toaster position="top-center" richColors />
        <KasadaClient />
        <Navbar />
        {children}
      </body>
    </html>
  );
}
