"use client";

import { useCallback, useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import CostTag from "@/components/dashboard/CostTag";
import type { PlaygroundConfig } from "@/lib/dashboard/types";

interface JsonInputProps {
  config: PlaygroundConfig;
  onRun: (values: Record<string, unknown>) => void;
  isRunning: boolean;
}

export default function JsonInput({ config, onRun, isRunning }: JsonInputProps) {
  const defaultJson = useMemo(() => {
    const defaults: Record<string, unknown> = {};
    config.fields.forEach((f) => {
      if (f.defaultValue !== undefined) defaults[f.name] = f.defaultValue;
    });
    return JSON.stringify(defaults, null, 2);
  }, [config.fields]);

  const [text, setText] = useState(defaultJson);
  const [error, setError] = useState<string | null>(null);

  const handleReset = () => {
    setText(defaultJson);
    setError(null);
  };

  const handleRun = useCallback(() => {
    try {
      const parsed = text.trim() ? JSON.parse(text) : {};
      setError(null);
      onRun(parsed as Record<string, unknown>);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid JSON");
    }
  }, [text, onRun]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleRun();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      <div className="pb-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          rows={16}
          className="w-full resize-y rounded-md border border-subtle bg-zebra px-4 py-3 font-mono text-xs leading-relaxed text-fg-strong placeholder:text-fg-label focus:border-strong focus:bg-hover focus:outline-none"
        />
        {error && (
          <p className="mt-2 text-[11px] text-red-400">{error}</p>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-hairline pt-4">
        <button
          type="button"
          onClick={handleReset}
          className="flex items-center gap-1.5 rounded-lg border border-subtle px-3 py-2 text-xs text-fg-label transition-colors hover:bg-hover hover:text-fg-muted focus:outline-none"
        >
          <RotateCcw className="h-3 w-3" />
          Reset to defaults
        </button>
        <button
          type="submit"
          disabled={isRunning}
          className="btn-primary flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors active:scale-[0.98] disabled:bg-tint disabled:text-fg-disabled focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-bright/50 motion-reduce:active:scale-100"
        >
          {isRunning ? (
            <>
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-strong border-t-white" />
              Running...
            </>
          ) : (
            "Run"
          )}
        </button>
        <CostTag mode="free" />
        <span className="ml-auto text-[10px] text-fg-label">ctrl+enter</span>
      </div>
    </form>
  );
}
