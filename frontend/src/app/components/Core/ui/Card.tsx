import React from 'react';

interface CardProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}

export default function Card({ title, icon, children, className = "", action }: CardProps) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6 border-b border-gray-50 pb-4">
        <div className="flex items-center gap-3 text-gray-800">
          {icon && <span className="text-primary text-xl">{icon}</span>}
          <h2 className="text-lg font-bold">{title}</h2>
        </div>
        {action}
      </div>
      <div>{children}</div>
    </div>
  );
}
