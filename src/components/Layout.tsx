import { useEffect, useState, type ReactNode } from 'react';
import { Home, BookOpen, CalendarClock, Wallet, BookHeart, Settings, WifiOff, RefreshCw, CheckCircle2, Cloud, AlertCircle, ChevronLeft, Menu } from 'lucide-react';
import { useApp, type PageName } from '../contexts/AppContext';

const NAV_ITEMS: { page: PageName; label: string; short: string; icon: typeof Home }[] = [
  { page: 'home', label: 'Home', short: 'Home', icon: Home },
  { page: 'study', label: 'Study', short: 'Study', icon: BookOpen },
  { page: 'planner', label: 'Planner', short: 'Plan', icon: CalendarClock },
  { page: 'finance', label: 'Finance', short: 'Cash', icon: Wallet },
  { page: 'diary', label: 'Diary', short: 'Diary', icon: BookHeart },
  { page: 'settings', label: 'Settings', short: 'More', icon: Settings },
];

type Shell = 'phone' | 'tablet' | 'desktop';

function useShell(): Shell {
  const [shell, setShell] = useState<Shell>('phone');
  useEffect(() => {
    const phone = window.matchMedia('(max-width: 899px)');
    const desktop = window.matchMedia('(min-width: 1280px)');
    const apply = () => {
      if (phone.matches) setShell('phone');
      else if (desktop.matches) setShell('desktop');
      else setShell('tablet');
    };
    apply();
    phone.addEventListener('change', apply);
    desktop.addEventListener('change', apply);
    window.addEventListener('orientationchange', apply);
    return () => {
      phone.removeEventListener('change', apply);
      desktop.removeEventListener('change', apply);
      window.removeEventListener('orientationchange', apply);
    };
  }, []);
  return shell;
}

function SyncBadge({ compact = false }: { compact?: boolean }) {
  const { online, syncStatus } = useApp();
  const base = 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-semibold tracking-wide border';

  if (!online) {
    return (
      <div className={base + ' border-[#E07A5F]/25 bg-[#E07A5F]/10 text-[#E07A5F]'} title="Offline">
        <WifiOff size={11} strokeWidth={2.4} /> {!compact && 'Offline'}
      </div>
    );
  }
  if (syncStatus === 'syncing') {
    return (
      <div className={base + ' border-[#E8B86D]/25 bg-[#E8B86D]/10 text-[#E8B86D]'} title="Syncing">
        <RefreshCw size={11} className="animate-spin" strokeWidth={2.4} /> {!compact && 'Syncing'}
      </div>
    );
  }
  if (syncStatus === 'synced') {
    return (
      <div className={base + ' border-[#8FBC8F]/25 bg-[#8FBC8F]/10 text-[#8FBC8F]'} title="Synced">
        <CheckCircle2 size={11} strokeWidth={2.4} /> {!compact && 'Synced'}
      </div>
    );
  }
  if (syncStatus === 'error') {
    return (
      <div className={base + ' border-[#E07A5F]/25 bg-[#E07A5F]/10 text-[#E07A5F]'} title="Sync error">
        <AlertCircle size={11} strokeWidth={2.4} /> {!compact && 'Error'}
      </div>
    );
  }
  return (
    <div className={base + ' border-[rgba(255,236,200,0.08)] bg-white/[0.03] text-[#8A8478]'} title="Online">
      <Cloud size={11} strokeWidth={2.4} /> {!compact && 'Online'}
    </div>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const { activePage, setActivePage, profile } = useApp();
  const shell = useShell();
  const [expanded, setExpanded] = useState(false);

  // Wide landscape: open by default. Tablet (incl. 3:2 portrait): icon rail until opened.
  useEffect(() => {
    if (shell === 'desktop') setExpanded(true);
    else setExpanded(false);
  }, [shell]);

  const showSide = shell !== 'phone';
  const rail = showSide && !expanded;

  return (
    <div className={`y-shell ${shell === 'phone' ? 'is-phone' : expanded ? 'is-expanded' : 'is-rail'}`}>
      {showSide && (
        <aside className="y-sidebar" aria-label="Main">
          <div className={`flex items-center gap-3 px-3 pt-6 pb-4 ${rail ? 'justify-center' : 'px-5'}`}>
            <div className="y-mark h-11 w-11 text-lg shrink-0">Y</div>
            {!rail && (
              <div className="min-w-0 y-brand-text">
                <div className="y-serif text-[15px] font-bold tracking-[0.14em] text-[#E8B86D]">YOURS</div>
                <div className="text-[10.5px] text-[#6B6560] truncate mt-0.5">
                  {profile?.name ? `${profile.name} · CA ${profile.ca_level}` : 'Personal Life OS'}
                </div>
              </div>
            )}
          </div>

          <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto">
            {!rail && <p className="y-section-label px-3 mb-2 mt-1">Navigate</p>}
            {NAV_ITEMS.map(item => {
              const Icon = item.icon;
              const active = activePage === item.page;
              return (
                <button
                  key={item.page}
                  onClick={() => setActivePage(item.page)}
                  title={item.label}
                  className={`y-nav-item ${active ? 'y-nav-item-active' : ''} ${rail ? 'y-nav-item-rail' : ''}`}
                >
                  <Icon size={20} strokeWidth={active ? 2.25 : 1.75} />
                  {!rail && <span className="y-nav-label">{item.label}</span>}
                </button>
              );
            })}
          </nav>

          <div className={`px-3 py-4 border-t border-[rgba(255,236,200,0.05)] space-y-3 ${rail ? 'items-center flex flex-col' : ''}`}>
            <SyncBadge compact={rail} />
            {!rail && (
              <p className="y-sidebar-note text-[11px] leading-relaxed text-[#5C574F] px-1">
                Quiet focus. Steady progress.
              </p>
            )}
            <button
              type="button"
              onClick={() => setExpanded(v => !v)}
              className="y-collapse-btn"
              aria-expanded={expanded}
              title={expanded ? 'Minimize sidebar' : 'Expand sidebar'}
            >
              {expanded ? <ChevronLeft size={18} /> : <Menu size={18} />}
              {!rail && <span>Minimize</span>}
            </button>
          </div>
        </aside>
      )}

      <main className="y-main">
        <header className="y-topbar">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="y-mark h-8 w-8 text-sm shrink-0">Y</div>
            <div className="min-w-0">
              <div className="y-serif text-xs font-bold tracking-[0.12em] text-[#E8B86D]">YOURS</div>
              {profile?.name && <div className="text-[10px] text-[#6B6560] truncate">{profile.name}</div>}
            </div>
          </div>
          <SyncBadge />
        </header>

        {showSide && rail && (
          <button
            type="button"
            className="y-reopen"
            onClick={() => setExpanded(true)}
            aria-label="Open sidebar"
          >
            <Menu size={18} />
            <span>Menu</span>
          </button>
        )}

        <div className="y-content y-in">
          {children}
        </div>
      </main>

      {shell === 'phone' && (
        <nav className="y-dock" aria-label="Main">
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
                  <Icon size={20} strokeWidth={active ? 2.3 : 1.7} />
                  <span className="text-[10px] font-semibold tracking-wide">{item.short}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
