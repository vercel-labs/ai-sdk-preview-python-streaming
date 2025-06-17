"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const router = useRouter();

	const handleLogin = () => {
		if (password === process.env.NEXT_PUBLIC_PAGE_PASSWORD) {
			localStorage.setItem("measure-ai-session", "true");
			router.push("/measure");
		} else {
			setError("Incorrect password");
		}
	};

	return (
		<div className="flex items-center justify-center min-h-screen bg-gray-100">
			<div className="p-8 bg-white rounded-lg shadow-md w-full max-w-sm">
				<h1 className="text-2xl font-bold mb-4 text-center">Login</h1>
				<div className="space-y-4">
					<input
						type="password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						onKeyDown={(e) => e.key === "Enter" && handleLogin()}
						placeholder="Password"
						className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
					{error && <p className="text-red-500 text-sm">{error}</p>}
					<button
						onClick={handleLogin}
						className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
						disabled={!password}
					>
						Enter
					</button>
				</div>
			</div>
		</div>
	);
}
