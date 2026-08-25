import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../contexts/AppContext';
import { Delete, RefreshCw } from 'lucide-react';

export default function LockScreen() {
  const { profile, unlockAndSync } = useApp();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (pin.length === 4 && !unlocking) {
      if (pin === profile?.pin) {
        setUnlocking(true);
        unlockAndSync().finally(() => setUnlocking(false));
      } else {
        setError(true);
        setTimeout(() => { setPin(''); setError(false); }, 600);
      }
    }
  }, [pin, profile, unlockAndSync, unlocking]);

  const handleKey = (key: string) => {
    if (unlocking) return;
    if (pin.length < 4 && !error) setPin(p => p + key);
    if (key === 'del') setPin(p => p.slice(0, -1));
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6 overflow-hidden">
      <div className="absolute inset-0 bg-[#0F0E0C]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_50%_-10%,rgba(232,184,109,0.14),transparent_55%)]" />
      <div className="absolute bottom-[-10%] left-1/2 -translate-x-1/2 h-72 w-72 rounded-full bg-[#E8B86D]/[0.05] blur-3xl" />

      <div className="relative z-10 mb-12 flex flex-col items-center">
        <div className="y-mark y-breathe mb-5 h-[4.75rem] w-[4.75rem] text-3xl">Y</div>
        <h1 className="y-serif text-2xl font-bold tracking-[0.2em] text-[#E8B86D]">YOURS</h1>
        <p className="mt-2.5 text-sm text-[#8A8478]">
          {profile?.name ? `Welcome back, ${profile.name}` : 'Welcome back'}
        </p>
      </div>

      {unlocking ? (
        <div className="relative z-10 flex flex-col items-center gap-3 mb-12">
          <RefreshCw size={22} className="text-[#E8B86D] animate-spin" />
          <p className="text-sm text-[#8A8478]">Bringing your data up to date…</p>
        </div>
      ) : (
        <>
          <motion.div
            animate={error ? { x: [-10, 10, -10, 10, 0] } : { x: 0 }}
            transition={{ duration: 0.4 }}
            className="relative z-10 mb-9 flex gap-3.5"
          >
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                className={`h-3.5 w-3.5 rounded-full border-2 transition-all duration-200 ${
                  error
                    ? 'border-[#E07A5F] bg-[#E07A5F] scale-110'
                    : pin.length > i
                    ? 'border-[#E8B86D] bg-[#E8B86D] shadow-[0_0_14px_rgba(232,184,109,0.55)] scale-110'
                    : 'border-[#3D3830] bg-transparent'
                }`}
              />
            ))}
          </motion.div>
          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="relative z-10 mb-6 text-sm text-[#E07A5F]"
              >
                Incorrect PIN
              </motion.p>
            )}
          </AnimatePresence>
        </>
      )}

      <input ref={inputRef} type="hidden" value={pin} readOnly />

      <div className="relative z-10 grid grid-cols-3 gap-3.5">
        {['1','2','3','4','5','6','7','8','9'].map(key => (
          <button
            key={key}
            onClick={() => handleKey(key)}
            disabled={unlocking}
            className="h-[4.35rem] w-[4.35rem] rounded-full border border-[rgba(255,236,200,0.08)] bg-[rgba(255,236,200,0.03)] text-xl font-medium text-[#F5F0E8] hover:border-[#E8B86D]/30 hover:bg-[rgba(232,184,109,0.08)] active:scale-95 transition-all duration-150 disabled:opacity-40"
          >
            {key}
          </button>
        ))}
        <div className="h-[4.35rem] w-[4.35rem]" />
        <button
          onClick={() => handleKey('0')}
          disabled={unlocking}
          className="h-[4.35rem] w-[4.35rem] rounded-full border border-[rgba(255,236,200,0.08)] bg-[rgba(255,236,200,0.03)] text-xl font-medium text-[#F5F0E8] hover:border-[#E8B86D]/30 hover:bg-[rgba(232,184,109,0.08)] active:scale-95 transition-all duration-150 disabled:opacity-40"
        >
          0
        </button>
        <button
          onClick={() => handleKey('del')}
          disabled={unlocking}
          className="h-[4.35rem] w-[4.35rem] rounded-full flex items-center justify-center text-[#8A8478] hover:text-[#F5F0E8] hover:bg-white/[0.04] transition-colors disabled:opacity-40"
        >
          <Delete size={22} />
        </button>
      </div>

      <p className="relative z-10 mt-14 text-[11px] tracking-[0.12em] uppercase text-[#5C574F]">
        Enter PIN
      </p>
    </div>
  );
}
