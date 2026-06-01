/** Mobile layout constants — keep in sync with index.css + index.html viewport meta */

export const VIEWPORT_META =
  'width=device-width, initial-scale=1, viewport-fit=cover'

export const MOBILE_VIEWPORTS = [
  { width: 360, height: 740, label: 'small-android' },
  { width: 390, height: 844, label: 'iphone-14' },
  { width: 412, height: 915, label: 'pixel-android' },
  { width: 430, height: 932, label: 'iphone-14-pro-max' },
  { width: 768, height: 1024, label: 'tablet' },
  { width: 1280, height: 800, label: 'desktop' },
] as const

export const APP_SHELL_CLASS =
  'app-shell relative min-h-dvh bg-bg flex w-full min-w-0 max-w-full overflow-x-clip'

export const MAIN_CONTENT_CLASS =
  'main-content transition-all duration-300'

export const PAGE_CONTAINER_CLASS =
  'page-container mx-auto w-full min-w-0 max-w-[1440px] overflow-x-clip px-[var(--page-px)] py-[var(--page-py)] pb-[calc(var(--page-py)+var(--bottom-nav-height)+env(safe-area-inset-bottom,0px))] lg:pb-[var(--page-py)]'

export const MAIN_SCROLL_CLASS =
  'flex-1 min-h-0 min-w-0 w-full overflow-y-auto overflow-x-clip scrollbar-thin pb-[calc(var(--bottom-nav-height)+var(--page-py)+env(safe-area-inset-bottom,0px))] lg:pb-0'
