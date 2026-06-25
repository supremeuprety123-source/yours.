import { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { addRecord } from '../lib/store';
import type { CALevel, Profile } from '../lib/types';

const LEVELS: CALevel[] = ['Foundation', 'Intermediate', 'Final'];

export default function SetupScreen() {
  const { completeSetup } = useApp();
  const [name, setName] = useState('');
  const [level, setLevel] = useState<CALevel>('Foundation');
  const [enablePin, setEnablePin] = useState(true);
  const [pin, setPin] = useState('');
  const [step, setStep] = useState(0);

  const handleFinish = async () => {
    const profile = await addRecord<Profile>('profile', {
      name: name.trim() || 'Friend',
      ca_level: level,
      pin_enabled: enablePin,
      pin: enablePin ? pin : '',
      currency_code: 'NPR',
      currency_symbol: 'रू',
      focus_pomodoro: 25,
      focus_short_break: 5,
      focus_long_break: 15,
      focus_target: 120,
      notifications: { morning: true, streak: true, routine: true, budget: false },
    });
    completeSetup(profile);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0D0D0D] px-6">
      <div className="mb-10 flex flex-col items-center">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-[#C8A96E]">
          <span className="text-3xl font-bold text-[#C8A96E]">Y</span>
        </div>
        <h1 className="text-2xl font-bold tracking-widest text-[#C8A96E]">YOURS</h1>
        <p className="mt-1 text-xs text-zinc-500">Personal Life OS</p>
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-[#1A1A1A] p-6">
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-300">Your Name</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Supreme Uprety"
                className="w-full rounded-xl border border-zinc-700 bg-[#0D0D0D] px-4 py-3 text-zinc-100 outline-none focus:border-[#C8A96E] transition-colors"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-300">CA Level</label>
              <div className="grid grid-cols-3 gap-2">
                {LEVELS.map(l => (
                  <button
                    key={l}
                    onClick={() => setLevel(l)}
                    className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                      level === l
                        ? 'border-[#C8A96E] bg-[#C8A96E]/10 text-[#C8A96E]'
                        : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => setStep(1)}
              disabled={!name.trim()}
              className="w-full rounded-xl bg-[#C8A96E] px-4 py-3 text-sm font-semibold text-black hover:bg-[#d4b87f] transition-colors disabled:opacity-40"
            >
              Continue
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-300">Enable PIN Lock?</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setEnablePin(true)}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                    enablePin ? 'border-[#C8A96E] bg-[#C8A96E]/10 text-[#C8A96E]' : 'border-zinc-700 text-zinc-400'
                  }`}
                >
                  Yes, secure it
                </button>
                <button
                  onClick={() => setEnablePin(false)}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                    !enablePin ? 'border-[#C8A96E] bg-[#C8A96E]/10 text-[#C8A96E]' : 'border-zinc-700 text-zinc-400'
                  }`}
                >
                  No, skip
                </button>
              </div>
            </div>
            {enablePin && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-300">4-Digit PIN</label>
                <input
                  type="tel"
                  maxLength={4}
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full rounded-xl border border-zinc-700 bg-[#0D0D0D] px-4 py-3 text-center text-2xl tracking-[0.5em] text-zinc-100 outline-none focus:border-[#C8A96E] transition-colors"
                />
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setStep(0)}
                className="flex-1 rounded-xl border border-zinc-700 px-4 py-3 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleFinish}
                disabled={enablePin && pin.length !== 4}
                className="flex-1 rounded-xl bg-[#C8A96E] px-4 py-3 text-sm font-semibold text-black hover:bg-[#d4b87f] transition-colors disabled:opacity-40"
              >
                Enter YOURS
              </button>
            </div>
          </div>
        )}
      </div>
      <p className="mt-6 text-xs text-zinc-600">Built for Supreme Uprety · One app, one life</p>
    </div>
  );
}
