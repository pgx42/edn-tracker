import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

interface UseInvokeResult<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  execute: (...args: unknown[]) => Promise<T | null>;
}

export function useInvoke<T>(command: string): UseInvokeResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    async (...args: unknown[]): Promise<T | null> => {
      setIsLoading(true);
      setError(null);
      try {
        const payload = args[0] as Record<string, unknown> | undefined;
        const result = await invoke<T>(command, payload);
        setData(result);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [command]
  );

  return { data, isLoading, error, execute };
}
