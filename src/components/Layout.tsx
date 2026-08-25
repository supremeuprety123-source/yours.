import { type ReactNode } from 'react';
import { Home, BookOpen, CalendarClock, Wallet, BookHeart, Settings, WifiOff, RefreshCw, CheckCircle2, Cloud, AlertCircle } from 'lucide-react';
import { useApp, type PageName } from '../contexts/AppContext';

const NAV_ITEMS: { page: PageName; label: string; short: string; icon: typeof Home }[] = [
  { page: 'home', label: 'Home', short: 'Home', icon: Home },
  { page: 'study', label: 'Study', short: 'Study', icon: BookOpen },
  { page: 'planner', label: 'Planner', short: 'Plan', icon: CalendarClock },
  { page: 'finance', label: 'Finance', short: 'Cash', icon: Wallet },
  { page: 'diary', label: 'Diary', short: 'Diary', icon: BookHeart },
  { page: 'settings', label: 'Settings', short: 'More', icon: Settings },
];

function SyncBadge() {
  const { online, syncStatus } = useApp();

  const base = 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-semibold tracking-wide border';

  if (!online) {
    return (
      <div className={`${base} border-[#E07A5F]/25 bg-[#E07A5F]/10 text-[#E07A5F]`}>
        <WifiOff size={11} strokeWidth={2.4} /> Offline
      </div>
    );
  }
  if (syncStatus === 'syncing') {
    return (
      <div className={`${base} border-[#E8B86D]/25 bg-[#E8B86D]/10 text-[#E8B86D]`}>
        <RefreshCw size={11} className="animate-spin" strokeWidth={2.4} /> Syncing
      </div>
    );
  }
  if (syncStatus === 'synced') {
    return (
      <div className={`${base} border-[#8FBC8F]/25 bg-[#8FBC8F]/10 text-[#8FBC8F]`}>
        <CheckCircle2 size={11} strokeWidth={2.4} /> Synced
      </div>
    );
  }
  if (syncStatus === 'error') {
    return (
      <div className={`${base} border-[#E07A5F]/25 bg-[#E07A5F]/10 text-[#E07A5F]`} title="Check Supabase SQL">
        <AlertCircle size={11} strokeWidth={2.4} /> Error
      </div>
    );
  }
  return (
    <div className={`${base} border-[rgba(255,236,200,0.08)] bg-white/[0.03] text-[#8A8478]`}>
      <Cloud size={11} strokeWidth={2.4} /> Online
    </div>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const { activePage, setActivePage, profile } = useApp();

  return (
    <div className="y-shell">
      {/* Desktop sidebar */}
      <aside className="y-sidebar">
        <div className="flex items-center gap-3 px-5 pt-8 pb-6">
          <div className="y-mark h-11 w-11 text-lg">Y</div>
          <div className="min-w-0">
            <div className="y-serif text-[15px] font-bold tracking-[0.14em] text-[#E8B86D]">YOURS</div>
            <div className="text-[10.5px] text-[#6B6560] truncate mt-0.5">
              {profile?.name ? `${profile.name} · CA ${profile.ca_level}` : 'Personal Life OS'}
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-0.5">
          <p className="y-section-label px-3 mb-2 mt-1">Navigate</p>
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const active = activePage === item.page;
            return (
              <button
                key={item.page}
                onClick={() => setActivePage(item.page)}
                className={`y-nav-item ${active ? 'y-nav-item-active' : ''}`}
              >
                <Icon size={18} strokeWidth={active ? 2.25 : 1.75} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="px-5 py-5 border-t border-[rgba(255,236,200,0.05)] space-y-3">
          <SyncBadge />
          <p className="text-[11px] leading-relaxed text-[#5C574F]">
            Quiet focus. Steady progress.
          </p>
        </div>
      </aside>

      {/* Main */}
      <main className="y-main">
        <header className="y-topbar">
          <div className="flex items-center gap-2.5">
            <div className="y-mark h-8 w-8 text-sm">Y</div>
            <div>
              <div className="y-serif text-xs font-bold tracking-[0.12em] text-[#E8B86D]">YOURS</div>
            </div>
          </div>
          <SyncBadge />
        </header>

        <div className="y-content y-in">
          {children}
        </div>
      </main>

      {/* Mobile dock */}
      <nav className="y-dock">
        <div className="flex items-stretch px-1.5">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const active = activePage === item.page;
            return (
              <button
                key={item.page}
                onClick={() => setActivePage(item.page)}
                className={`y-dock-item ${active ? 'y-dock-item-active' : ''}`}
              >
                <Icon size={19} strokeWidth={active ? 2.3 : 1.7} />
                <span className="text-[9.5px] font-semibold tracking-wide">{item.short}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
