import React, { useEffect, useRef } from "react";

export type ResetStep = "email" | "otp" | "reset" | "success";

interface ResetPassword3DAnimationProps {
  step: ResetStep;
  size?: number;
}

export const ResetPassword3DAnimation: React.FC<ResetPassword3DAnimationProps> = ({
  step,
  size = 200,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stepRef = useRef<ResetStep>(step);
  stepRef.current = step;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    let angle = 0;

    const render = () => {
      ctx.clearRect(0, 0, size, size);
      const currentStep = stepRef.current;

      angle += currentStep === "otp" ? 0.035 : 0.015;

      const isUnlocked = currentStep === "success";
      const primaryColor = isUnlocked
        ? "#10b981"
        : currentStep === "reset"
        ? "#38bdf8"
        : currentStep === "otp"
        ? "#f59e0b"
        : "#6366f1";

      // 1. Draw outer rotating orbital ring
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = isUnlocked ? "rgba(16, 185, 129, 0.4)" : "rgba(99, 102, 241, 0.3)";
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // 2. Draw middle counter-rotating ring with tick marks
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-angle * 1.4);
      ctx.lineWidth = 1;
      ctx.strokeStyle = isUnlocked ? "rgba(52, 211, 153, 0.6)" : "rgba(56, 189, 248, 0.4)";
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.32, 0, Math.PI * 2);
      ctx.stroke();

      // Orbital nodes on ring
      for (let i = 0; i < 6; i++) {
        const nodeAngle = (i * Math.PI) / 3;
        const nx = Math.cos(nodeAngle) * size * 0.32;
        const ny = Math.sin(nodeAngle) * size * 0.32;
        ctx.fillStyle = primaryColor;
        ctx.beginPath();
        ctx.arc(nx, ny, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // 3. Central 3D Cyber Lock / Shield Glyph
      ctx.save();
      ctx.translate(cx, cy);

      // Lock Body (wireframe tech box)
      const bodyW = 34;
      const bodyH = 26;
      const bodyY = 6;

      ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
      ctx.strokeStyle = primaryColor;
      ctx.lineWidth = 2;
      ctx.shadowColor = primaryColor;
      ctx.shadowBlur = 10;

      // Rounded lock body
      ctx.beginPath();
      ctx.roundRect(-bodyW / 2, bodyY, bodyW, bodyH, 6);
      ctx.fill();
      ctx.stroke();

      // Keyhole
      ctx.fillStyle = primaryColor;
      ctx.beginPath();
      ctx.arc(0, bodyY + 9, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-1.5, bodyY + 9, 3, 6);

      // Shackle
      ctx.lineWidth = 3;
      ctx.beginPath();
      if (isUnlocked) {
        // Open shackle (raised and swung)
        ctx.arc(-5, bodyY - 14, 10, Math.PI, 0, false);
        ctx.moveTo(5, bodyY - 14);
        ctx.lineTo(5, bodyY - 8);
        ctx.moveTo(-15, bodyY - 14);
        ctx.lineTo(-15, bodyY);
      } else {
        // Closed shackle
        ctx.arc(0, bodyY - 8, 11, Math.PI, 0, false);
        ctx.moveTo(-11, bodyY - 8);
        ctx.lineTo(-11, bodyY);
        ctx.moveTo(11, bodyY - 8);
        ctx.lineTo(11, bodyY);
      }
      ctx.stroke();

      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [size]);

  return (
    <div className="relative flex items-center justify-center pointer-events-none select-none">
      <div className="absolute inset-0 bg-cyan-500/10 blur-2xl rounded-full" />
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size }}
        className="relative z-10 block"
      />
    </div>
  );
};
