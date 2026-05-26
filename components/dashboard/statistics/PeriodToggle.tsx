"use client";

interface PeriodOption<T extends string> {
  key: T;
  label: string;
}

/**
 * PeriodToggle — segmented control aligned with the rest of the dashboard's
 * view-toggle vocabulary (`h-[26px] rounded-[4px] border-hairline bg-dark-lighter`).
 * Active option uses `bg-pop` + `text-fg`; inactive options sit muted with
 * a hover bump.
 */
export default function PeriodToggle<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (p: T) => void;
  options: PeriodOption<T>[];
}) {
  return (
    <div
      className="flex h-[26px] items-center rounded-[4px] border border-hairline bg-dark-lighter p-0.5"
      role="tablist"
    >
      {options.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={value === key}
          onClick={() => onChange(key)}
          className={`flex h-5 items-center rounded-[3px] px-2 text-[11.5px] font-medium transition-colors ${
            value === key
              ? "bg-pop text-fg"
              : "text-fg-faint hover:text-fg-strong"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
