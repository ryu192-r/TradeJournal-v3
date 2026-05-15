import { create } from 'zustand'

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

  activeView: 'dashboard' | 'analytics' | 'coach' | 'trades' | 'journal' | 'playbook' | 'review' | 'ideas' | 'capital' | 'settings'
  setActiveView: (view: AppState['activeView']) => void

  tradeFormMode: 'list' | 'create' | 'edit'
  selectedTradeId: number | null
  openCreateTrade: () => void
  openEditTrade: (id: number) => void
  closeTradeForm: () => void

  theme: 'dark' | 'light'
  toggleTheme: () => void
  setTheme: (theme: 'dark' | 'light') => void
}

const getInitialTheme = (): 'dark' | 'light' => {
  const stored = localStorage.getItem('tjv3-theme')
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia?.('(prefers-color-scheme:light)').matches ? 'light' : 'dark'
}

const applyTheme = (theme: 'dark' | 'light') => {
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem('tjv3-theme', theme)
}

export const useAppStore = create<AppState>((set, get) => ({
  positions: [],
  setPositions: (positions) => set({ positions }),

  accountBalance: null,
  setAccountBalance: (balance) => set({ accountBalance: balance }),

  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  activeView: 'dashboard',
  setActiveView: (view) => set({ activeView: view }),

  tradeFormMode: 'list',
  selectedTradeId: null,
  openCreateTrade: () => set({ activeView: 'trades', tradeFormMode: 'create', selectedTradeId: null }),
  openEditTrade: (id) => set({ activeView: 'trades', tradeFormMode: 'edit', selectedTradeId: id }),
  closeTradeForm: () => set({ tradeFormMode: 'list', selectedTradeId: null }),

  theme: getInitialTheme(),
  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    set({ theme: next })
  },
  setTheme: (theme) => {
    applyTheme(theme)
    set({ theme })
  },
}))

// Apply initial theme immediately
applyTheme(getInitialTheme())
