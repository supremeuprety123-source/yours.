import { type ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  message: string;
  action?: ReactNode;
}

export default function EmptyState({ icon, message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {icon && <div className="mb-3 text-zinc-600">{icon}</div>}
      <p className="text-sm text-zinc-500">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
