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
      <div className="flex items-center justify-center min-h-screen bg-[#0D0D0D]">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-[#C8A96E]">
            <span className="text-2xl font-bold text-[#C8A96E]">Y</span>
          </div>
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#C8A96E] border-t-transparent" />
        </div>
      </div>
    );
  }

  if (needsSetup) return <SetupScreen />;
  if (locked) return <LockScreen />;

  return (
    <Layout>
      {activePage === 'home' && <Home />}
      {activePage === 'study' && <Study />}
      {activePage === 'planner' && <Planner />}
      {activePage === 'finance' && <Finance />}
      {activePage === 'diary' && <Diary />}
      {activePage === 'settings' && <Settings />}
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
