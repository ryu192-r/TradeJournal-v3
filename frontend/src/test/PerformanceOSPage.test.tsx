import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DebouncedTextarea } from '@/pages/PerformanceOSPage'

describe('DebouncedTextarea', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('debounces text saves instead of saving on every change', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<DebouncedTextarea aria-label="notes" value="" onSave={onSave} debounceMs={1000} />)

    const textarea = screen.getByLabelText('notes')
    fireEvent.change(textarea, { target: { value: 'a' } })
    fireEvent.change(textarea, { target: { value: 'ab' } })
    fireEvent.change(textarea, { target: { value: 'abc' } })

    expect(onSave).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(1000)
    })

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith('abc')
  })

  it('flushes the latest text on blur', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<DebouncedTextarea aria-label="notes" value="" onSave={onSave} debounceMs={1000} />)

    const textarea = screen.getByLabelText('notes')
    fireEvent.change(textarea, { target: { value: 'blur save' } })

    await act(async () => {
      fireEvent.blur(textarea)
    })

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith('blur save')
  })
})
