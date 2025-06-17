"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const useAuth = () => {
	const [isAuthenticated, setIsAuthenticated] = useState(false);
	const router = useRouter();

	useEffect(() => {
		const session = localStorage.getItem("measure-ai-session");
		if (session === "true") {
			setIsAuthenticated(true);
		} else {
			router.push("/login");
		}
	}, [router]);

	return isAuthenticated;
};

export default useAuth;
