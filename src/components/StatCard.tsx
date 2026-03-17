import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
}

export default function StatCard({
  title,
  value,
  icon: Icon,
  change,
  changeType = "neutral",
}: StatCardProps) {
  const changeColor = {
    positive: "text-green-600",
    negative: "text-red-600",
    neutral: "text-gray-500",
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {change && (
            <p className={`text-sm mt-1 ${changeColor[changeType]}`}>
              {change}
            </p>
          )}
        </div>
        <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center">
          <Icon className="w-6 h-6 text-red-600" />
        </div>
      </div>
    </div>
  );
}
