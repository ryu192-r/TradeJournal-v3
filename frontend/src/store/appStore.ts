import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ActiveView } from '@/app/navigation'
import { storeReviewTab } from '@/app/reviewAnalytics'

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

  activeView: ActiveView
  setActiveView: (view: AppState['activeView']) => void

  tradeFormMode: 'list' | 'create' | 'edit' | 'detail'
  selectedTradeId: number | null
  openCreateTrade: () => void
  openEditTrade: (id: number) => void
  openDetailTrade: (id: number) => void
  closeTradeForm: () => void

  reviewTargetId: number | null
  openReviewTrade: (id: number) => void

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

      activeView: 'dashboard',
      setActiveView: (view) => {
        if (view === 'review') storeReviewTab('queue')
        set({ activeView: view, tradeFormMode: 'list', selectedTradeId: null })
      },

      tradeFormMode: 'list',
      selectedTradeId: null,
      openCreateTrade: () => set({ activeView: 'trades', tradeFormMode: 'create', selectedTradeId: null }),
      openEditTrade: (id) => set({ activeView: 'trades', tradeFormMode: 'edit', selectedTradeId: id }),
      openDetailTrade: (id) => set({ activeView: 'trades', tradeFormMode: 'detail', selectedTradeId: id }),
      closeTradeForm: () => set({ tradeFormMode: 'list', selectedTradeId: null }),

      reviewTargetId: null,
      openReviewTrade: (id) => {
        storeReviewTab('queue')
        set({ activeView: 'review', tradeFormMode: 'list', selectedTradeId: null, reviewTargetId: id })
      },

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
      partialize: (state) => ({ theme: state.theme, activeView: state.activeView }),
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
