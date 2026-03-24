"use client";

import { useCallback, type InputHTMLAttributes } from "react";
import { Minus, Plus } from "lucide-react";

interface IntegerInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange" | "value"> {
  value: string | number;
  onChange: (value: string) => void;
  /** Allow zero as a valid value (default: true) */
  allowZero?: boolean;
  /** Show +/- stepper buttons around the input */
  showStepper?: boolean;
  /** Minimum value for stepper (default: 1) */
  min?: number;
  /** Maximum value for stepper (no limit if omitted) */
  max?: number;
  /** Step size for stepper buttons (default: 1) */
  step?: number;
}

export default function IntegerInput({
  value,
  onChange,
  allowZero = true,
  showStepper,
  min = 1,
  max,
  step = 1,
  className,
  ...rest
}: IntegerInputProps) {
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if ([".", ",", "e", "E", "-", "+", "ArrowUp", "ArrowDown"].includes(e.key)) {
      e.preventDefault();
    }
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value.replace(/\D/g, ""));
    },
    [onChange]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const cleaned = e.clipboardData.getData("text").replace(/\D/g, "");
      if (cleaned) onChange(cleaned);
    },
    [onChange]
  );

  const handleWheel = useCallback((e: React.WheelEvent<HTMLInputElement>) => {
    (e.target as HTMLElement).blur();
  }, []);

  const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  }, []);

  const displayValue = value === 0 && !allowZero ? "" : String(value ?? "");
  const numVal = parseInt(String(value), 10) || 0;

  const handleDecrement = useCallback(() => {
    onChange(String(Math.max(min, numVal - step)));
  }, [numVal, min, step, onChange]);

  const handleIncrement = useCallback(() => {
    const next = max !== undefined ? Math.min(max, numVal + step) : numVal + step;
    onChange(String(next));
  }, [numVal, max, step, onChange]);

  const inputEl = (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={displayValue}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      onWheel={handleWheel}
      onFocus={handleFocus}
      className={className}
      autoComplete="off"
      {...rest}
    />
  );

  if (!showStepper) return inputEl;

  return (
    <div className="inline-flex items-center gap-0">
      <button
        type="button"
        onClick={handleDecrement}
        disabled={numVal <= min}
        className="flex items-center justify-center w-7 h-7 rounded-md border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        tabIndex={-1}
      >
        <Minus className="w-3 h-3" />
      </button>
      {inputEl}
      <button
        type="button"
        onClick={handleIncrement}
        disabled={max !== undefined && numVal >= max}
        className="flex items-center justify-center w-7 h-7 rounded-md border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        tabIndex={-1}
      >
        <Plus className="w-3 h-3" />
      </button>
    </div>
  );
}
