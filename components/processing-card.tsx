"use client";

import Image from "next/image";
import React from "react";
import { PhotoItem } from "../lib/stores/photo-store";

export const ProcessingCard: React.FC<{ photo: PhotoItem }> = ({ photo }) => {
	return (
		<div className="bg-white rounded-lg overflow-hidden shadow-md border hover:shadow-lg transition-shadow duration-300">
			<div className="relative">
				<Image
					src={photo.fileUrl}
					alt="Processing"
					className="w-full h-48 object-cover opacity-80"
					width={300}
					height={200}
				/>
				<div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
					<span className="text-white text-xs font-medium">ID: {photo.id}</span>
				</div>
			</div>

			<div className="p-4">
				<div className="flex items-center justify-center py-6">
					{photo.status === "failed" ? (
						<div className="text-center">
							<div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mb-3">
								<svg
									className="w-6 h-6 text-red-600"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
									xmlns="http://www.w3.org/2000/svg"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M6 18L18 6M6 6l12 12"
									/>
								</svg>
							</div>
							<p className="text-red-600 font-medium">Processing Failed</p>
							{photo.error && (
								<p className="text-sm text-gray-500 mt-1">{photo.error}</p>
							)}
						</div>
					) : (
						<div className="text-center">
							<div className="inline-flex items-center justify-center mb-3">
								<div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
							</div>
							<p className="text-blue-600 font-medium">Processing...</p>
							<p className="text-sm text-gray-500 mt-1">
								This may take a few moments
							</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};
