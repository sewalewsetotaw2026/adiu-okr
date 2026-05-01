import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'error' | 'neutral' | 'outline';
  className?: string;
}

export default function Badge({ children, variant = 'neutral', className = '' }: BadgeProps) {
  const styles = {
    success: 'bg-green-100 text-green-700 border-green-200',
    warning: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    error: 'bg-red-100 text-red-700 border-red-200',
    neutral: 'bg-gray-100 text-gray-700 border-gray-200',
    outline: 'bg-white text-gray-600 border-gray-300',
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles[variant]} ${className}`}>
      {children}
    </span>
  );
}
