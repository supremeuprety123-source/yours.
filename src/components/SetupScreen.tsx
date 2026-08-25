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
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center px-5 overflow-y-auto">
      <div className="absolute inset-0 bg-[#0F0E0C]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(232,184,109,0.12),transparent_50%)]" />

      <div className="relative z-10 w-full max-w-md py-10">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="y-mark mb-4 h-16 w-16 text-2xl">Y</div>
          <h1 className="y-serif text-2xl font-bold tracking-[0.18em] text-[#E8B86D]">YOURS</h1>
          <p className="mt-2 text-sm text-[#8A8478]">Your personal study & life OS</p>
        </div>

        <div className="y-panel p-6 sm:p-7">
          {/* Steps */}
          <div className="flex gap-2 mb-6">
            {[0, 1].map(s => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-colors ${step >= s ? 'bg-[#E8B86D]' : 'bg-[#2A261F]'}`}
              />
            ))}
          </div>

          {step === 0 && (
            <div className="space-y-5">
              <div>
                <h2 className="y-serif text-lg font-bold text-[#F5F0E8] mb-1">About you</h2>
                <p className="text-xs text-[#8A8478] mb-4">This stays on your device first.</p>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#8A8478]">Your name</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Supreme"
                  className="y-input"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#8A8478]">CA Level</label>
                <div className="grid grid-cols-3 gap-2">
                  {LEVELS.map(l => (
                    <button
                      key={l}
                      onClick={() => setLevel(l)}
                      className={`rounded-xl border px-2 py-2.5 text-xs font-semibold transition-all ${
                        level === l
                          ? 'border-[#E8B86D]/40 bg-[#E8B86D]/12 text-[#E8B86D]'
                          : 'border-[rgba(255,236,200,0.08)] text-[#8A8478] hover:border-[rgba(255,236,200,0.15)]'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={() => setStep(1)} disabled={!name.trim()} className="y-btn y-btn-primary w-full">
                Continue
              </button>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="y-serif text-lg font-bold text-[#F5F0E8] mb-1">Protect your space</h2>
                <p className="text-xs text-[#8A8478] mb-4">Optional PIN lock for diary, finance & plans.</p>
              </div>
              <button
                onClick={() => setEnablePin(!enablePin)}
                className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition-all ${
                  enablePin
                    ? 'border-[#E8B86D]/35 bg-[#E8B86D]/10 text-[#E8B86D]'
                    : 'border-[rgba(255,236,200,0.08)] text-[#8A8478]'
                }`}
              >
                {enablePin ? 'PIN lock enabled' : 'PIN lock disabled'}
              </button>
              {enablePin && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#8A8478]">4-digit PIN</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={pin}
                    onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="••••"
                    className="y-input tracking-[0.4em] text-center text-lg"
                  />
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={() => setStep(0)} className="y-btn y-btn-ghost flex-1">Back</button>
                <button
                  onClick={handleFinish}
                  disabled={enablePin && pin.length !== 4}
                  className="y-btn y-btn-primary flex-1"
                >
                  Start
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
