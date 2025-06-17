import { Navbar } from "@/components/navbar";
import { cn } from "@/lib/utils";
// @ts-ignore
import "./globals.css";
// @ts-ignore
import { GeistSans } from "geist/font/sans";
// @ts-ignore
import { Toaster } from "sonner";

export const metadata = {
	title: "AI SDK Python Streaming Preview",
	description:
		"Use the Data Stream Protocol to stream chat completions from a Python endpoint (FastAPI) and display them using the useChat hook in your Next.js application.",
	openGraph: {
		images: [
			{
				url: "/og?title=AI SDK Python Streaming Preview",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		images: [
			{
				url: "/og?title=AI SDK Python Streaming Preview",
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
			<body className={cn(GeistSans.className, "antialiased")}>
				<Toaster position="top-center" richColors />
				<Navbar />
				{children}
			</body>
		</html>
	);
}
