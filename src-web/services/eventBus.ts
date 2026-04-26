import type { TremEvent, TremEventPayload } from '@web/types/index.ts';

type Handler<T = unknown> = (payload: TremEventPayload<T>) => void;

class EventBus {
  private listeners: Map<string, Set<Handler<unknown>>> = new Map();

  on<T = unknown>(event: TremEvent | string, handler: Handler<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler as Handler<unknown>);
    return () => this.off(event, handler);
  }

  off<T = unknown>(event: TremEvent | string, handler: Handler<T>): void {
    this.listeners.get(event)?.delete(handler as Handler<unknown>);
  }

  emit<T = unknown>(event: TremEvent | string, payload?: TremEventPayload<T> | T): void {
    const wrapped = (payload && typeof payload === 'object' && 'info' in (payload as object))
      ? payload as TremEventPayload<T>
      : { info: { type: 0 }, data: payload as T };
    this.listeners.get(event)?.forEach((h) => {
      try {
        h(wrapped as TremEventPayload<unknown>);
      } catch (e) {
        console.error(`[EventBus] Error in handler for "${event}":`, e);
      }
    });
  }

  once<T = unknown>(event: TremEvent | string, handler: Handler<T>): void {
    const off = this.on<T>(event, (payload) => {
      off();
      handler(payload);
    });
  }
}

export const events = new EventBus();
