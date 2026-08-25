import { type ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: string;
}

export default function Modal({ open, onClose, title, children, maxWidth = 'max-w-lg' }: ModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-5">
      <div className="absolute inset-0 bg-[#0A0908]/75 backdrop-blur-[6px]" onClick={onClose} />
      <div
        className={`relative w-full ${maxWidth} max-h-[92dvh] sm:max-h-[88vh] overflow-y-auto rounded-t-[1.75rem] sm:rounded-[1.35rem] border border-[rgba(255,236,200,0.1)] bg-[#1A1712] shadow-[0_-12px_48px_rgba(0,0,0,0.55)]`}
        role="dialog"
        aria-modal
      >
        <div className="sm:hidden flex justify-center pt-3">
          <div className="h-1 w-11 rounded-full bg-[#3D3830]" />
        </div>
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[rgba(255,236,200,0.06)] bg-[#1A1712]/95 backdrop-blur-md px-5 py-4">
          <h2 className="y-serif text-[1.05rem] font-bold text-[#F5F0E8] tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-[#8A8478] hover:bg-white/[0.05] hover:text-[#F5F0E8] transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5 pb-9 sm:pb-5">{children}</div>
      </div>
    </div>
  );
}
