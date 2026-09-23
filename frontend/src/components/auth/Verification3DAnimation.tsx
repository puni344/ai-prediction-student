import React, { useEffect, useRef } from "react";

export type VerificationStatus = "idle" | "verifying" | "success" | "error";

interface Verification3DAnimationProps {
  status: VerificationStatus;
  size?: number;
}

interface Node3D {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  originX: number;
  originY: number;
  originZ: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  color: string;
}

export const Verification3DAnimation: React.FC<Verification3DAnimationProps> = ({
  status,
  size = 220,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const statusRef = useRef<VerificationStatus>(status);
  statusRef.current = status;

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

    const numNodes = 48;
    const nodes: Node3D[] = [];

    // Precalculate target checkmark positions
    // Checkmark has two segments:
    // Seg 1 (down-right): (-36, 0) -> (-8, 28)
    // Seg 2 (up-right): (-8, 28) -> (42, -32)
    const seg1Count = 18;
    const seg2Count = 30;

    for (let i = 0; i < numNodes; i++) {
      // Random position in 3D sphere
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const r = 40 + Math.random() * 35;
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);

      // Target checkmark point
      let tx = 0;
      let ty = 0;
      let tz = (Math.random() - 0.5) * 10;

      if (i < seg1Count) {
        const t = i / (seg1Count - 1);
        tx = -36 + t * 28;
        ty = 0 + t * 28;
      } else {
        const t = (i - seg1Count) / (seg2Count - 1);
        tx = -8 + t * 50;
        ty = 28 - t * 60;
      }

      nodes.push({
        x,
        y,
        z,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        vz: (Math.random() - 0.5) * 0.4,
        originX: x,
        originY: y,
        originZ: z,
        targetX: tx,
        targetY: ty,
        targetZ: tz,
        color: "#6366f1",
      });
    }

    let angleX = 0;
    let angleY = 0;
    const cx = size / 2;
    const cy = size / 2;
    const fov = 180;
    let morphProgress = 0;

    const render = () => {
      ctx.clearRect(0, 0, size, size);

      const currentStatus = statusRef.current;

      // Rotation speed based on status
      let rotSpeedY = 0.008;
      let rotSpeedX = 0.004;
      if (currentStatus === "verifying") {
        rotSpeedY = 0.035;
        rotSpeedX = 0.015;
      } else if (currentStatus === "success") {
        rotSpeedY = 0.002;
        rotSpeedX = 0.001;
      }

      angleY += rotSpeedY;
      angleX += rotSpeedX;

      const cosY = Math.cos(angleY);
      const sinY = Math.sin(angleY);
      const cosX = Math.cos(angleX);
      const sinX = Math.sin(angleX);

      // Smooth morph progress
      if (currentStatus === "success") {
        morphProgress = Math.min(1, morphProgress + 0.035);
      } else {
        morphProgress = Math.max(0, morphProgress - 0.05);
      }

      // Projected points
      const projected: { px: number; py: number; scale: number; alpha: number; node: Node3D }[] = [];

      nodes.forEach((node) => {
        // Position interpolation: sphere vs checkmark
        let curX = node.originX;
        let curY = node.originY;
        let curZ = node.originZ;

        if (currentStatus === "verifying") {
          // Jitter and pulse toward center
          node.originX += node.vx * 1.5;
          node.originY += node.vy * 1.5;
          node.originZ += node.vz * 1.5;
          curX = node.originX * 0.88 + Math.sin(Date.now() * 0.01 + node.originY) * 2;
          curY = node.originY * 0.88 + Math.cos(Date.now() * 0.01 + node.originX) * 2;
          curZ = node.originZ * 0.88;
        } else if (currentStatus === "error") {
          // Disperse outward with red jitter
          curX = node.originX * 1.25 + (Math.random() - 0.5) * 4;
          curY = node.originY * 1.25 + (Math.random() - 0.5) * 4;
          curZ = node.originZ * 1.25;
        } else if (morphProgress > 0) {
          // Morph to checkmark
          curX = node.originX * (1 - morphProgress) + node.targetX * morphProgress;
          curY = node.originY * (1 - morphProgress) + node.targetY * morphProgress;
          curZ = node.originZ * (1 - morphProgress) + node.targetZ * morphProgress;
        } else {
          // Normal idle drifting
          node.originX += node.vx;
          node.originY += node.vy;
          node.originZ += node.vz;
          // Boundary bounce
          const d = Math.sqrt(node.originX ** 2 + node.originY ** 2 + node.originZ ** 2);
          if (d > 75) {
            node.vx *= -1;
            node.vy *= -1;
            node.vz *= -1;
          }
          curX = node.originX;
          curY = node.originY;
          curZ = node.originZ;
        }

        // 3D rotation
        let x1 = curX * cosY + curZ * sinY;
        let z1 = -curX * sinY + curZ * cosY;
        let y1 = curY * cosX - z1 * sinX;
        let z2 = curY * sinX + z1 * cosX;

        // When morphing to checkmark, face forward slightly for clarity
        if (morphProgress > 0.5) {
          z2 = z2 * (1 - morphProgress * 0.7);
        }

        const scale = fov / (fov + z2);
        const px = cx + x1 * scale;
        const py = cy + y1 * scale;
        const alpha = Math.max(0.2, Math.min(1, (z2 + 100) / 200));

        projected.push({ px, py, scale, alpha, node });
      });

      // Draw connecting lines between close points (constellation effect)
      if (morphProgress < 0.7) {
        ctx.lineWidth = 0.7;
        for (let i = 0; i < projected.length; i++) {
          for (let j = i + 1; j < projected.length; j++) {
            const p1 = projected[i];
            const p2 = projected[j];
            const dx = p1.px - p2.px;
            const dy = p1.py - p2.py;
            const dist = Math.sqrt(dx * dx + dy * dy);

            const maxDist = currentStatus === "verifying" ? 38 : 32;
            if (dist < maxDist) {
              const lineAlpha = (1 - dist / maxDist) * 0.35 * Math.min(p1.alpha, p2.alpha);
              ctx.strokeStyle =
                currentStatus === "error"
                  ? `rgba(244, 63, 94, ${lineAlpha})`
                  : currentStatus === "verifying"
                  ? `rgba(56, 189, 248, ${lineAlpha * 1.5})`
                  : `rgba(99, 102, 241, ${lineAlpha})`;
              ctx.beginPath();
              ctx.moveTo(p1.px, p1.py);
              ctx.lineTo(p2.px, p2.py);
              ctx.stroke();
            }
          }
        }
      }

      // Draw checkmark glow line when morphing into success
      if (morphProgress > 0.3) {
        ctx.save();
        ctx.strokeStyle = `rgba(16, 185, 129, ${morphProgress * 0.9})`;
        ctx.lineWidth = 3.5 * morphProgress;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.shadowColor = "rgba(16, 185, 129, 0.8)";
        ctx.shadowBlur = 12 * morphProgress;

        ctx.beginPath();
        for (let i = 0; i < projected.length; i++) {
          const p = projected[i];
          if (i === 0) ctx.moveTo(p.px, p.py);
          else ctx.lineTo(p.px, p.py);
        }
        ctx.stroke();
        ctx.restore();
      }

      // Draw individual nodes
      projected.forEach((p) => {
        const radius = Math.max(1.2, 2.2 * p.scale);
        ctx.save();
        ctx.beginPath();
        ctx.arc(p.px, p.py, radius, 0, Math.PI * 2);

        if (currentStatus === "success") {
          ctx.fillStyle = `rgba(52, 211, 153, ${p.alpha})`;
          ctx.shadowColor = "#10b981";
          ctx.shadowBlur = 8;
        } else if (currentStatus === "verifying") {
          ctx.fillStyle = `rgba(56, 189, 248, ${p.alpha})`;
          ctx.shadowColor = "#38bdf8";
          ctx.shadowBlur = 6;
        } else if (currentStatus === "error") {
          ctx.fillStyle = `rgba(244, 63, 94, ${p.alpha})`;
          ctx.shadowColor = "#f43f5e";
          ctx.shadowBlur = 6;
        } else {
          ctx.fillStyle = `rgba(129, 140, 248, ${p.alpha})`;
          ctx.shadowColor = "#6366f1";
          ctx.shadowBlur = 4;
        }
        ctx.fill();
        ctx.restore();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [size]);

  return (
    <div className="relative flex items-center justify-center pointer-events-none select-none">
      <div className="absolute inset-0 bg-indigo-500/10 blur-2xl rounded-full" />
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size }}
        className="relative z-10 block"
      />
    </div>
  );
};
