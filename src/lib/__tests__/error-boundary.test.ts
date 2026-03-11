import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'

// Test the error boundary logic without requiring a full DOM renderer.
// We verify the class-based lifecycle methods directly.

import { ErrorBoundary } from '@/components/error-boundary'
import { ChartErrorBoundary } from '@/components/chart-error-boundary'

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('getDerivedStateFromError returns hasError true with the error', () => {
    const error = new Error('test failure')
    const state = ErrorBoundary.getDerivedStateFromError(error)
    expect(state).toEqual({ hasError: true, error })
  })

  it('initial state has no error', () => {
    const boundary = new ErrorBoundary({ children: null })
    expect(boundary.state).toEqual({ hasError: false, error: null })
  })

  it('handleReset clears the error state', () => {
    const boundary = new ErrorBoundary({ children: null })
    boundary.state = { hasError: true, error: new Error('test') }
    // Simulate setState by calling handleReset and checking it calls setState correctly
    const setStateSpy = vi.fn()
    boundary.setState = setStateSpy
    boundary.handleReset()
    expect(setStateSpy).toHaveBeenCalledWith({ hasError: false, error: null })
  })

  it('render returns children when no error', () => {
    const boundary = new ErrorBoundary({ children: React.createElement('div', null, 'hello') })
    boundary.state = { hasError: false, error: null }
    const result = boundary.render()
    expect(result).toEqual(React.createElement('div', null, 'hello'))
  })

  it('render returns fallback when provided and error exists', () => {
    const fallback = React.createElement('span', null, 'fallback')
    const boundary = new ErrorBoundary({ children: React.createElement('div'), fallback })
    boundary.state = { hasError: true, error: new Error('crash') }
    const result = boundary.render()
    expect(result).toBe(fallback)
  })

  it('render returns default error UI when no fallback and error exists', () => {
    const boundary = new ErrorBoundary({ children: React.createElement('div') })
    boundary.state = { hasError: true, error: new Error('something broke') }
    const result = boundary.render()
    // Default error UI is a Card-based component (React element), not the children
    expect(result).not.toEqual(React.createElement('div'))
    expect(result).toBeTruthy()
  })
})

describe('ChartErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('getDerivedStateFromError returns hasError true', () => {
    const state = ChartErrorBoundary.getDerivedStateFromError()
    expect(state).toEqual({ hasError: true })
  })

  it('initial state has no error', () => {
    const boundary = new ChartErrorBoundary({ children: null })
    expect(boundary.state).toEqual({ hasError: false })
  })

  it('render returns children when no error', () => {
    const child = React.createElement('svg', null, 'chart')
    const boundary = new ChartErrorBoundary({ children: child })
    boundary.state = { hasError: false }
    expect(boundary.render()).toEqual(child)
  })

  it('render returns fallback message when error exists', () => {
    const boundary = new ChartErrorBoundary({ children: React.createElement('svg') })
    boundary.state = { hasError: true }
    const result = boundary.render()
    expect(result).toBeTruthy()
    expect(result).not.toEqual(React.createElement('svg'))
  })
})
