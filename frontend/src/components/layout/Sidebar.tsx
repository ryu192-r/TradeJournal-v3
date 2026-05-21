import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/appStore'
import { useAuthStore } from '@/store/authStore'
import {
  BarChart3,
  BookOpen,
  Briefcase,
  ClipboardList,
  Cpu,
  LayoutDashboard,
  Lightbulb,
  Menu,
  Settings,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { type ReactNode } from 'react'

const navItems = [
  { id: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
  { id: 'analytics' as const, label: 'Analytics', icon: BarChart3 },
  { id: 'trades' as const, label: 'Trades', icon: Briefcase },
  { id: 'perf-os' as const, label: 'Perf OS', icon: Cpu },
  { id: 'sa-notes' as const, label: 'SA Notes', icon: BookOpen },
  { id: 'playbook' as const, label: 'Playbook', icon: ClipboardList },
  { id: 'review' as const, label: 'Review', icon: TrendingUp },
  { id: 'ideas' as const, label: 'Ideas', icon: Lightbulb },
  { id: 'capital' as const, label: 'Capital', icon: TrendingUp },
  { id: 'coach' as const, label: 'AI Coach', icon: Sparkles },
  { id: 'settings' as const, label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const { sidebarOpen, toggleSidebar, activeView, setActiveView } = useAppStore()
  const user = useAuthStore((s) => s.user)

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 h-full z-50 bg-bg-low border-r border-border flex flex-col transition-transform duration-300 ease-out',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          'w-56'
        )}
      >
        <div className="flex items-center gap-2.5 px-5 pt-[1.375rem] pb-[1.125rem] border-b border-border">
          <div className="w-8 h-8 rounded-lg bg-accent-muted flex items-center justify-center">
            <svg className="w-[17px] h-[17px] text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <span className="font-display font-medium text-[1.1rem] tracking-[-0.025rem] leading-none text-text-heading">TradeJournal</span>
        </div>

        <nav className="flex-1 px-1.5 pt-2.5 pb-4 flex flex-col gap-0.5">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeView === item.id
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveView(item.id)
                  if (window.innerWidth < 1024) toggleSidebar()
                }}
                className={cn(
                  'w-full flex items-center gap-2.5 px-[.8125rem] py-[.5625rem] rounded-lg text-[.8125rem] font-medium transition-all duration-[120ms] ease-out cursor-pointer',
                  'border border-transparent text-text',
                  isActive
                    ? 'bg-accent-muted text-accent font-semibold'
                    : 'opacity-70 hover:opacity-100 hover:text-text-heading hover:bg-accent-faint'
                )}
              >
                <Icon className="w-[15px] h-[15px]" />
                {item.label}
              </button>
            )
          })}
        </nav>

        <div className="flex items-center gap-3 px-5 pt-3.5 pb-[.875rem] border-t border-border">
          <div className="w-[30px] h-[30px] rounded-full bg-accent text-white flex items-center justify-center text-[.625rem] font-bold font-display shrink-0">
            {user?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??'}
          </div>
          <div>
            <div className="text-[.8125rem] font-semibold text-text-heading leading-tight">{user?.full_name || 'User'}</div>
            <div className="flex items-center gap-[.3125rem]">
              <div className="w-[5px] h-[5px] rounded-full bg-text-muted" />
              <span className="text-[.625rem] text-text-muted">Market closed</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile hamburger */}
      <button
        onClick={toggleSidebar}
        className="fixed top-3 left-3 z-50 lg:hidden p-2 rounded-lg bg-bg-card border border-border text-text hover:bg-bg-elevated cursor-pointer"
      >
        <Menu className="w-5 h-5" />
      </button>
    </>
  )
}

export function TopBar({ children }: { children?: ReactNode }) {
  return (
    <header className="h-14 flex items-center px-4 border-b border-border bg-bg-low/60 backdrop-blur-sm">
      <div className="flex-1 ml-2">{children}</div>
    </header>
  )
}
