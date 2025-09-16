"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type ProcessedFile = {
  title: string;
  markdownFile: string;
  originalUpload?: string | null;
  content: string;
  size: number;
};

type ApiError = { upload: string | null; reason: string };

type ApiResponse = {
  files: ProcessedFile[];
  zipFile?: string | null;
  zipFileName?: string;
  summary?: {
    uploads: number;
    conversations: number;
    markdownFiles: number;
    processingTimeMs: number;
  };
  processedAt?: string;
  errors?: ApiError[];
};

const STORAGE_KEY = "crt-dashboard-state-v1";

const formatBytes = (size: number) => {
  if (!Number.isFinite(size) || size <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  const value = size / 1024 ** exponent;
  return `${value.toFixed(value < 10 && exponent > 0 ? 1 : 0)} ${units[exponent]}`;
};

const decodeBase64ToBlob = (base64: string, mimeType: string) => {
  if (typeof window === "undefined") {
    throw new Error("Base64 decoding is only available in the browser");
  }
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
};

export default function HomePage() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [processedFiles, setProcessedFiles] = useState<ProcessedFile[]>([]);
  const [zipFile, setZipFile] = useState<string | null>(null);
  const [zipFileName, setZipFileName] = useState<string>("chatgpt-notes.zip");
  const [processedAt, setProcessedAt] = useState<string | null>(null);
  const [summary, setSummary] = useState<ApiResponse["summary"] | null>(null);
  const [errors, setErrors] = useState<ApiError[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const cached = window.localStorage.getItem(STORAGE_KEY);
    if (!cached) return;
    try {
      const parsed = JSON.parse(cached) as ApiResponse & { zipFile: string | null };
      setProcessedFiles(parsed.files ?? []);
      setZipFile(parsed.zipFile ?? null);
      setZipFileName(parsed.zipFileName ?? "chatgpt-notes.zip");
      setSummary(parsed.summary ?? null);
      setProcessedAt(parsed.processedAt ?? null);
      setErrors(parsed.errors ?? []);
    } catch (error) {
      console.warn("Failed to parse cached dashboard state", error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload: ApiResponse & { zipFile: string | null } = {
      files: processedFiles,
      zipFile,
      zipFileName,
      summary: summary ?? undefined,
      processedAt: processedAt ?? undefined,
      errors: errors ?? undefined,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [processedFiles, zipFile, zipFileName, summary, processedAt, errors]);

  const resetState = useCallback(() => {
    setSelectedFiles([]);
    setProcessedFiles([]);
    setZipFile(null);
    setZipFileName("chatgpt-notes.zip");
    setSummary(null);
    setProcessedAt(null);
    setErrors([]);
    setMessage(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const handleFileSelection = useCallback((files: FileList | null) => {
    if (!files) return;
    const nextFiles = Array.from(files).filter((file) => file.name.toLowerCase().endsWith(".json"));
    setSelectedFiles(nextFiles);
  }, []);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setMessage(null);
      setErrors([]);

      if (selectedFiles.length === 0) {
        setMessage("Please choose at least one ChatGPT JSON export to process.");
        return;
      }

      const formData = new FormData();
      selectedFiles.forEach((file) => formData.append("files", file));

      try {
        setIsLoading(true);
        const response = await fetch("/api/process", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || `Failed to process files: ${response.status}`);
        }

        const data = (await response.json()) as ApiResponse & { zipFile: string | null };
        setProcessedFiles(data.files ?? []);
        setZipFile(data.zipFile ?? null);
        setZipFileName(data.zipFileName ?? "chatgpt-notes.zip");
        setSummary(data.summary ?? null);
        setProcessedAt(data.processedAt ?? null);
        setErrors(data.errors ?? []);
        setMessage(`Generated ${data.files?.length ?? 0} Markdown file(s).`);
      } catch (error) {
        const description = error instanceof Error ? error.message : "Unexpected error";
        setMessage(description);
      } finally {
        setIsLoading(false);
      }
    },
    [selectedFiles],
  );

  const handleDownloadMarkdown = useCallback((file: ProcessedFile) => {
    const blob = new Blob([file.content], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.markdownFile;
    anchor.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleDownloadArchive = useCallback(() => {
    if (!zipFile) return;
    const blob = decodeBase64ToBlob(zipFile, "application/zip");
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = zipFileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [zipFile, zipFileName]);

  const uploadSummary = useMemo(() => {
    const totalSize = selectedFiles.reduce((acc, file) => acc + file.size, 0);
    return {
      count: selectedFiles.length,
      totalSize: formatBytes(totalSize),
    };
  }, [selectedFiles]);

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-10 p-6 md:p-10">
      <header className="flex flex-col gap-4 rounded-3xl bg-slate-900/60 p-8 shadow-lg shadow-slate-900/40 ring-1 ring-slate-800">
        <div>
          <p className="text-xs uppercase tracking-widest text-brand">ChatGPT Restructure Tool</p>
          <h1 className="mt-2 text-3xl font-semibold md:text-4xl">Transform ChatGPT exports into production-ready Markdown notes.</h1>
        </div>
        <p className="text-sm text-slate-300 md:text-base">
          Upload the <span className="font-semibold text-brand">conversations.json</span> files from your ChatGPT data export and receive
          beautifully structured notes. The backend converts every conversation into a Problem/Solution document and bundles the results into a
          downloadable ZIP archive.
        </p>
        <div className="flex flex-wrap gap-2 text-xs text-slate-400">
          <span className="rounded-full bg-slate-800 px-3 py-1">Secure, in-memory processing</span>
          <span className="rounded-full bg-slate-800 px-3 py-1">Markdown + ZIP downloads</span>
          <span className="rounded-full bg-slate-800 px-3 py-1">Local dashboard cache</span>
        </div>
      </header>

      <section className="grid gap-6 md:grid-cols-[2fr,1fr]">
        <form
          onSubmit={handleSubmit}
          className="flex h-full flex-col gap-5 rounded-3xl bg-slate-900/60 p-6 shadow-lg shadow-slate-900/40 ring-1 ring-slate-800"
        >
          <div className="flex flex-col gap-2">
            <label htmlFor="file-upload" className="text-sm font-semibold uppercase tracking-wide text-slate-300">
              Upload ChatGPT export (.json)
            </label>
            <label
              htmlFor="file-upload"
              className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-700 bg-slate-950/50 p-8 text-center transition hover:border-brand hover:bg-slate-900"
            >
              <span className="rounded-full bg-slate-800 px-4 py-1 text-xs uppercase tracking-wide text-slate-300">Select or drop files</span>
              <p className="max-w-xs text-sm text-slate-400">
                Drag and drop your <code>conversations.json</code> files or click to choose multiple exports at once.
              </p>
              <input
                id="file-upload"
                name="files"
                type="file"
                accept="application/json"
                multiple
                className="hidden"
                onChange={(event) => handleFileSelection(event.target.files)}
              />
            </label>
            {selectedFiles.length > 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-300">
                <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-500">
                  <span>{uploadSummary.count} file(s) selected</span>
                  <span>{uploadSummary.totalSize}</span>
                </div>
                <ul className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1">
                  {selectedFiles.map((file) => (
                    <li key={file.name} className="flex items-center justify-between gap-4 truncate rounded-xl bg-slate-900/80 px-3 py-2">
                      <span className="truncate text-slate-200" title={file.name}>
                        {file.name}
                      </span>
                      <span className="text-xs text-slate-500">{formatBytes(file.size)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="rounded-2xl border border-slate-900 bg-slate-950/40 p-4 text-sm text-slate-500">
                No files selected yet. Choose the <code>conversations.json</code> file you downloaded from ChatGPT.
              </p>
            )}
          </div>

          <div className="mt-auto flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-full bg-brand px-6 py-2 text-sm font-semibold text-brand-foreground shadow-lg shadow-brand/30 transition hover:brightness-110 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              {isLoading ? "Processing…" : "Generate Markdown"}
            </button>
            <button
              type="button"
              onClick={resetState}
              className="inline-flex items-center justify-center rounded-full border border-slate-700 px-5 py-2 text-sm font-semibold text-slate-300 transition hover:border-brand hover:text-brand"
            >
              Clear cache
            </button>
            {zipFile ? (
              <button
                type="button"
                onClick={handleDownloadArchive}
                className="ml-auto inline-flex items-center justify-center rounded-full border border-brand/60 bg-slate-950/60 px-5 py-2 text-sm font-semibold text-brand transition hover:bg-slate-900"
              >
                Download ZIP
              </button>
            ) : null}
          </div>
          {message ? <p className="text-sm text-slate-300">{message}</p> : null}
          {errors && errors.length > 0 ? (
            <div className="space-y-2 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
              <p className="font-semibold">A few conversations were skipped:</p>
              <ul className="list-disc space-y-1 pl-5">
                {errors.map((error, index) => (
                  <li key={`${error.upload}-${index}`}>
                    <span className="font-medium text-red-100">{error.upload ?? "Uploaded file"}</span>: {error.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </form>

        <aside className="flex h-full flex-col gap-4 rounded-3xl bg-slate-900/60 p-6 shadow-lg shadow-slate-900/40 ring-1 ring-slate-800">
          <h2 className="text-xl font-semibold text-slate-100">Dashboard</h2>
          <dl className="grid grid-cols-2 gap-4 text-sm text-slate-300">
            <div className="rounded-2xl bg-slate-950/40 p-4">
              <dt className="text-xs uppercase tracking-wide text-slate-500">Markdown files</dt>
              <dd className="mt-1 text-2xl font-semibold text-slate-100">{processedFiles.length}</dd>
            </div>
            <div className="rounded-2xl bg-slate-950/40 p-4">
              <dt className="text-xs uppercase tracking-wide text-slate-500">Conversations</dt>
              <dd className="mt-1 text-2xl font-semibold text-slate-100">{summary?.conversations ?? 0}</dd>
            </div>
            <div className="rounded-2xl bg-slate-950/40 p-4">
              <dt className="text-xs uppercase tracking-wide text-slate-500">Processing time</dt>
              <dd className="mt-1 text-lg font-semibold text-slate-100">
                {summary ? `${(summary.processingTimeMs / 1000).toFixed(2)}s` : "–"}
              </dd>
            </div>
            <div className="rounded-2xl bg-slate-950/40 p-4">
              <dt className="text-xs uppercase tracking-wide text-slate-500">Last run</dt>
              <dd className="mt-1 text-sm text-slate-200">{processedAt ? new Date(processedAt).toLocaleString() : "–"}</dd>
            </div>
          </dl>

          <div className="mt-2 flex-1 space-y-3 overflow-y-auto pr-1">
            {processedFiles.length === 0 ? (
              <p className="rounded-2xl border border-slate-900 bg-slate-950/40 p-4 text-sm text-slate-500">
                Processed files will appear here with quick download buttons.
              </p>
            ) : (
              processedFiles.map((file) => (
                <article key={file.markdownFile} className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">{file.originalUpload ?? "Uploaded file"}</p>
                    <h3 className="truncate text-lg font-semibold text-slate-100" title={file.title}>
                      {file.title}
                    </h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    <span className="rounded-full bg-slate-900 px-3 py-1">{file.markdownFile}</span>
                    <span className="rounded-full bg-slate-900 px-3 py-1">{formatBytes(file.size)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDownloadMarkdown(file)}
                    className="inline-flex items-center justify-center rounded-full border border-brand/60 px-5 py-2 text-sm font-semibold text-brand transition hover:bg-slate-900"
                  >
                    Download Markdown
                  </button>
                </article>
              ))
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}
