import { type ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  message: string;
  action?: ReactNode;
}

export default function EmptyState({ icon, message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {icon && (
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[rgba(255,236,200,0.08)] bg-[rgba(0,0,0,0.2)] text-[#6B6560]">
          {icon}
        </div>
      )}
      <p className="text-sm text-[#8A8478] leading-relaxed max-w-[16rem]">{message}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
