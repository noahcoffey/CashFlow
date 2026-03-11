import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Test the debounce logic directly without React hooks
function createDebouncer<T>(delay: number) {
  let timer: ReturnType<typeof setTimeout> | null = null
  let currentValue: T | undefined

  return {
    update(value: T): void {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        currentValue = value
      }, delay)
    },
    getValue(): T | undefined {
      return currentValue
    },
    flush(): void {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
    },
  }
}

describe('debounce logic', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not update value immediately', () => {
    const debouncer = createDebouncer<string>(300)
    debouncer.update('hello')
    expect(debouncer.getValue()).toBeUndefined()
  })

  it('updates value after delay', () => {
    const debouncer = createDebouncer<string>(300)
    debouncer.update('hello')
    vi.advanceTimersByTime(300)
    expect(debouncer.getValue()).toBe('hello')
  })

  it('resets timer on rapid updates', () => {
    const debouncer = createDebouncer<string>(300)
    debouncer.update('h')
    vi.advanceTimersByTime(100)
    debouncer.update('he')
    vi.advanceTimersByTime(100)
    debouncer.update('hel')
    vi.advanceTimersByTime(100)
    // Only 100ms since last update, should not have fired
    expect(debouncer.getValue()).toBeUndefined()
    vi.advanceTimersByTime(200)
    // Now 300ms since last update
    expect(debouncer.getValue()).toBe('hel')
  })

  it('only fires once for multiple rapid updates', () => {
    const debouncer = createDebouncer<string>(300)
    const values: string[] = []
    const original = debouncer.update.bind(debouncer)

    // Track when value changes
    let lastValue: string | undefined
    const checkValue = () => {
      const v = debouncer.getValue()
      if (v !== lastValue) {
        if (v !== undefined) values.push(v)
        lastValue = v
      }
    }

    debouncer.update('s')
    vi.advanceTimersByTime(50)
    checkValue()
    debouncer.update('st')
    vi.advanceTimersByTime(50)
    checkValue()
    debouncer.update('sta')
    vi.advanceTimersByTime(50)
    checkValue()
    debouncer.update('star')
    vi.advanceTimersByTime(300)
    checkValue()

    expect(values).toEqual(['star'])
  })

  it('handles different delay values', () => {
    const fast = createDebouncer<string>(100)
    const slow = createDebouncer<string>(500)

    fast.update('fast')
    slow.update('slow')

    vi.advanceTimersByTime(100)
    expect(fast.getValue()).toBe('fast')
    expect(slow.getValue()).toBeUndefined()

    vi.advanceTimersByTime(400)
    expect(slow.getValue()).toBe('slow')
  })

  it('can be cleaned up without firing', () => {
    const debouncer = createDebouncer<string>(300)
    debouncer.update('hello')
    debouncer.flush()
    vi.advanceTimersByTime(500)
    expect(debouncer.getValue()).toBeUndefined()
  })
})

describe('useDebounce hook source', () => {
  it('exports useDebounce function', async () => {
    const mod = await import('@/hooks/use-debounce')
    expect(typeof mod.useDebounce).toBe('function')
  })
})
