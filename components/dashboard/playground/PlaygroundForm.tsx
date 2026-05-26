"use client";

import { useState, useCallback } from "react";
import { RotateCcw } from "lucide-react";
import Select from "@/components/ui/Select";
import CostTag from "@/components/dashboard/CostTag";
import type { PlaygroundConfig, PlaygroundField } from "@/lib/dashboard/types";

interface PlaygroundFormProps {
  config: PlaygroundConfig;
  onRun: (values: Record<string, unknown>) => void;
  isRunning: boolean;
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span className="ml-1.5 rounded bg-tint px-1.5 py-0.5 text-[10px] text-fg-faint">
      {type}
    </span>
  );
}

function RequiredBadge() {
  return (
    <span className="ml-1 text-[10px] font-medium text-red-400">*</span>
  );
}

function FieldRenderer({
  field,
  value,
  onChange,
}: {
  field: PlaygroundField;
  value: unknown;
  onChange: (val: unknown) => void;
}) {
  const inputClass =
    "w-full rounded-lg border border-subtle bg-zebra px-3 py-2.5 text-sm text-fg placeholder:text-fg-label focus:outline-none focus:border-strong transition-colors";

  switch (field.type) {
    case "textarea":
      return (
        <textarea
          id={`field-${field.name}`}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={4}
          aria-required={field.required}
          className={`${inputClass} resize-y min-h-[80px]`}
        />
      );

    case "text":
      return (
        <input
          id={`field-${field.name}`}
          type="text"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          aria-required={field.required}
          className={inputClass}
        />
      );

    case "number":
      return (
        <input
          id={`field-${field.name}`}
          type="number"
          value={value !== undefined && value !== "" ? (value as number) : ""}
          onChange={(e) =>
            onChange(e.target.value === "" ? "" : Number(e.target.value))
          }
          placeholder={field.placeholder}
          min={field.min}
          max={field.max}
          step={field.step}
          aria-required={field.required}
          className={inputClass}
        />
      );

    case "range": {
      const numVal =
        value !== undefined ? (value as number) : (field.defaultValue as number) ?? field.min ?? 0;
      return (
        <div className="flex items-center gap-3">
          <input
            id={`field-${field.name}`}
            type="range"
            value={numVal}
            onChange={(e) => onChange(Number(e.target.value))}
            min={field.min ?? 0}
            max={field.max ?? 1}
            step={field.step ?? 0.01}
            required={field.required}
            className="flex-1 accent-green-bright"
          />
          <span className="w-12 text-right text-xs text-fg-faint">
            {numVal}
          </span>
        </div>
      );
    }

    case "select":
      return (
        <Select
          id={`field-${field.name}`}
          value={(value as string) ?? (field.defaultValue as string) ?? ""}
          options={(field.options ?? []).map((o) => ({ value: o, label: o }))}
          onChange={(val) => onChange(val)}
          required={field.required}
        />
      );

    case "boolean":
      return (
        <label htmlFor={`field-${field.name}`} className="flex items-center gap-2.5 cursor-pointer">
          <input
            id={`field-${field.name}`}
            type="checkbox"
            checked={(value as boolean) ?? (field.defaultValue as boolean) ?? false}
            onChange={(e) => onChange(e.target.checked)}
            aria-required={field.required}
            className="h-4 w-4 rounded border-strong bg-zebra accent-green-bright"
          />
          <span className="text-sm text-fg-faint">Enabled</span>
        </label>
      );

    case "file":
      return (
        <div className="relative">
          <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-subtle bg-zebra py-6 transition-colors hover:border-strong hover:bg-hover">
            <label className="cursor-pointer text-center">
              <p className="text-sm text-fg-label">
                {value ? (value as File).name : "Drop a file or click to upload"}
              </p>
              <p className="mt-1 text-[11px] text-fg-label">
                {field.description || "Supports common file formats"}
              </p>
              <input
                id={`field-${field.name}`}
                type="file"
                className="hidden"
                accept="image/*,audio/*,video/*"
                aria-required={field.required}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onChange(file);
                }}
              />
            </label>
          </div>
        </div>
      );

    default:
      return null;
  }
}

export default function PlaygroundForm({
  config,
  onRun,
  isRunning,
}: PlaygroundFormProps) {
  const getDefaults = useCallback(() => {
    const defaults: Record<string, unknown> = {};
    config.fields.forEach((f) => {
      if (f.defaultValue !== undefined) defaults[f.name] = f.defaultValue;
    });
    return defaults;
  }, [config.fields]);

  const [values, setValues] = useState<Record<string, unknown>>(getDefaults);

  const handleChange = (name: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleReset = () => {
    setValues(getDefaults());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onRun(values);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      <div className="space-y-5 pb-4">
        {config.fields.map((field) => (
          <div key={field.name}>
            <div className="mb-1.5 flex items-center">
              <label htmlFor={`field-${field.name}`} className="text-xs font-medium text-fg-faint">
                {field.label}
              </label>
              {field.required && <RequiredBadge />}
              <TypeBadge type={field.type === "textarea" ? "string" : field.type} />
            </div>
            <FieldRenderer
              field={field}
              value={values[field.name]}
              onChange={(val) => handleChange(field.name, val)}
            />
            {field.description && field.type !== "file" && (
              <p className="mt-1 text-[11px] text-fg-label">
                {field.description}
                {field.defaultValue !== undefined && (
                  <span>
                    {" "}
                    Default: {String(field.defaultValue)}
                  </span>
                )}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 border-t border-hairline pt-4">
        <button
          type="button"
          onClick={handleReset}
          className="flex h-11 items-center gap-1.5 rounded-lg border border-subtle px-3 text-xs text-fg-label transition-colors hover:bg-hover hover:text-fg-muted focus:outline-none sm:h-9"
        >
          <RotateCcw className="h-3 w-3" />
          Reset to defaults
        </button>
        <button
          type="submit"
          disabled={isRunning}
          className="btn-primary flex h-11 min-w-[120px] items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors active:scale-[0.98] disabled:bg-tint disabled:text-fg-disabled focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-bright/50 motion-reduce:active:scale-100 sm:h-9"
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
        <span className="ml-auto hidden text-[10px] text-fg-label sm:inline">ctrl+enter</span>
      </div>
    </form>
  );
}
