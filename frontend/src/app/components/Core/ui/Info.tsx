import React from 'react';

interface InfoProps {
  label: string;
  value: React.ReactNode;
  className?: string;
}

export default function Info({ label, value, className = "" }: InfoProps) {
  return (
    <div className={className}>
      <p className="text-sm font-medium text-gray-400 mb-1">{label}</p>
      <p className="text-base font-semibold text-gray-900 break-words">{value}</p>
    </div>
  );
}
