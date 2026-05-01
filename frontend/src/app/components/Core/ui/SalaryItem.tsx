

interface SalaryItemProps {
  label: string;
  amount: string | number;
  highlight?: boolean;
}

export default function SalaryItem({ label, amount, highlight }: SalaryItemProps) {
  return (
    <div className={`flex justify-between items-center p-3 rounded-lg ${highlight ? 'bg-primary-light border border-primary' : 'bg-gray-50'}`}>
      <span className="text-gray-600 font-medium">{label}</span>
      <span className={`font-bold ${highlight ? 'text-primary text-lg' : 'text-gray-900'}`}>
        {typeof amount === 'number' ? amount.toLocaleString() : amount} ETB
      </span>
    </div>
  );
}
