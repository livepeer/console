"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import type { Environment, EnvironmentKind } from "@/lib/dashboard/types";
import {
  ENVIRONMENTS,
  DEFAULT_ENVIRONMENT,
} from "@/lib/dashboard/mock-data";

// Persisted selection key. Mirrors the localStorage conventions used for the
// theme and first-run flag. Stores the environment id.
const STORAGE_KEY = "livepeer.environment";

interface EnvironmentContextValue {
  environments: Environment[];
  selectedEnvironmentId: string;
  selectedEnvironment: Environment;
  setEnvironment: (id: string) => void;
  /** Adds a mock environment and switches to it. No backend — session-local. */
  createEnvironment: (name: string, kind?: EnvironmentKind) => Environment;
}

const EnvironmentContext = createContext<EnvironmentContextValue>({
  environments: ENVIRONMENTS,
  selectedEnvironmentId: DEFAULT_ENVIRONMENT.id,
  selectedEnvironment: DEFAULT_ENVIRONMENT,
  setEnvironment: () => {},
  createEnvironment: () => DEFAULT_ENVIRONMENT,
});

export function useEnvironment() {
  return useContext(EnvironmentContext);
}

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function EnvironmentProvider({ children }: { children: ReactNode }) {
  const [environments, setEnvironments] = useState<Environment[]>(ENVIRONMENTS);
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<string>(
    DEFAULT_ENVIRONMENT.id,
  );

  // Restore the persisted selection. Falls back to the default if the stored
  // id no longer resolves (e.g. it referenced a session-only environment).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && ENVIRONMENTS.some((e) => e.id === stored)) {
      setSelectedEnvironmentId(stored);
    }
  }, []);

  const setEnvironment = (id: string) => {
    setSelectedEnvironmentId(id);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, id);
    }
  };

  const createEnvironment = (
    name: string,
    kind: EnvironmentKind = "development",
  ): Environment => {
    const env: Environment = {
      id: `env-${slugify(name)}-${Date.now()}`,
      name,
      slug: slugify(name),
      kind,
    };
    setEnvironments((prev) => [...prev, env]);
    setEnvironment(env.id);
    return env;
  };

  const selectedEnvironment =
    environments.find((e) => e.id === selectedEnvironmentId) ??
    DEFAULT_ENVIRONMENT;

  return (
    <EnvironmentContext.Provider
      value={{
        environments,
        selectedEnvironmentId,
        selectedEnvironment,
        setEnvironment,
        createEnvironment,
      }}
    >
      {children}
    </EnvironmentContext.Provider>
  );
}
