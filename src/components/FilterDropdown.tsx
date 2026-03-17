"use client";

interface FilterDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  allLabel?: string;
}

export default function FilterDropdown({
  value,
  onChange,
  options,
  allLabel = "All",
}: FilterDropdownProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-4 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-500 min-w-[180px]"
    >
      <option value="All">{allLabel}</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}
