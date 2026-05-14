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
  // Open positions
  positions: Position[]
  setPositions: (positions: Position[]) => void

  // Account balance
  accountBalance: number | null
  setAccountBalance: (balance: number) => void

  // UI preferences
  sidebarOpen: boolean
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void

  // Active view
  activeView: 'dashboard' | 'trades' | 'journal' | 'playbook' | 'review' | 'ideas' | 'settings'
  setActiveView: (view: AppState['activeView']) => void

  // Trade form mode
  tradeFormMode: 'list' | 'create' | 'edit'
  selectedTradeId: number | null
  openCreateTrade: () => void
  openEditTrade: (id: number) => void
  closeTradeForm: () => void
}

export const useAppStore = create<AppState>((set) => ({
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
}))
