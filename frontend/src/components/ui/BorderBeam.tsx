import React from "react";

interface BorderBeamProps {
  duration?: number;
  borderWidth?: number;
  colorFrom?: string;
  colorTo?: string;
  className?: string;
}

export const BorderBeam: React.FC<BorderBeamProps> = ({
  duration = 8,
  borderWidth = 1.5,
  colorFrom = "#6366f1",
  colorTo = "#06b6d4",
  className = "",
}) => {
  return (
    <div
      style={
        {
          "--duration": `${duration}s`,
          "--color-from": colorFrom,
          "--color-to": colorTo,
        } as React.CSSProperties
      }
      className={`pointer-events-none absolute inset-0 rounded-[inherit] border border-transparent [mask-clip:padding-box,border-box] [mask-composite:intersect] [mask-image:linear-gradient(transparent,transparent),linear-gradient(white,white)] ${className}`}
    >
      <div
        style={{
          width: "140px",
          height: "140px",
          position: "absolute",
          top: "0",
          left: "0",
          transform: "translate(-50%, -50%)",
          background: `radial-gradient(circle, ${colorFrom} 0%, ${colorTo} 40%, transparent 70%)`,
          animation: `beam-rotate ${duration}s linear infinite`,
        }}
      />
    </div>
  );
};
