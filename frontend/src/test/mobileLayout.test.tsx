import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PageShell } from '@/components/layout/PageShell'
import {
  VIEWPORT_META,
  MOBILE_VIEWPORTS,
  MAIN_SCROLL_CLASS,
  APP_SHELL_CLASS,
  PAGE_CONTAINER_CLASS,
} from '@/lib/mobileLayout'
import { PAGE_STACK, CARD } from '@/components/layout/layoutTokens'

describe('mobile layout system', () => {
  it('viewport meta string matches index.html contract', () => {
    expect(VIEWPORT_META).toBe(
      'width=device-width, initial-scale=1, viewport-fit=cover'
    )
  })

  it('PageShell applies responsive page container guards', () => {
    render(<PageShell>page content</PageShell>)
    const shell = screen.getByTestId('page-shell')
    expect(shell.className).toContain('min-w-0')
    expect(shell.className).toContain('overflow-x-clip')
    expect(shell.className).toContain('bottom-nav-height')
    expect(PAGE_CONTAINER_CLASS).toContain('page-container')
  })

  it('layout tokens prevent horizontal overflow in cards and stacks', () => {
    expect(CARD).toContain('min-w-0')
    expect(CARD).toContain('max-w-full')
    expect(PAGE_STACK).toContain('max-w-full')
  })

  it('documents QA viewport sizes', () => {
    expect(MOBILE_VIEWPORTS.map((v) => v.width)).toEqual([360, 390, 412, 430, 768, 1280])
  })

  it('main scroll region reserves bottom nav + safe area on mobile', () => {
    expect(MAIN_SCROLL_CLASS).toContain('bottom-nav-height')
    expect(MAIN_SCROLL_CLASS).toContain('safe-area-inset-bottom')
    expect(MAIN_SCROLL_CLASS).toContain('overflow-x-clip')
  })

  it('app shell uses dynamic viewport height', () => {
    expect(APP_SHELL_CLASS).toContain('min-h-dvh')
    expect(APP_SHELL_CLASS).toContain('overflow-x-clip')
  })
})
