import React from 'react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  color: 'blue' | 'red' | 'green' | 'amber';
}

const colorClasses = {
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  green: 'bg-green-50 text-green-700 border-green-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
};

export const StatsCard: React.FC<StatsCardProps> = ({ title, value, icon, trend, color }) => {
  return (
    <div className={`p-6 rounded-2xl border ${colorClasses[color]} shadow-sm transition-all hover:shadow-md`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium opacity-80">{title}</h3>
        <div className={`p-2 rounded-lg bg-white bg-opacity-60`}>
          {icon}
        </div>
      </div>
      <div className="flex items-end justify-between">
        <div className="text-3xl font-bold">{value}</div>
        {trend && <div className="text-xs font-medium px-2 py-1 rounded-full bg-white bg-opacity-50">{trend}</div>}
      </div>
    </div>
  );
};
