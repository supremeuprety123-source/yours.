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
        <div className="rounded-2xl border border-[#E07A5F]/25 bg-[#E07A5F]/10 p-3.5">
          <AlertTriangle size={26} className="text-[#E07A5F]" strokeWidth={1.75} />
        </div>
        <p className="text-sm text-[#A8A29A] leading-relaxed">{message}</p>
        <div className="flex gap-3 w-full mt-1">
          <button onClick={onCancel} className="y-btn y-btn-ghost flex-1">Cancel</button>
          <button onClick={onConfirm} className="y-btn y-btn-danger flex-1">{confirmText}</button>
        </div>
      </div>
    </Modal>
  );
}
