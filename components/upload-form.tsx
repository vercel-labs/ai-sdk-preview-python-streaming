"use client";

import React, { useRef, useState } from "react";
import { usePhotoStore } from "../lib/stores/photo-store";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

export const UploadForm: React.FC = () => {
	const inputRef = useRef<HTMLInputElement | null>(null);
	const [file, setFile] = useState<File | null>(null);
	const addPhoto = usePhotoStore((s) => s.addPhoto);
	const updateStatus = usePhotoStore((s) => s.updateStatus);
	const setMeasurements = usePhotoStore((s) => s.setMeasurements);

	const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (e.target.files && e.target.files[0]) {
			setFile(e.target.files[0]);
		}
	};

	const handleUpload = async () => {
		if (!file) return;
		const form = new FormData();
		form.append("file", file);

		const res = await fetch(`${API_BASE}/api/v1/photos`, {
			method: "POST",
			body: form,
		});

		if (!res.ok) {
			alert("Upload failed");
			return;
		}

		const photo = await res.json();
		addPhoto({
			id: photo.id,
			fileUrl: photo.file_url,
			status: "pending",
		});

		// Start processing
		await fetch(`${API_BASE}/api/v1/photos/${photo.id}/process`, {
			method: "POST",
		});

		updateStatus(photo.id, "processing");

		// Open WebSocket for updates
		const ws = new WebSocket(
			`${API_BASE.replace("http", "ws")}/api/v1/ws/photos/${photo.id}`
		);

		ws.onmessage = async (evt) => {
			const data = JSON.parse(evt.data);
			if (data.status === "completed") {
				updateStatus(photo.id, "completed");
				const mRes = await fetch(
					`${API_BASE}/api/v1/photos/${photo.id}/measurements`
				);
				if (mRes.ok) {
					setMeasurements(photo.id, await mRes.json());
				}
				ws.close();
			} else if (data.status === "failed") {
				updateStatus(photo.id, "failed", data.error);
				ws.close();
			}
		};
	};

	return (
		<div className="flex flex-col gap-4">
			<label
				className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100"
				onDragOver={(e) => e.preventDefault()}
				onDrop={(e) => {
					e.preventDefault();
					if (e.dataTransfer.files && e.dataTransfer.files[0]) {
						setFile(e.dataTransfer.files[0]);
					}
				}}
			>
				<div className="flex flex-col items-center justify-center pt-5 pb-6">
					<svg
						className="w-8 h-8 mb-3 text-gray-400"
						aria-hidden="true"
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 20 16"
					>
						<path
							stroke="currentColor"
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth="2"
							d="M17 13V8.5A5.5 5.5 0 0 0 6 8.5V13m11 0H3m14 0v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2m0 0V8.5m0 0A5.5 5.5 0 0 1 14 8.5"
						/>
					</svg>
					<p className="mb-2 text-sm text-gray-500">
						<span className="font-semibold">Click to upload</span> or drag and
						drop
					</p>
					<p className="text-xs text-gray-500">PNG, JPG or BMP</p>
				</div>
				<input
					ref={inputRef}
					type="file"
					accept="image/*"
					className="hidden"
					aria-label="Upload image"
					onChange={handleSelect}
				/>
			</label>
			<button
				className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
				disabled={!file}
				onClick={handleUpload}
			>
				{file ? `Upload ${file.name}` : "Select file first"}
			</button>
		</div>
	);
};
