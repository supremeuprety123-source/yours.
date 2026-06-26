import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../contexts/AppContext';
import { Delete } from 'lucide-react';

export default function LockScreen() {
  const { profile, setLocked } = useApp();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (pin.length === 4) {
      if (pin === profile?.pin) {
        setLocked(false);
      } else {
        setError(true);
        setTimeout(() => {
          setPin('');
          setError(false);
        }, 600);
      }
    }
  }, [pin, profile, setLocked]);

  const handleKey = (key: string) => {
    if (pin.length < 4 && !error) {
      setPin(p => p + key);
    }
    if (key === 'del') {
      setPin(p => p.slice(0, -1));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0D0D0D] px-6">
      <div className="mb-12 flex flex-col items-center">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-[#C8A96E]">
          <span className="text-3xl font-bold text-[#C8A96E]" style={{ fontFamily: 'DM Sans, sans-serif' }}>Y</span>
        </div>
        <h1 className="text-2xl font-bold tracking-widest text-[#C8A96E]">YOURS</h1>
        <p className="mt-1 text-xs text-zinc-500">Welcome back, {profile?.name || 'friend'}</p>
      </div>

      <motion.div
        animate={error ? { x: [-10, 10, -10, 10, 0] } : { x: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-8 flex gap-3"
      >
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className={`h-4 w-4 rounded-full border-2 transition-colors ${
              error
                ? 'border-[#C0392B] bg-[#C0392B]'
                : pin.length > i
                ? 'border-[#C8A96E] bg-[#C8A96E]'
                : 'border-zinc-700'
            }`}
          />
        ))}
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-6 text-sm text-[#C0392B]"
          >
            Incorrect PIN. Try again.
          </motion.p>
        )}
      </AnimatePresence>

      <input ref={inputRef} type="hidden" value={pin} onChange={() => {}} />

      <div className="grid grid-cols-3 gap-4">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(key => (
          <button
            key={key}
            onClick={() => handleKey(key)}
            className="h-16 w-16 rounded-full border border-zinc-800 bg-[#1A1A1A] text-xl font-medium text-zinc-200 hover:border-[#C8A96E]/50 hover:bg-zinc-800 transition-all active:scale-95"
          >
            {key}
          </button>
        ))}
        <div className="h-16 w-16" />
        <button
          onClick={() => handleKey('0')}
          className="h-16 w-16 rounded-full border border-zinc-800 bg-[#1A1A1A] text-xl font-medium text-zinc-200 hover:border-[#C8A96E]/50 hover:bg-zinc-800 transition-all active:scale-95"
        >
          0
        </button>
        <button
          onClick={() => handleKey('del')}
          className="h-16 w-16 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-100 transition-colors"
        >
          <Delete size={22} />
        </button>
      </div>
    </div>
  );
}
