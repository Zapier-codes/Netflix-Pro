/**
 * useBoxOfficeStatus - React hook for monitoring BoxOffice engine status.
 * Lightweight hook focused only on engine lifecycle state.
 */

import { useState, useEffect, useCallback } from 'react'
import { boxOffice, EngineStatus, StatusChangeEvent } from '../BoxOfficeBridge'

export interface UseBoxOfficeStatusState {
  status: EngineStatus | null
  isRunning: boolean
  isInitializing: boolean
  isIdle: boolean
  isError: boolean
  error: string | null
}

export interface UseBoxOfficeStatusActions {
  refresh: () => Promise<void>
  start: () => Promise<void>
  stop: () => Promise<void>
}

export function useBoxOfficeStatus(): [UseBoxOfficeStatusState, UseBoxOfficeStatusActions] {
  const [state, setState] = useState<UseBoxOfficeStatusState>({
    status: null,
    isRunning: false,
    isInitializing: false,
    isIdle: true,
    isError: false,
    error: null,
  })

  // Subscribe to status change events
  useEffect(() => {
    const unsubscribe = boxOffice.onStatusChange((event: StatusChangeEvent) => {
      const status = event.status
      setState(prev => ({
        ...prev,
        status: prev.status ? { ...prev.status, status, timestamp: event.timestamp } : null,
        isRunning: status === 'running',
        isInitializing: status === 'initializing',
        isIdle: status === 'idle',
        isError: status === 'error',
      }))
    })

    // Initial status fetch
    refresh()

    return unsubscribe
  }, [])

  const refresh = useCallback(async () => {
    try {
      const status = await boxOffice.getStatus()
      setState({
        status,
        isRunning: status.running,
        isInitializing: status.status === 'initializing',
        isIdle: status.status === 'idle',
        isError: status.status === 'error',
        error: null,
      })
    } catch (err: any) {
      setState(prev => ({ ...prev, error: err.message ?? 'Failed to fetch status' }))
    }
  }, [])

  const start = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isInitializing: true, error: null }))
      const result = await boxOffice.start()
      if (!result.success) {
        setState(prev => ({ ...prev, error: result.error ?? 'Failed to start engine' }))
      }
      await refresh()
    } catch (err: any) {
      setState(prev => ({ ...prev, error: err.message ?? 'Start failed', isInitializing: false }))
    }
  }, [refresh])

  const stop = useCallback(async () => {
    try {
      const result = await boxOffice.stop()
      if (!result.success) {
        setState(prev => ({ ...prev, error: result.error ?? 'Failed to stop engine' }))
      }
      await refresh()
    } catch (err: any) {
      setState(prev => ({ ...prev, error: err.message ?? 'Stop failed' }))
    }
  }, [refresh])

  const actions: UseBoxOfficeStatusActions = {
    refresh,
    start,
    stop,
  }

  return [state, actions]
}

export default useBoxOfficeStatus