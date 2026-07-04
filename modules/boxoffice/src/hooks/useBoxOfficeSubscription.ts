/**
 * useBoxOfficeSubscription - React hook for subscribing to BoxOffice events.
 * Provides granular control over event subscriptions with automatic cleanup.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  boxOffice,
  StatusChangeEvent,
  CommandExecutedEvent,
  DownloadProgressEvent,
  ErrorEvent,
} from '../BoxOfficeBridge'

export type EventType = 'statusChange' | 'commandExecuted' | 'downloadProgress' | 'error'

export interface EventHandlers {
  onStatusChange?: (event: StatusChangeEvent) => void
  onCommandExecuted?: (event: CommandExecutedEvent) => void
  onDownloadProgress?: (event: DownloadProgressEvent) => void
  onError?: (event: ErrorEvent) => void
}

export interface UseBoxOfficeSubscriptionState {
  lastStatusChange: StatusChangeEvent | null
  lastCommandExecuted: CommandExecutedEvent | null
  lastDownloadProgress: DownloadProgressEvent | null
  lastError: ErrorEvent | null
  isSubscribed: boolean
}

export interface UseBoxOfficeSubscriptionActions {
  subscribe: (handlers: EventHandlers) => void
  unsubscribe: () => void
  clearEvents: () => void
}

export function useBoxOfficeSubscription(): [UseBoxOfficeSubscriptionState, UseBoxOfficeSubscriptionActions] {
  const [state, setState] = useState<UseBoxOfficeSubscriptionState>({
    lastStatusChange: null,
    lastCommandExecuted: null,
    lastDownloadProgress: null,
    lastError: null,
    isSubscribed: false,
  })

  const unsubscribers = useRef<(() => void)[]>([])
  const handlersRef = useRef<EventHandlers>({})

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      unsubscribers.current.forEach(unsub => unsub())
      unsubscribers.current = []
    }
  }, [])

  const subscribe = useCallback((handlers: EventHandlers) => {
    // Unsubscribe from any existing subscriptions first
    unsubscribe()

    handlersRef.current = handlers
    const newUnsubscribers: (() => void)[] = []

    if (handlers.onStatusChange) {
      const unsub = boxOffice.onStatusChange((event: StatusChangeEvent) => {
        setState(prev => ({ ...prev, lastStatusChange: event }))
        handlers.onStatusChange?.(event)
      })
      newUnsubscribers.push(unsub)
    }

    if (handlers.onCommandExecuted) {
      const unsub = boxOffice.onCommandExecuted((event: CommandExecutedEvent) => {
        setState(prev => ({ ...prev, lastCommandExecuted: event }))
        handlers.onCommandExecuted?.(event)
      })
      newUnsubscribers.push(unsub)
    }

    if (handlers.onDownloadProgress) {
      const unsub = boxOffice.onDownloadProgress((event: DownloadProgressEvent) => {
        setState(prev => ({ ...prev, lastDownloadProgress: event }))
        handlers.onDownloadProgress?.(event)
      })
      newUnsubscribers.push(unsub)
    }

    if (handlers.onError) {
      const unsub = boxOffice.onError((event: ErrorEvent) => {
        setState(prev => ({ ...prev, lastError: event }))
        handlers.onError?.(event)
      })
      newUnsubscribers.push(unsub)
    }

    unsubscribers.current = newUnsubscribers
    setState(prev => ({ ...prev, isSubscribed: true }))
  }, [])

  const unsubscribe = useCallback(() => {
    unsubscribers.current.forEach(unsub => unsub())
    unsubscribers.current = []
    setState(prev => ({ ...prev, isSubscribed: false }))
  }, [])

  const clearEvents = useCallback(() => {
    setState(prev => ({
      ...prev,
      lastStatusChange: null,
      lastCommandExecuted: null,
      lastDownloadProgress: null,
      lastError: null,
    }))
  }, [])

  const actions: UseBoxOfficeSubscriptionActions = {
    subscribe,
    unsubscribe,
    clearEvents,
  }

  return [state, actions]
}

export default useBoxOfficeSubscription