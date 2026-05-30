import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ActiveView, NavMode } from '@/app/navigation'

const COACHING_INTELLIGENCE_PATH = '/coaching-intelligence'

const getInitialActiveView = (): ActiveView => {
  if (typeof window !== 'undefined' && window.location.pathname === COACHING_INTELLIGENCE_PATH) {
    return 'coaching-intelligence'
  }
  return 'dashboard'
}

interface Position {
  id: number
  symbol: string
  entryPrice: number
  quantity: number
  currentPrice: number
  unrealizedPnl: number
  unrealizedPnlPercent: number
  direction: 'LONG' | 'SHORT'
}

interface AppState {
  positions: Position[]
  setPositions: (positions: Position[]) => void

  accountBalance: number | null
  setAccountBalance: (balance: number) => void

  sidebarOpen: boolean
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void

  navMode: NavMode
  setNavMode: (mode: NavMode) => void

  activeView: ActiveView
  setActiveView: (view: AppState['activeView']) => void

  tradeFormMode: 'list' | 'create' | 'edit' | 'detail'
  selectedTradeId: number | null
  openCreateTrade: () => void
  openEditTrade: (id: number) => void
  openDetailTrade: (id: number) => void
  closeTradeForm: () => void

  theme: 'dark' | 'light'
  toggleTheme: () => void
  setTheme: (theme: 'dark' | 'light') => void
}

const getSystemTheme = (): 'dark' | 'light' => {
  return window.matchMedia?.('(prefers-color-scheme:light)').matches ? 'light' : 'dark'
}

const applyTheme = (theme: 'dark' | 'light') => {
  document.documentElement.setAttribute('data-theme', theme)
}

const getInitialSidebarOpen = (): boolean => {
  if (typeof window === 'undefined') return true
  return window.innerWidth >= 1024
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      positions: [],
      setPositions: (positions) => set({ positions }),

      accountBalance: null,
      setAccountBalance: (balance) => set({ accountBalance: balance }),

      sidebarOpen: getInitialSidebarOpen(),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      navMode: 'simple',
      setNavMode: (mode) => set({ navMode: mode }),

      activeView: getInitialActiveView(),
      setActiveView: (view) => {
        if (typeof window !== 'undefined') {
          if (view === 'coaching-intelligence') {
            window.history.pushState({}, '', COACHING_INTELLIGENCE_PATH)
          } else if (window.location.pathname === COACHING_INTELLIGENCE_PATH) {
            window.history.replaceState({}, '', '/')
          }
        }
        set({ activeView: view, tradeFormMode: 'list', selectedTradeId: null })
      },

      tradeFormMode: 'list',
      selectedTradeId: null,
      openCreateTrade: () => set({ activeView: 'trades', tradeFormMode: 'create', selectedTradeId: null }),
      openEditTrade: (id) => set({ activeView: 'trades', tradeFormMode: 'edit', selectedTradeId: id }),
      openDetailTrade: (id) => set({ activeView: 'trades', tradeFormMode: 'detail', selectedTradeId: id }),
      closeTradeForm: () => set({ tradeFormMode: 'list', selectedTradeId: null }),

      theme: getSystemTheme(),
      toggleTheme: () => {
        const next = get().theme === 'dark' ? 'light' : 'dark'
        applyTheme(next)
        set({ theme: next })
      },
      setTheme: (theme) => {
        applyTheme(theme)
        set({ theme })
      },
    }),
    {
      name: 'app-storage',
      partialize: (state) => ({ navMode: state.navMode, theme: state.theme }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyTheme(state.theme)
        }
      },
    }
  )
)

// Apply initial theme immediately
applyTheme(useAppStore.getState().theme)
