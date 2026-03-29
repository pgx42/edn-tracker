import { useEffect } from "react";
import { listen, type EventCallback, type UnlistenFn } from "@tauri-apps/api/event";

export function useTauriEvent<T>(
  event: string,
  callback: EventCallback<T>
): void {
  useEffect(() => {
    let unlisten: UnlistenFn | undefined;

    listen<T>(event, callback).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, [event, callback]);
}
