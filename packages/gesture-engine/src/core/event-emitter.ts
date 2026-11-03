import type { GestureEventMap } from "./types.js";

type EventHandler<T> = (payload: T) => void;

export class TypedEventEmitter {
  private listeners: Map<keyof GestureEventMap, Set<EventHandler<any>>> = new Map();

  on<E extends keyof GestureEventMap>(
    event: E,
    handler: (payload: GestureEventMap[E]) => void
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const handlers = this.listeners.get(event)!;
    handlers.add(handler);

    let removed = false;
    return () => {
      if (removed) return;
      removed = true;
      this.off(event, handler);
    };
  }

  once<E extends keyof GestureEventMap>(
    event: E,
    handler: (payload: GestureEventMap[E]) => void
  ): () => void {
    const wrapped = (payload: GestureEventMap[E]) => {
      this.off(event, wrapped);
      handler(payload);
    };
    return this.on(event, wrapped);
  }

  off<E extends keyof GestureEventMap>(
    event: E,
    handler: (payload: GestureEventMap[E]) => void
  ): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    handlers.delete(handler);
    if (handlers.size === 0) {
      this.listeners.delete(event);
    }
  }

  emit<E extends keyof GestureEventMap>(
    event: E,
    payload: GestureEventMap[E]
  ): void {
    const handlers = this.listeners.get(event);
    if (!handlers || handlers.size === 0) return;

    // Snapshot the handlers to avoid issues if listeners mutate the set during dispatch
    const snapshot = Array.from(handlers);
    for (const handler of snapshot) {
      try {
        handler(payload);
      } catch (err) {
        // Emit through error event if possible without infinite loop
        if (event !== "error") {
          this.emit("error" as any, err as any);
        } else {
          console.error("Unhandled error in error event listener:", err);
        }
      }
    }
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }
}
