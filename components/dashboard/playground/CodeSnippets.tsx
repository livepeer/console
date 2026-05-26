"use client";

import { useEffect, useMemo, useState } from "react";
import CopyButton from "@/components/dashboard/CopyButton";
import { useAuth } from "@/components/dashboard/AuthContext";
import { STARTER_API_KEY } from "@/lib/dashboard/mock-data";
import type { Model } from "@/lib/dashboard/types";

type Lang = "curl" | "python" | "node" | "http";

const LANGS: { key: Lang; label: string }[] = [
  { key: "curl", label: "cURL" },
  { key: "python", label: "Python" },
  { key: "node", label: "Node.js" },
  { key: "http", label: "HTTP" },
];

const PLACEHOLDER_TOKEN = "YOUR_API_KEY";

// Mock-only: a stable demo token shape so copy-paste yields a working-looking
// command. Pinned with useMemo on mount to avoid SSR/CSR hydration mismatches
// and to keep the value stable across re-renders. When real auth lands, the
// useMemo body becomes "fetch from AuthContext.user.starterToken".
function makeMockToken(prefix: string): string {
  return `${prefix}_demo_${Math.random().toString(36).slice(2, 10).padEnd(8, "0")}`;
}

function generateSnippets(
  model: Model,
  token: string,
  runValues?: Record<string, unknown>,
): Record<Lang, string> {
  const baseUrl = model.apiEndpoint ?? "https://gateway.livepeer.org/v1";
  const endpoint =
    model.category === "Language"
      ? `${baseUrl}/chat/completions`
      : `${baseUrl}/${model.id}`;

  const isLLM = model.category === "Language";

  // If the user has supplied playground inputs, bake them into the request body
  // so "Copy code for this run" produces production code matching what they tested.
  const useRunValues = runValues && Object.keys(runValues).length > 0;

  let body: string;
  if (useRunValues) {
    const payload = isLLM
      ? { model: model.id, ...runValues }
      : { ...runValues, model: model.id };
    body = JSON.stringify(payload, null, 2);
  } else {
    body = isLLM
      ? `{
    "model": "${model.id}",
    "messages": [
      {"role": "user", "content": "Hello, how are you?"}
    ],
    "temperature": 0.7,
    "max_tokens": 1024
  }`
      : `{
    "prompt": "A scenic mountain landscape at sunset",
    "model": "${model.id}"
  }`;
  }

  return {
    curl: `curl -X POST "${endpoint}" \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d '${body}'`,

    python: useRunValues
      ? `import requests

response = requests.post(
    "${endpoint}",
    headers={
        "Authorization": "Bearer ${token}",
        "Content-Type": "application/json",
    },
    json=${body.replace(/^/gm, "    ").trimStart()},
)
print(response.json())`
      : isLLM
        ? `from openai import OpenAI

client = OpenAI(
    base_url="${baseUrl}",
    api_key="${token}",
)

response = client.chat.completions.create(
    model="${model.id}",
    messages=[
        {"role": "user", "content": "Hello, how are you?"}
    ],
    temperature=0.7,
    max_tokens=1024,
)
print(response.choices[0].message.content)`
        : `import requests

response = requests.post(
    "${endpoint}",
    headers={
        "Authorization": "Bearer ${token}",
        "Content-Type": "application/json",
    },
    json={
        "prompt": "A scenic mountain landscape at sunset",
        "model": "${model.id}",
    },
)
print(response.json())`,

    node: useRunValues
      ? `const response = await fetch("${endpoint}", {
  method: "POST",
  headers: {
    Authorization: "Bearer ${token}",
    "Content-Type": "application/json",
  },
  body: JSON.stringify(${body.replace(/^/gm, "  ").trimStart()}),
});
const result = await response.json();
console.log(result);`
      : isLLM
        ? `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${baseUrl}",
  apiKey: "${token}",
});

const response = await client.chat.completions.create({
  model: "${model.id}",
  messages: [
    { role: "user", content: "Hello, how are you?" },
  ],
  temperature: 0.7,
  max_tokens: 1024,
});
console.log(response.choices[0].message.content);`
        : `const response = await fetch("${endpoint}", {
  method: "POST",
  headers: {
    Authorization: "Bearer ${token}",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    prompt: "A scenic mountain landscape at sunset",
    model: "${model.id}",
  }),
});
const result = await response.json();
console.log(result);`,

    http: `POST ${endpoint} HTTP/1.1
Host: ${new URL(baseUrl).host}
Authorization: Bearer ${token}
Content-Type: application/json

${body}`,
  };
}

export default function CodeSnippets({
  model,
  fixedLang,
  runValues,
}: {
  model: Model;
  fixedLang?: Lang;
  /** When provided, snippets bake these values into the request body instead of
   *  the generic example. Used by the Playground's "Copy code for this run". */
  runValues?: Record<string, unknown>;
}) {
  const [lang, setLang] = useState<Lang>(fixedLang ?? "curl");
  const { isConnected } = useAuth();
  // Token injection state: null = follow `isConnected` (default-on for signed-in
  // users), true/false = user explicitly chose. Storing the override separately
  // avoids the "useState(initialValue) freezes the value" trap when AuthContext
  // hydrates from localStorage after first render.
  const [authOverride, setAuthOverride] = useState<boolean | null>(null);
  const useToken = authOverride ?? isConnected;

  // Pin the demo token across renders + avoid SSR/CSR hydration mismatch by
  // generating it client-side only after mount.
  const [mockToken, setMockToken] = useState<string | null>(null);
  useEffect(() => {
    setMockToken(makeMockToken(STARTER_API_KEY.prefix));
  }, []);

  const token = useToken && isConnected && mockToken
    ? mockToken
    : PLACEHOLDER_TOKEN;

  const snippets = useMemo(
    () => generateSnippets(model, token, runValues),
    [model, token, runValues],
  );
  const activeLang = fixedLang ?? lang;

  return (
    <div className="overflow-hidden rounded-lg border border-hairline">
      <div className="flex items-center justify-between border-b border-hairline bg-zebra">
        {fixedLang ? (
          <span className="px-3 py-2 text-xs font-medium text-fg-faint">
            {LANGS.find((l) => l.key === fixedLang)?.label}
          </span>
        ) : (
          <div className="flex">
            {LANGS.map((l) => (
              <button
                key={l.key}
                onClick={() => setLang(l.key)}
                className={`border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
                  lang === l.key
                    ? "border-green-bright text-fg"
                    : "border-transparent text-fg-faint hover:text-fg-muted"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1 pr-2">
          {isConnected && (
            <button
              type="button"
              onClick={() => setAuthOverride(!useToken)}
              className={`hidden h-7 items-center rounded-md px-2 text-[11px] font-medium transition-colors sm:inline-flex ${
                useToken
                  ? "text-fg-muted hover:bg-hover hover:text-fg"
                  : "bg-tint text-fg-strong hover:bg-pop"
              }`}
              title={
                useToken
                  ? "Show snippet without your token (safe to share)"
                  : "Inject your starter token into the snippet"
              }
            >
              {useToken ? "Without auth" : "With my token"}
            </button>
          )}
          <CopyButton
            value={snippets[activeLang]}
            label="Copy"
            ariaLabel="Copy code"
          />
        </div>
      </div>
      <pre className="scrollbar-dark overflow-x-auto bg-overlay p-4 font-mono text-xs leading-relaxed text-fg-muted">
        {snippets[activeLang]}
      </pre>
    </div>
  );
}
