import React, { useEffect, useState } from "react";

interface AnimatedNumberProps {
  value: number;
  duration?: number; // ms
  decimals?: number;
  suffix?: string;
  className?: string;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  duration = 1000,
  decimals,
  suffix = "",
  className = "",
}) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const startValue = displayValue;
    const difference = value - startValue;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // easeOutExpo
      const easedProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = startValue + difference * easedProgress;
      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        setDisplayValue(value);
      }
    };

    requestAnimationFrame(step);
  }, [value, duration]);

  const renderFormatted = () => {
    if (decimals !== undefined) {
      if (decimals === 0) {
        return Math.round(displayValue).toString();
      }
      // If target value is an integer (e.g. 100, 92), display cleanly as integer
      if (Number.isInteger(value) && Math.abs(displayValue - value) < 0.05) {
        return Math.round(displayValue).toString();
      }
      return displayValue.toFixed(decimals);
    }
    // Default smart formatting: whole numbers display without decimal
    if (Number.isInteger(value) && Math.abs(displayValue - value) < 0.05) {
      return Math.round(displayValue).toString();
    }
    return displayValue.toFixed(1);
  };

  return (
    <span className={`font-mono tracking-tight ${className}`}>
      {renderFormatted()}
      {suffix}
    </span>
  );
};
