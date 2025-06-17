"use client";

import FileUpload, {
	DropZone,
	FileError,
	FileInfo,
	FileList,
	FileStatus,
} from "@/components/ui/file-upload";
import { usePhotoStore } from "@/lib/stores/photo-store";
import React, { useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

export const PhotoUploader: React.FC = () => {
	const [uploadFiles, setUploadFiles] = useState<FileInfo[]>([]);
	const addPhoto = usePhotoStore((s) => s.addPhoto);
	const updateStatus = usePhotoStore((s) => s.updateStatus);
	const setMeasurements = usePhotoStore((s) => s.setMeasurements);

	const handleFileSelectChange = (files: FileInfo[]) => {
		setUploadFiles(files);
	};

	const handleUpload = async () => {
		if (uploadFiles.length === 0) return;

		const fileToUpload = uploadFiles[0];
		const fileId = fileToUpload.id;

		// Update the file status to uploading
		const updatedFiles = uploadFiles.map((file) =>
			file.id === fileId ? { ...file, status: FileStatus.Uploading } : file
		);
		setUploadFiles(updatedFiles);

		// Create FormData
		const formData = new FormData();
		formData.append("file", fileToUpload.file);

		// Use XMLHttpRequest for progress tracking
		const xhr = new XMLHttpRequest();

		xhr.upload.addEventListener("progress", (event) => {
			if (event.lengthComputable) {
				const progress = Math.round((event.loaded / event.total) * 100);

				// Update progress in the file list
				const progressUpdatedFiles = uploadFiles.map((file) =>
					file.id === fileId ? { ...file, progress } : file
				);
				setUploadFiles(progressUpdatedFiles);
			}
		});

		xhr.addEventListener("load", async () => {
			if (xhr.status >= 200 && xhr.status < 300) {
				// Success
				const photo = JSON.parse(xhr.responseText);

				// Add to store
				addPhoto({
					id: photo.id,
					fileUrl: photo.file_url,
					status: photo.status,
				});

				// Clear the upload file after successful upload
				setUploadFiles([]);

				// Start polling for status updates
				const pollInterval = setInterval(async () => {
					try {
						const response = await fetch(
							`${API_BASE}/api/v1/photos/${photo.id}`
						);
						if (response.ok) {
							const updatedPhoto = await response.json();

							// Update status
							updateStatus(
								photo.id,
								updatedPhoto.status,
								updatedPhoto.error_message
							);

							// If completed, fetch measurements
							if (
								updatedPhoto.status === "completed" &&
								updatedPhoto.measurements
							) {
								setMeasurements(photo.id, updatedPhoto.measurements);
								clearInterval(pollInterval);
							}

							// If failed, stop polling
							if (updatedPhoto.status === "failed") {
								clearInterval(pollInterval);
							}
						}
					} catch (error) {
						console.error("Error polling for photo status:", error);
					}
				}, 2000); // Poll every 2 seconds

				// Stop polling after 5 minutes (300 seconds) to prevent indefinite polling
				setTimeout(() => {
					clearInterval(pollInterval);
				}, 300000);
			} else {
				// Error
				let errorMessage = "Upload failed";
				try {
					const errorData = JSON.parse(xhr.responseText);
					errorMessage = errorData.detail || errorMessage;
				} catch (e) {
					// If parsing fails, use default message
				}

				const errorUpdatedFiles = uploadFiles.map((file) =>
					file.id === fileId
						? {
								...file,
								status: FileStatus.Error,
								error: errorMessage,
						  }
						: file
				);
				setUploadFiles(errorUpdatedFiles);
			}
		});

		xhr.addEventListener("error", () => {
			const errorUpdatedFiles = uploadFiles.map((file) =>
				file.id === fileId
					? {
							...file,
							status: FileStatus.Error,
							error: "Network error occurred",
					  }
					: file
			);
			setUploadFiles(errorUpdatedFiles);
		});

		// Open and send the request
		xhr.open("POST", `${API_BASE}/api/v1/photos`);
		xhr.send(formData);
	};

	const onRemove = (fileId: string) => {
		setUploadFiles(uploadFiles.filter((file) => file.id !== fileId));
	};

	const onClear = () => {
		setUploadFiles([]);
	};

	return (
		<FileUpload
			files={uploadFiles}
			onFileSelectChange={handleFileSelectChange}
			onUpload={handleUpload}
			onRemove={onRemove}
			multiple={false}
			accept="image/*"
			maxSize={10} // Max 10MB
			maxCount={1}
			className="mt-2"
			disabled={uploadFiles.some((f) => f.status === FileStatus.Uploading)}
		>
			<div className="space-y-4">
				<DropZone prompt="Click or drop image file" />
				<FileError />
				<FileList
					showUploadButton={true}
					onClear={onClear}
					onRemove={onRemove}
					showProgress={true}
				/>
			</div>
		</FileUpload>
	);
};
