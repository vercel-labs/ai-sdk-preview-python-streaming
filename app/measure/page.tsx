"use client";

import { PhotoUploader } from "@/components/photo-uploader";
import { ProcessingCard } from "@/components/processing-card";
import { ResultCard } from "@/components/result-card";
import useAuth from "@/hooks/use-auth";
import { usePhotoStore } from "@/lib/stores/photo-store";
import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

export default function MeasurePage() {
	const isAuthenticated = useAuth();
	const { photos, setPhotos } = usePhotoStore((s) => ({
		photos: s.photos,
		setPhotos: s.setPhotos,
	}));
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		const fetchPhotos = async () => {
			try {
				setIsLoading(true);
				const res = await fetch(`${API_BASE}/api/v1/photos`);
				if (res.ok) {
					const data = await res.json();
					setPhotos(data);
				}
			} catch (error) {
				console.error("Failed to fetch photos:", error);
			} finally {
				setIsLoading(false);
			}
		};

		if (isAuthenticated) {
			fetchPhotos();
		}
	}, [isAuthenticated, setPhotos]);

	if (!isAuthenticated) {
		return null;
	}

	// Separate completed photos from processing ones
	const completedPhotos = photos.filter((p) => p.status === "completed");
	const processingPhotos = photos.filter((p) => p.status !== "completed");

	return (
		<div className="container mx-auto p-4 flex flex-col gap-8 max-w-6xl">
			<section className="bg-white p-6 rounded-lg shadow-sm border">
				<h1 className="text-3xl font-bold mb-6 text-gray-800">
					Photo Measurement
				</h1>
				<PhotoUploader />
			</section>

			{isLoading ? (
				<div className="flex justify-center py-8">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
				</div>
			) : (
				<>
					{processingPhotos.length > 0 && (
						<section className="bg-white p-6 rounded-lg shadow-sm border">
							<h2 className="text-xl font-semibold mb-4 text-gray-700">
								Processing
							</h2>
							<div className="grid md:grid-cols-2 gap-4">
								{processingPhotos.map((p) => (
									<ProcessingCard key={p.id} photo={p} />
								))}
							</div>
						</section>
					)}

					{completedPhotos.length > 0 && (
						<section className="bg-white p-6 rounded-lg shadow-sm border">
							<h2 className="text-xl font-semibold mb-4 text-gray-700">
								Completed Measurements
							</h2>
							<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
								{completedPhotos.map((p) => (
									<ResultCard key={p.id} photo={p} />
								))}
							</div>
						</section>
					)}

					{photos.length === 0 && (
						<div className="text-center py-12 bg-white p-6 rounded-lg shadow-sm border">
							<p className="text-gray-500">
								No photos uploaded yet. Upload a photo to get started.
							</p>
						</div>
					)}
				</>
			)}
		</div>
	);
}
