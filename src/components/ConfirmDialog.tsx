import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
}

export default function ConfirmDialog({ open, title, message, onConfirm, onCancel, confirmText = 'Delete' }: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} title={title} maxWidth="max-w-sm">
      <div className="flex flex-col items-center text-center gap-4">
        <div className="rounded-full bg-[#C0392B]/10 p-3">
          <AlertTriangle size={28} className="text-[#C0392B]" />
        </div>
        <p className="text-zinc-300 text-sm">{message}</p>
        <div className="flex gap-3 w-full mt-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-[#C0392B] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#a33224] transition-colors"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}
