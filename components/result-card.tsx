"use client";

import Image from "next/image";
import React from "react";
import { PhotoItem } from "../lib/stores/photo-store";

export const ResultCard: React.FC<{ photo: PhotoItem }> = ({ photo }) => {
	if (!photo.measurements || photo.measurements.length === 0) {
		return null;
	}
	const measurement = photo.measurements[0];

	// Calculate confidence class based on confidence value
	const confidenceValue = (measurement.confidence ?? 0) * 100;
	const confidenceClass =
		confidenceValue >= 90
			? "text-green-600"
			: confidenceValue >= 70
			? "text-yellow-600"
			: "text-red-600";

	return (
		<div className="bg-white rounded-lg overflow-hidden shadow-md border hover:shadow-lg transition-shadow duration-300">
			<div className="relative">
				<Image
					src={photo.fileUrl}
					alt="Measurement"
					className="w-full h-48 object-cover"
					width={300}
					height={200}
				/>
				<div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
					<span className="text-white text-xs font-medium">ID: {photo.id}</span>
				</div>
			</div>

			<div className="p-4">
				<h3 className="font-semibold text-lg text-gray-800 mb-2">
					Measurements
				</h3>

				<div className="grid grid-cols-2 gap-2 mb-4">
					<div className="bg-gray-50 p-3 rounded-md">
						<div className="text-xs text-gray-500 mb-1">Length</div>
						<div className="text-lg font-medium">
							{measurement.length?.toFixed(2)} cm
						</div>
					</div>
					<div className="bg-gray-50 p-3 rounded-md">
						<div className="text-xs text-gray-500 mb-1">Width</div>
						<div className="text-lg font-medium">
							{measurement.width?.toFixed(2)} cm
						</div>
					</div>
					<div className="bg-gray-50 p-3 rounded-md">
						<div className="text-xs text-gray-500 mb-1">Area</div>
						<div className="text-lg font-medium">
							{measurement.area?.toFixed(2)} cm²
						</div>
					</div>
					<div className="bg-gray-50 p-3 rounded-md">
						<div className="text-xs text-gray-500 mb-1">Confidence</div>
						<div className={`text-lg font-medium ${confidenceClass}`}>
							{confidenceValue.toFixed(1)}%
						</div>
					</div>
				</div>

				<div className="text-xs text-gray-500">
					Measured on {new Date(measurement.created_at).toLocaleString()}
				</div>
			</div>
		</div>
	);
};
