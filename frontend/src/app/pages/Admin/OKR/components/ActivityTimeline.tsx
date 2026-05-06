type ActivityItem = {
  id: string;
  title: string;
  time: string;
};

type Props = {
  items: ActivityItem[];
};

export default function ActivityTimeline({ items }: Props) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm">
      <h3 className="font-semibold text-gray-800 mb-4 capitalize">Activity</h3>

      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.id} className="flex gap-3">
            <div className="w-2 h-2 bg-primary rounded-full mt-2" />

            <div>
              <p className="text-sm text-gray-700">{item.title}</p>
              <p className="text-xs text-gray-400">{item.time}</p>
            </div>
          </div>
        ))}
      </div>

      {items.length === 0 && (
        <p className="text-sm text-gray-400">No activity yet</p>
      )}
    </div>
  );
}
