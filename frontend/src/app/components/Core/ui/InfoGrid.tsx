interface InfoGridProps {
  children: React.ReactNode;
  cols?: number;
  className?: string;
}

export default function InfoGrid({ children, cols, className = "" }: InfoGridProps) {
  const gridClasses = cols === 1 
    ? "grid grid-cols-1 gap-y-4" 
    : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-6 gap-x-8";
    
  return <div className={`${gridClasses} ${className}`}>{children}</div>;
}
