"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, ArrowRight } from "lucide-react";
import Dialog from "@/components/ui/Dialog";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SearchResult {
  title: string;
  subtitle: string;
  href: string;
}

// ─── Suggestions (shown before typing) ───────────────────────────────────────

const SUGGESTIONS: SearchResult[] = [
  { title: "Generate a video", subtitle: "Text-to-video and image-to-video on the network", href: "/dashboard/explore" },
  { title: "Explore capabilities", subtitle: "Browse capabilities available on the network", href: "/dashboard/explore" },
  { title: "Get your API key", subtitle: "Authenticate and start sending requests", href: "/dashboard/settings?tab=tokens" },
  { title: "Transcode a stream", subtitle: "Live transcoding on GPU infrastructure", href: "/dashboard/models/frameworks-transcoding" },
];

// ─── All searchable items ────────────────────────────────────────────────────

const ALL_RESULTS: SearchResult[] = [
  ...SUGGESTIONS,
  { title: "Daydream Video API", subtitle: "Real-time AI video generation", href: "/dashboard/models/daydream-video" },
  { title: "Frameworks Transcoding", subtitle: "Adaptive bitrate transcoding", href: "/dashboard/models/frameworks-transcoding" },
  { title: "FLUX.1 [schnell]", subtitle: "Fast text-to-image generation", href: "/dashboard/models/flux-schnell" },
  { title: "SDXL Turbo", subtitle: "Real-time image generation", href: "/dashboard/models/sdxl-turbo" },
  { title: "Stable Video Diffusion", subtitle: "Image-to-video synthesis", href: "/dashboard/models/stable-video-diffusion" },
  { title: "LivePortrait", subtitle: "Real-time portrait animation", href: "/dashboard/models/live-video-to-video" },
  { title: "Qwen3 32B", subtitle: "Large language model", href: "/dashboard/models/qwen3-32b" },
  { title: "Llama 3 70B", subtitle: "Open LLM for chat and instructions", href: "/dashboard/models/llama-3-70b" },
  { title: "Whisper v3 Large", subtitle: "Speech-to-text transcription", href: "/dashboard/models/whisper-v3" },
  { title: "Kokoro TTS", subtitle: "Text-to-speech synthesis", href: "/dashboard/models/kokoro-tts" },
  { title: "Home", subtitle: "Dashboard overview", href: "/dashboard" },
  { title: "API Tokens", subtitle: "Manage your API keys", href: "/dashboard/settings?tab=tokens" },
  { title: "Billing", subtitle: "Manage billing and payments", href: "/dashboard/settings?tab=billing" },
  { title: "Usage", subtitle: "Request volume and spend", href: "/dashboard/usage" },
  { title: "Account", subtitle: "Profile and security", href: "/dashboard/settings?tab=account" },
  { title: "Settings", subtitle: "Account settings", href: "/dashboard/settings" },
];

// ─── Component ───────────────────────────────────────────────────────────────

interface DashboardSearchProps {
  /** Full-width trigger with visible placeholder text, no kbd hint. For mobile. */
  mobile?: boolean;
}

export default function DashboardSearch({ mobile = false }: DashboardSearchProps = {}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const results = query.trim() === ""
    ? SUGGESTIONS
    : ALL_RESULTS.filter((r) => {
        const q = query.toLowerCase();
        return r.title.toLowerCase().includes(q) || r.subtitle.toLowerCase().includes(q);
      });

  useEffect(() => { setHighlightedIndex(0); }, [query]);

  useEffect(() => {
    if (!listRef.current) return;
    const rows = listRef.current.querySelectorAll<HTMLElement>("[data-row]");
    rows[highlightedIndex]?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex]);

  const openDialog = useCallback(() => {
    setOpen(true);
    setQuery("");
    setHighlightedIndex(0);
  }, []);

  const closeDialog = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  const navigate = useCallback((href: string) => {
    closeDialog();
    if (href.startsWith("http")) {
      window.open(href, "_blank", "noopener,noreferrer");
    } else {
      router.push(href);
    }
  }, [closeDialog, router]);

  // Global ⌘K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const trigger = isMac ? e.metaKey : e.ctrlKey;
      if (trigger && e.key === "k") {
        e.preventDefault();
        if (open) closeDialog(); else openDialog();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, openDialog, closeDialog]);

  // Focus input when dialog opens
  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        closeDialog();
        break;
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((i) => (i + 1) % Math.max(results.length, 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((i) => (i - 1 + Math.max(results.length, 1)) % Math.max(results.length, 1));
        break;
      case "Enter": {
        e.preventDefault();
        const result = results[highlightedIndex];
        if (result) navigate(result.href);
        break;
      }
    }
  };

  return (
    <>
      {/* Trigger */}
      <button
        type="button"
        onClick={openDialog}
        aria-label="Search"
        className={
          mobile
            ? "flex h-9 w-full items-center gap-2.5 rounded-lg border border-subtle bg-zebra px-3 text-sm text-fg-label transition-colors hover:border-strong hover:bg-hover select-none"
            : "flex items-center gap-2.5 rounded-lg border border-strong bg-zebra px-3.5 py-1.5 text-sm text-fg-label transition-colors hover:border-strong hover:bg-hover select-none min-w-[200px]"
        }
      >
        <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span
          className={
            mobile
              ? "min-w-0 flex-1 truncate text-left"
              : "hidden sm:inline flex-1"
          }
        >
          {mobile ? "Search…" : "Search..."}
        </span>
        {!mobile && (
          <kbd className="ml-auto rounded border border-subtle bg-hover px-1.5 py-0.5 text-[10px] text-fg-label">
            ⌘K
          </kbd>
        )}
      </button>

      {/* Command palette dialog */}
      <Dialog open={open} onClose={closeDialog}>
        {/* Input */}
        <div className="flex items-center gap-3 px-5 py-4 sm:gap-4 sm:px-6 sm:py-5">
          <Search
            className="h-5 w-5 shrink-0 text-fg-faint"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            type="text"
            aria-label="Search"
            placeholder="Search capabilities, docs..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-base text-fg placeholder:text-fg-label outline-none"
          />
          <button
            type="button"
            onClick={closeDialog}
            aria-label="Close search"
            className="shrink-0 rounded-md border border-subtle bg-tint px-2.5 py-1 text-[11px] text-fg-muted transition-colors hover:border-strong hover:bg-pop hover:text-fg"
          >
            ESC
          </button>
        </div>

        <div className="h-px bg-tint" />

        {/* Results */}
        <div ref={listRef} className="max-h-[360px] overflow-y-auto py-3">
          {query.trim() === "" && (
            <p className="px-6 pb-2 text-[11px] font-medium tracking-widest text-fg-disabled uppercase">
              Suggestions
            </p>
          )}

          {results.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
              <p className="text-sm text-fg-disabled">
                No results for &ldquo;{query}&rdquo;
              </p>
              <p className="text-xs text-fg-disabled">
                Try a capability name or keyword
              </p>
              <Link href="/dashboard/explore" onClick={closeDialog} className="mt-1 text-xs text-green-bright/60 hover:text-fg transition-colors">
                Browse all capabilities →
              </Link>
            </div>
          ) : (
            results.map((result, i) => (
              <button
                key={`${result.href}-${result.title}`}
                type="button"
                data-row
                onClick={() => navigate(result.href)}
                onMouseEnter={() => setHighlightedIndex(i)}
                className={`flex w-full items-center gap-4 px-6 py-3.5 text-left transition-colors cursor-pointer ${
                  i === highlightedIndex ? "bg-hover" : ""
                }`}
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                  i === highlightedIndex
                    ? "border-subtle bg-tint"
                    : "border-hairline bg-zebra"
                }`}>
                  <ArrowRight className={`h-4 w-4 ${i === highlightedIndex ? "text-fg-muted" : "text-fg-disabled"}`} aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium text-fg">{result.title}</span>
                  <span className="block truncate text-sm text-fg-label">{result.subtitle}</span>
                </div>
              </button>
            ))
          )}
        </div>

        <div className="h-px bg-tint" />

        {/* Footer */}
        <div className="px-6 py-4 text-center text-xs text-fg-disabled">
          Try{" "}
          <span className="text-green-bright/60">&ldquo;text-to-video&rdquo;</span>,{" "}
          <span className="text-green-bright/60">&ldquo;live transcoding&rdquo;</span>,{" "}
          or{" "}
          <span className="text-green-bright/60">&ldquo;portrait animation&rdquo;</span>
        </div>
      </Dialog>
    </>
  );
}
