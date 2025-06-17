/* eslint-disable */
"use client";
// copied from prompt
import { Button } from "@/components/ui/button";
import { cn, generateUniqueId } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
	CircleAlert,
	FileText,
	Image,
	Pause,
	Play,
	Trash,
	Upload,
	X,
} from "lucide-react";
import { createContext, useContext, useEffect, useRef, useState } from "react";

interface UploadedFile {
	id: string;
	name: string;
	type: string;
	size: number;
	progress: number;
	status: "idle" | "uploading" | "processing" | "success" | "error";
	preview?: string;
	url?: string;
}

export interface FileInfo {
	id: string;
	name: string;
	size: number;
	type: string;
	file: File;
	progress: number;
	status: FileStatus;
	error?: string;
}

export enum FileStatus {
	Uploading,
	Paused,
	Completed,
	Error,
	Cancelled,
	Pending,
}

interface FileUploadContextType {
	files: FileInfo[];
	error: string | null;
	setError: (error: string | null) => void;
	maxCount?: number;
	maxSize?: number;
	accept?: string;
	multiple?: boolean;
	validateFiles: (files: File[]) => { valid: boolean; errorMessage?: string };
	onFileSelect?: (files: File[]) => void;
	onFileSelectChange?: (files: FileInfo[]) => void;
	onUpload?: () => void;
	onPause?: (fileId: string) => void;
	onResume?: (fileId: string) => void;
	onRemove?: (fileId: string) => void;
	disabled?: boolean;
}

const FileUploadContext = createContext<FileUploadContextType | undefined>(
	undefined
);

export const useFileUpload = () => {
	const context = useContext(FileUploadContext);
	if (!context) {
		throw new Error("useFileUpload must be used within a FileUploadProvider");
	}
	return context;
};

export interface FileErrorProps {
	message?: string;
	onClose?: () => void;
	className?: string;
	autoHideDuration?: number;
}

export const FileError: React.FC<FileErrorProps> = ({
	message,
	onClose,
	className,
}) => {
	const { error } = useFileUpload();
	const [isVisible, setIsVisible] = useState(true);
	const displayMessage = message || error;

	if (!displayMessage) return null;

	const handleClose = () => {
		setIsVisible(false);
		onClose?.();
	};

	return (
		<AnimatePresence>
			{isVisible && displayMessage && (
				<motion.div
					initial={{ opacity: 0, y: -10 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: -10 }}
					transition={{ duration: 0.3 }}
					className={cn(
						"flex items-center justify-between p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-md",
						className
					)}
				>
					<div className="flex items-center gap-2">
						<CircleAlert />
						<p className="text-sm">{displayMessage}</p>
					</div>
					<Button
						variant="ghost"
						size="icon"
						className="h-6 w-6 rounded-full hover:bg-destructive/20"
						onClick={handleClose}
					>
						<X />
					</Button>
				</motion.div>
			)}
		</AnimatePresence>
	);
};

export const formatFileSize = (bytes: number): string => {
	if (bytes < 1024) return bytes + " B";
	else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
	else if (bytes < 1024 * 1024 * 1024)
		return (bytes / (1024 * 1024)).toFixed(2) + " MB";
	else return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
};

export const FileTypeIcon: React.FC<{ type: string }> = ({ type }) => {
	if (type.includes("image")) {
		return <Image />;
	} else {
		return <FileText />;
	}
};

export interface FileProgressProps {
	progress?: number;
	status?: FileInfo["status"];
	fileId?: string;
	className?: string;
}

export const FileProgress: React.FC<FileProgressProps> = ({
	progress,
	status,
	fileId,
	className,
}) => {
	const { files } = useFileUpload();

	let fileStatus = status;
	let fileProgress = progress;

	if (fileId) {
		const file = files.find((f: FileInfo) => f.id === fileId);
		if (file) {
			fileStatus = file.status;
			fileProgress = file.progress;
		}
	}

	if (!fileStatus || !fileProgress || fileStatus === FileStatus.Completed)
		return null;

	return (
		<div
			className={cn(
				"w-full h-1.5 bg-muted rounded-full mt-2 overflow-hidden",
				className
			)}
		>
			<div
				className={cn(
					"h-full rounded-full",
					fileStatus === FileStatus.Error
						? "bg-destructive"
						: fileStatus === FileStatus.Paused
						? "bg-amber-500"
						: "bg-primary"
				)}
				style={{ width: `${fileProgress}%` }}
			></div>
		</div>
	);
};

export interface FileItemProps {
	file?: FileInfo;
	fileId?: string;
	onPause?: (fileId: string) => void;
	onResume?: (fileId: string) => void;
	onRemove?: (fileId: string) => void;
	className?: string;
	canResume?: boolean;
	canRemove?: boolean;
	showProgress?: boolean;
}

export const FileItem: React.FC<FileItemProps> = ({
	file: propFile,
	fileId,
	onPause = () => {},
	onResume = () => {},
	onRemove = () => {},
	className,
	canResume = false,
	canRemove = true,
	showProgress = false,
}) => {
	const { files } = useFileUpload();

	let file = propFile;
	if (!file && fileId) {
		file = files.find((f: FileInfo) => f.id === fileId);
	}

	if (!file) return null;

	return (
		<div
			className={cn(
				"flex items-center gap-3 p-3 rounded-md border bg-background shadow-sm",
				className
			)}
		>
			<div className="flex-shrink-0">
				<FileTypeIcon type={file.type} />
			</div>

			<div className="flex-1 min-w-0">
				<div className="flex flex-col">
					<p className="text-sm font-medium truncate" title={file.name}>
						{file.name}
					</p>
					<p className="text-xs text-muted-foreground">
						{formatFileSize(file.size)}
						{file.status === FileStatus.Error && (
							<span className="text-destructive ml-2">
								{file.error || "File to upload"}
							</span>
						)}
					</p>
				</div>

				{showProgress && (
					<FileProgress progress={file.progress} status={file.status} />
				)}
			</div>

			{canResume && (
				<div className="flex-shrink-0 flex items-center gap-1">
					{file.status === FileStatus.Uploading && (
						<Button
							size="icon"
							variant="ghost"
							className="h-8 w-8"
							onClick={() => onPause(file!.id)}
						>
							<Pause />
						</Button>
					)}
					{file.status === FileStatus.Paused && (
						<Button
							size="icon"
							variant="ghost"
							className="h-8 w-8"
							onClick={() => onResume(file!.id)}
						>
							<Play />
						</Button>
					)}
				</div>
			)}
			{canRemove && (
				<Button
					size="icon"
					variant="ghost"
					className="h-8 w-8 text-destructive hover:text-destructive"
					onClick={() => onRemove(file?.id || "")}
				>
					<Trash />
				</Button>
			)}
		</div>
	);
};

export interface FileListProps {
	files?: FileInfo[];
	onPause?: (fileId: string) => void;
	onResume?: (fileId: string) => void;
	onRemove?: (fileId: string) => void;
	onClear?: () => void;
	showUploadButton?: boolean;
	onUpload?: () => void;
	className?: string;
	canResume?: boolean;
	canRemove?: boolean;
	showProgress?: boolean;
}

export const FileList: React.FC<FileListProps> = ({
	files: propFiles,
	onPause,
	onResume,
	onRemove,
	onClear = () => {},
	showUploadButton = false,
	className,
	canResume,
	canRemove,
	showProgress = false,
}) => {
	const { files: contextFiles, onUpload = () => {} } = useFileUpload();

	const files = propFiles || contextFiles;

	if (files.length === 0) return null;

	const handlePause = (fileId: string) => {
		const file = files.find((f: FileInfo) => f.id === fileId);
		if (file) {
			file.status = FileStatus.Paused;
			onPause?.(fileId);
		}
	};

	const handleResume = (fileId: string) => {
		const file = files.find((f: FileInfo) => f.id === fileId);
		if (file) {
			file.status = FileStatus.Uploading;
			onResume?.(fileId);
		}
	};

	return (
		<div className={cn("space-y-4", className)}>
			<div className="flex items-center justify-between">
				<h3 className="text-sm font-medium">File List</h3>
				<div className="flex gap-2">
					{showUploadButton &&
						files.some((file) => file.status === FileStatus.Pending) &&
						onUpload && (
							<Button size="sm" onClick={onUpload}>
								Satrt Upload
							</Button>
						)}
					<Button size="sm" variant="outline" onClick={onClear}>
						Clear All
					</Button>
				</div>
			</div>

			<div className="space-y-2 max-h-[300px] overflow-y-auto">
				{files.map((file) => (
					<FileItem
						key={file.id}
						file={file}
						onPause={handlePause}
						onResume={handleResume}
						onRemove={onRemove}
						canResume={canResume}
						canRemove={canRemove}
						showProgress={showProgress}
					/>
				))}
			</div>
		</div>
	);
};

export interface DropZoneProps {
	onFileSelect?: (files: File[]) => void;
	prompt?: string;
	maxSize?: number;
	maxCount?: number;
	multiple?: boolean;
	accept?: string;
	className?: string;
	onError?: (message: string) => void;
}

export const DropZone: React.FC<DropZoneProps> = ({
	onFileSelect: propOnFileSelect,
	prompt = "click or drop to upload file",
	maxSize: propMaxSize,
	multiple: propMultiple,
	accept: propAccept,
	className,
	onError: propOnError,
}) => {
	const {
		disabled,
		files: contextFiles,
		maxSize: contextMaxSize,
		multiple: contextMultiple,
		accept: contextAccept,
		setError: contextSetError,
		onFileSelect: contextOnFileSelect,
		onFileSelectChange: contextOnFileSelectChange,
		validateFiles: contextValidateFiles,
	} = useFileUpload();

	const maxSize = propMaxSize || contextMaxSize;
	const multiple = propMultiple !== undefined ? propMultiple : contextMultiple;
	const accept = propAccept || contextAccept;
	const onFileSelect = propOnFileSelect || contextOnFileSelect;
	const onError = propOnError || contextSetError;

	const [isDragging, setIsDragging] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (fileInputRef.current && contextFiles.length === 0) {
			fileInputRef.current.value = "";
		}
	}, [contextFiles]);

	const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(true);
	};

	const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(false);
	};

	const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		e.stopPropagation();
	};

	const getFileInfos = (files: File[]) => {
		return files.map((file) => ({
			id: generateUniqueId(btoa(encodeURIComponent(file.name))),
			name: file.name,
			size: file.size,
			type: file.type,
			progress: 0,
			file: file,
			status: FileStatus.Pending,
		}));
	};

	const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(false);

		if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
			const droppedFiles = Array.from(e.dataTransfer.files);
			const validation = contextValidateFiles(droppedFiles);

			if (!validation.valid) {
				if (onError && validation.errorMessage) {
					onError(validation.errorMessage);
				}
				return;
			}

			onFileSelect?.(droppedFiles);

			contextOnFileSelectChange?.(getFileInfos(droppedFiles));
		}
	};

	const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (e.target.files && e.target.files.length > 0) {
			const selectedFiles = Array.from(e.target.files);
			const validation = contextValidateFiles(selectedFiles);

			if (!validation.valid) {
				if (onError && validation.errorMessage) {
					onError(validation.errorMessage);
				}
				return;
			}

			onFileSelect?.(selectedFiles);

			contextOnFileSelectChange?.(getFileInfos(selectedFiles));
		}
	};

	return (
		<div
			className={cn(
				"border-2 border-dashed rounded-md p-6 text-center cursor-pointer transition-colors",
				isDragging
					? "border-primary bg-primary/5"
					: "border-muted-foreground/25 hover:border-primary/50",
				"flex flex-col items-center justify-center gap-2",
				className
			)}
			onClick={() => fileInputRef.current?.click()}
			onDragEnter={handleDragEnter}
			onDragLeave={handleDragLeave}
			onDragOver={handleDragOver}
			onDrop={handleDrop}
		>
			<Upload />
			<p className="text-sm text-muted-foreground">{prompt}</p>
			{maxSize && (
				<p className="text-xs text-muted-foreground">
					file max can't exceed {maxSize}MB
				</p>
			)}
			<input
				type="file"
				ref={fileInputRef}
				className="hidden"
				multiple={multiple}
				accept={accept}
				onChange={handleFileInputChange}
				disabled={disabled}
				aria-label="file-upload"
			/>
		</div>
	);
};

export interface FileUploadProviderProps {
	children: React.ReactNode;
	files?: FileInfo[];
	showUploadButton?: boolean;
	multiple?: boolean;
	accept?: string;
	maxCount?: number;
	maxSize?: number;
	onFileSelect?: (files: File[]) => void;
	onFileSelectChange?: (files: FileInfo[]) => void;
	onUpload?: () => void;
	onPause?: (fileId: string) => void;
	onResume?: (fileId: string) => void;
	onRemove?: (fileId: string) => void;
	disabled?: boolean;
}

export const FileUploadProvider: React.FC<FileUploadProviderProps> = ({
	children,
	files = [],
	multiple = false,
	accept,
	maxCount = 1,
	maxSize = 1,
	onFileSelect,
	onFileSelectChange,
	onUpload,
	onPause,
	onResume,
	onRemove,
	disabled = false,
}) => {
	const [error, setError] = useState<string | null>(null);

	const validateFiles = (
		files: File[]
	): { valid: boolean; errorMessage?: string } => {
		if (maxCount && files.length > maxCount) {
			return {
				valid: false,
				errorMessage: `can upload maxinum ${maxCount} files`,
			};
		}

		if (maxSize) {
			const oversizedFiles = files.filter(
				(file) => file.size > maxSize * 1024 * 1024
			);
			if (oversizedFiles.length > 0) {
				const fileNames = oversizedFiles.map((f) => f.name).join(", ");
				return {
					valid: false,
					errorMessage: `file size exceed limit (${maxSize}MB): ${fileNames}`,
				};
			}
		}

		if (accept) {
			const acceptedTypes = accept.split(",").map((type) => type.trim());
			const invalidFiles = files.filter((file) => {
				const fileExt = "." + file.name.split(".").pop()?.toLowerCase();
				// check MIME type
				return !acceptedTypes.some(
					(type) =>
						type === fileExt ||
						type === file.type ||
						(type.includes("/*") &&
							file.type.startsWith(type.replace("/*", "/")))
				);
			});

			if (invalidFiles.length > 0) {
				const fileNames = invalidFiles.map((f) => f.name).join(", ");
				return {
					valid: false,
					errorMessage: `file type can't support: ${fileNames}`,
				};
			}
		}

		return { valid: true };
	};

	return (
		<FileUploadContext.Provider
			value={{
				files,
				error,
				setError,
				maxCount,
				maxSize,
				accept,
				multiple,
				validateFiles,
				onFileSelect,
				onFileSelectChange,
				onUpload,
				onPause,
				onResume,
				onRemove,
				disabled,
			}}
		>
			{children}
		</FileUploadContext.Provider>
	);
};

export interface FileUploadProps extends FileUploadProviderProps {
	className?: string;
}

const FileUpload: React.FC<FileUploadProps> = ({
	className,
	children,
	disabled,
	...providerProps
}) => {
	return (
		<FileUploadProvider {...providerProps} disabled={disabled}>
			<div
				className={cn(
					"flex flex-col flex-1 space-y-4",
					className,
					disabled && "opacity-50 cursor-not-allowed"
				)}
			>
				{children}
			</div>
		</FileUploadProvider>
	);
};

export default FileUpload;
