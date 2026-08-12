import { getEnvironmentById } from "@/lib/console/mock-data";

/**
 * EnvTag — the per-row environment facet (colored dot + name). With no global
 * environment switcher, env-scoped lists show all environments by default and
 * mark each row with this tag so the environment is legible in place.
 */
export default function EnvTag({ environmentId }: { environmentId: string }) {
  const env = getEnvironmentById(environmentId);
  if (!env) return null;
  const color =
    env.kind === "production"
      ? "var(--color-green-bright)"
      : "var(--color-blue-bright)";
  return (
    <span
      className="shrink-0 inline-flex items-center gap-1 rounded-full border border-hairline px-1.5 py-px text-[10.5px] text-fg-faint"
      title={`${env.name} environment`}
    >
      <span
        className="h-[4px] w-[4px] rounded-full"
        style={{ background: color }}
        aria-hidden="true"
      />
      {env.name}
    </span>
  );
}
