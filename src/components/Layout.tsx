import { type ReactNode } from 'react';
import { Home, BookOpen, CalendarClock, Wallet, BookHeart, Settings, WifiOff, RefreshCw, CheckCircle2, Cloud } from 'lucide-react';
import { useApp, type PageName } from '../contexts/AppContext';

const NAV_ITEMS: { page: PageName; label: string; icon: typeof Home }[] = [
  { page: 'home', label: 'Home', icon: Home },
  { page: 'study', label: 'Study', icon: BookOpen },
  { page: 'planner', label: 'Planner', icon: CalendarClock },
  { page: 'finance', label: 'Finance', icon: Wallet },
  { page: 'diary', label: 'Diary', icon: BookHeart },
  { page: 'settings', label: 'Settings', icon: Settings },
];

function SyncBadge() {
  const { online, syncStatus } = useApp();

  if (!online) {
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-[#C0392B]/10 px-2.5 py-1 text-xs text-[#C0392B]">
        <WifiOff size={12} />
        <span>Offline</span>
      </div>
    );
  }

  if (syncStatus === 'syncing') {
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-[#C8A96E]/10 px-2.5 py-1 text-xs text-[#C8A96E]">
        <RefreshCw size={12} className="animate-spin" />
        <span>Syncing</span>
      </div>
    );
  }

  if (syncStatus === 'synced') {
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-[#4CAF7D]/10 px-2.5 py-1 text-xs text-[#4CAF7D]">
        <CheckCircle2 size={12} />
        <span>Synced</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-400">
      <Cloud size={12} />
      <span>Online</span>
    </div>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const { activePage, setActivePage } = useApp();

  return (
    <div className="flex min-h-screen bg-[#0D0D0D] text-zinc-100" style={{ fontFamily: 'DM Sans, sans-serif' }}>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-60 flex-col border-r border-zinc-800/50 bg-[#0D0D0D] fixed inset-y-0 left-0 z-30">
        <div className="flex items-center gap-3 px-5 py-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[#C8A96E]">
            <span className="text-lg font-bold text-[#C8A96E]">Y</span>
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-widest text-[#C8A96E]">YOURS</h1>
            <p className="text-[10px] text-zinc-500">Personal Life OS</p>
          </div>
        </div>
        <nav className="flex-1 px-3 py-2 space-y-1">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const active = activePage === item.page;
            return (
              <button
                key={item.page}
                onClick={() => setActivePage(item.page)}
                className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all ${
                  active
                    ? 'bg-[#C8A96E]/10 text-[#C8A96E]'
                    : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                }`}
              >
                <Icon size={18} />
                {item.label}
                {active && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-[#C8A96E]" />}
              </button>
            );
          })}
        </nav>
        <div className="px-5 py-4 border-t border-zinc-800/50">
          <SyncBadge />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-60 pb-20 md:pb-0 min-h-screen">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-zinc-800/50 sticky top-0 bg-[#0D0D0D]/95 backdrop-blur z-20">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#C8A96E]">
              <span className="text-sm font-bold text-[#C8A96E]">Y</span>
            </div>
            <span className="text-sm font-bold tracking-widest text-[#C8A96E]">YOURS</span>
          </div>
          <SyncBadge />
        </div>
        <div className="px-4 md:px-8 py-6 max-w-6xl mx-auto">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 flex items-center justify-around border-t border-zinc-800/50 bg-[#0D0D0D]/95 backdrop-blur px-1 py-2 safe-bottom">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const active = activePage === item.page;
          return (
            <button
              key={item.page}
              onClick={() => setActivePage(item.page)}
              className={`flex flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 transition-colors ${
                active ? 'text-[#C8A96E]' : 'text-zinc-500'
              }`}
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
