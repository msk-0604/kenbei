import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as Network from "expo-network";
import type { PhotoQueueItem } from "./photo-queue-logic";
import { unsyncedCount } from "./photo-queue-logic";
import {
  flushPhotoQueue,
  refreshPhotoQueue,
  retryAllFailed,
  retryPhoto,
  subscribePhotoQueue,
} from "./photo-queue";

type PhotoQueueContextValue = {
  items: PhotoQueueItem[];
  pendingCount: number;
  retryPhoto: (localId: string) => Promise<void>;
  retryAll: () => Promise<void>;
  flush: () => Promise<void>;
};

const PhotoQueueContext = createContext<PhotoQueueContextValue | null>(null);

export function PhotoQueueProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<PhotoQueueItem[]>([]);

  useEffect(() => {
    const unsub = subscribePhotoQueue(setItems);
    void refreshPhotoQueue().then(() => {
      void flushPhotoQueue();
    });
    let network: { remove: () => void } | undefined;
    try {
      network = Network.addNetworkStateListener((state) => {
        if (state.isConnected && state.isInternetReachable !== false) {
          void flushPhotoQueue();
        }
      });
    } catch {
      network = undefined;
    }
    return () => {
      unsub();
      network?.remove();
    };
  }, []);

  const value = useMemo(
    () => ({
      items,
      pendingCount: unsyncedCount(items),
      retryPhoto,
      retryAll: retryAllFailed,
      flush: flushPhotoQueue,
    }),
    [items],
  );

  return <PhotoQueueContext.Provider value={value}>{children}</PhotoQueueContext.Provider>;
}

export function usePhotoQueue(): PhotoQueueContextValue {
  const ctx = useContext(PhotoQueueContext);
  if (!ctx) {
    throw new Error("usePhotoQueue must be used within PhotoQueueProvider");
  }
  return ctx;
}
