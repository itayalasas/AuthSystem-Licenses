import { ReactNode } from 'react';

interface CompactCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

export function CompactCard({ children, className = '', hover = false }: CompactCardProps) {
  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 p-4 ${
        hover ? 'hover:shadow-md hover:border-gray-300 transition-all' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}
