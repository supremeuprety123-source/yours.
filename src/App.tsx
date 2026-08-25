import { AppProvider, useApp } from './contexts/AppContext';
import LockScreen from './components/LockScreen';
import SetupScreen from './components/SetupScreen';
import Layout from './components/Layout';
import Home from './pages/Home';
import Study from './pages/Study';
import Planner from './pages/Planner';
import Finance from './pages/Finance';
import Diary from './pages/Diary';
import Settings from './pages/Settings';

function AppContent() {
  const { loading, needsSetup, locked, activePage } = useApp();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen min-h-[100dvh] bg-[#0F0E0C]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_30%,rgba(232,184,109,0.12),transparent_60%)]" />
        <div className="relative flex flex-col items-center gap-5">
          <div className="y-mark h-[4.25rem] w-[4.25rem] text-2xl">Y</div>
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#E8B86D]/25 border-t-[#E8B86D]" />
        </div>
      </div>
    );
  }

  if (needsSetup) return <SetupScreen />;
  if (locked) return <LockScreen />;

  return (
    <Layout>
      {/* Keep all pages mounted — hidden when inactive — so state (timer, text, etc.) is preserved */}
      <div style={{ display: activePage === 'home' ? 'block' : 'none' }}>
        <Home />
      </div>
      <div style={{ display: activePage === 'study' ? 'block' : 'none' }}>
        <Study />
      </div>
      <div style={{ display: activePage === 'planner' ? 'block' : 'none' }}>
        <Planner />
      </div>
      <div style={{ display: activePage === 'finance' ? 'block' : 'none' }}>
        <Finance />
      </div>
      <div style={{ display: activePage === 'diary' ? 'block' : 'none' }}>
        <Diary />
      </div>
      <div style={{ display: activePage === 'settings' ? 'block' : 'none' }}>
        <Settings />
      </div>
    </Layout>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
