/**
 * EventEmitter - Utility event emitter for internal BoxOffice module communication.
 * Lightweight typed event emitter for cross-component messaging.
 */

export type EventListener<T = any> = (data: T) => void

export class EventEmitter {
  private listeners: Map<string, Set<EventListener>> = new Map()

  /**
   * Subscribe to an event.
   */
  on<T>(event: string, listener: EventListener<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(listener)

    // Return unsubscribe function
    return () => this.off(event, listener)
  }

  /**
   * Subscribe to an event for one emission only.
   */
  once<T>(event: string, listener: EventListener<T>): () => void {
    const onceListener: EventListener<T> = (data: T) => {
      this.off(event, onceListener)
      listener(data)
    }
    return this.on(event, onceListener)
  }

  /**
   * Unsubscribe from an event.
   */
  off<T>(event: string, listener: EventListener<T>): void {
    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      eventListeners.delete(listener)
      if (eventListeners.size === 0) {
        this.listeners.delete(event)
      }
    }
  }

  /**
   * Emit an event to all subscribers.
   */
  emit<T>(event: string, data: T): void {
    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      eventListeners.forEach(listener => {
        try {
          listener(data)
        } catch (err) {
          console.error(`EventEmitter: Error in listener for "${event}":`, err)
        }
      })
    }
  }

  /**
   * Remove all listeners for an event, or all events if no event specified.
   */
  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event)
    } else {
      this.listeners.clear()
    }
  }

  /**
   * Get the number of listeners for an event.
   */
  listenerCount(event: string): number {
    return this.listeners.get(event)?.size ?? 0
  }

  /**
   * Check if there are any listeners for an event.
   */
  hasListeners(event: string): boolean {
    return this.listenerCount(event) > 0
  }
}

export default EventEmitter