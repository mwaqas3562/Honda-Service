"use client";

import { useCallback, type InputHTMLAttributes } from "react";

interface IntegerInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange" | "value"> {
  value: string | number;
  onChange: (value: string) => void;
  /** Allow zero as a valid value (default: true) */
  allowZero?: boolean;
}

/**
 * Strict integer-only input component.
 * - Uses type="text" with inputMode="numeric" for full control
 * - Blocks decimal points, commas, 'e', '+', '-' via keyDown
 * - Strips non-digit characters on paste
 * - Prevents scroll-wheel and arrow-key value changes
 * - Only allows non-negative whole numbers
 */
export default function IntegerInput({
  value,
  onChange,
  allowZero = true,
  className,
  ...rest
}: IntegerInputProps) {
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    // Block decimal, negative, scientific notation, arrows
    if (
      e.key === "." ||
      e.key === "," ||
      e.key === "e" ||
      e.key === "E" ||
      e.key === "-" ||
      e.key === "+" ||
      e.key === "ArrowUp" ||
      e.key === "ArrowDown"
    ) {
      e.preventDefault();
    }
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      // Strip anything that's not a digit
      const cleaned = raw.replace(/\D/g, "");
      onChange(cleaned);
    },
    [onChange]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData("text");
      // Extract only digits from pasted content
      const cleaned = pasted.replace(/\D/g, "");
      if (cleaned) {
        onChange(cleaned);
      }
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

  return (
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
}
