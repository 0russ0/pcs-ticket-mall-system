"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import Image from "next/image";

type WheelEntry = {
  studentId: number;
  name: string;
  count: number;
  color: string;
};

type Props = {
  entries: WheelEntry[];
  periodLabel: string;
  onClose: () => void;
};

// Lighten a hex color for alternating shading
function lighten(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, (num >> 16) + amount);
  const g = Math.min(255, ((num >> 8) & 0xff) + amount);
  const b = Math.min(255, (num & 0xff) + amount);
  return `rgb(${r},${g},${b})`;
}

export default function DrawingWheel({ entries, periodLabel, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotationRef = useRef(0);
  const animRef = useRef<number>(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<WheelEntry | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiRef = useRef<HTMLCanvasElement>(null);
  const confettiParticlesRef = useRef<{ x: number; y: number; vx: number; vy: number; color: string; size: number; alpha: number }[]>([]);

  const total = entries.reduce((sum, e) => sum + e.count, 0);

  const drawWheel = useCallback((rotation: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(cx, cy) - 8;

    ctx.clearRect(0, 0, w, h);

    // Wheel shadow
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur = 24;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.restore();

    let startAngle = rotation - Math.PI / 2;

    entries.forEach((entry, idx) => {
      const sliceAngle = (entry.count / total) * 2 * Math.PI;
      const midAngle = startAngle + sliceAngle / 2;

      // Alternate shade slightly for visual separation
      const color = idx % 2 === 0 ? entry.color : lighten(entry.color, 30);

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label — only draw if segment is wide enough
      if (sliceAngle > 0.15) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(midAngle);
        const labelRadius = radius * 0.62;
        ctx.translate(labelRadius, 0);

        // Constrain font size by arc width at label position
        const arcWidth = sliceAngle * labelRadius * 2;
        const fontSize = Math.max(10, Math.min(18, arcWidth / 5, radius / 8));
        ctx.font = `bold ${fontSize}px -apple-system, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // Text shadow for readability
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 4;
        ctx.fillStyle = "white";

        // Truncate if needed
        const maxWidth = radius * 0.55;
        let label = entry.name;
        while (ctx.measureText(label).width > maxWidth && label.length > 3) {
          label = label.slice(0, -1);
        }
        if (label !== entry.name) label += "…";

        // Rotate text so it's readable
        if (midAngle > Math.PI / 2 && midAngle < (3 * Math.PI) / 2) {
          ctx.rotate(Math.PI);
        }
        ctx.fillText(label, 0, 0);

        // Entry count badge
        if (entry.count > 1 && sliceAngle > 0.3) {
          ctx.font = `${Math.max(9, fontSize * 0.7)}px -apple-system, sans-serif`;
          const countLabel = `×${entry.count}`;
          ctx.fillText(countLabel, 0, fontSize + 2);
        }

        ctx.restore();
      }

      startAngle += sliceAngle;
    });

    // Outer ring
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.lineWidth = 4;
    ctx.stroke();

    // Center hub
    const hubRadius = Math.max(18, radius * 0.07);
    ctx.beginPath();
    ctx.arc(cx, cy, hubRadius, 0, 2 * Math.PI);
    ctx.fillStyle = "white";
    ctx.shadowColor = "rgba(0,0,0,0.3)";
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#d1d5db";
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [entries, total]);

  useEffect(() => {
    drawWheel(rotationRef.current);
  }, [drawWheel]);

  function getWinner(rotation: number): WheelEntry {
    // Which segment is under the pointer (top = angle -PI/2)?
    // In wheel's own frame, pointer is at (2PI - rotation%(2PI)) % 2PI
    const norm = (2 * Math.PI - (rotation % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    let cumulative = 0;
    for (const entry of entries) {
      cumulative += (entry.count / total) * 2 * Math.PI;
      if (norm < cumulative) return entry;
    }
    return entries[entries.length - 1];
  }

  function launchConfetti() {
    const canvas = confettiRef.current;
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const colors = ["#f59e0b", "#3b82f6", "#ef4444", "#10b981", "#8b5cf6", "#ec4899"];
    confettiParticlesRef.current = Array.from({ length: 150 }, () => ({
      x: Math.random() * canvas.width,
      y: -20,
      vx: (Math.random() - 0.5) * 4,
      vy: Math.random() * 4 + 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 8 + 4,
      alpha: 1,
    }));
    setShowConfetti(true);
    animateConfetti();
  }

  function animateConfetti() {
    const canvas = confettiRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    confettiParticlesRef.current = confettiParticlesRef.current.filter((p) => p.alpha > 0.01);
    confettiParticlesRef.current.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1;
      if (p.y > canvas.height) { p.alpha -= 0.05; }
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size * 0.5);
    });
    ctx.globalAlpha = 1;
    if (confettiParticlesRef.current.length > 0) {
      requestAnimationFrame(animateConfetti);
    } else {
      setShowConfetti(false);
    }
  }

  function spin() {
    if (spinning || entries.length === 0) return;
    setSpinning(true);
    setWinner(null);

    const extra = Math.random() * 2 * Math.PI;
    const totalSpin = 20 * 2 * Math.PI + extra; // plenty of rotations
    const fullSpeedMs = 8000;  // spin at full speed for 8 seconds
    const slowdownMs = 7000;   // then decelerate over 7 seconds
    const duration = fullSpeedMs + slowdownMs; // 15 seconds total
    const startTime = performance.now();
    const startRot = rotationRef.current;

    // How much angle is covered at full speed (linear portion)
    const fullSpeedAngle = totalSpin * (fullSpeedMs / duration);
    const slowdownAngle = totalSpin - fullSpeedAngle;

    function animate(now: number) {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);

      let eased: number;
      if (elapsed <= fullSpeedMs) {
        // Linear — full speed
        eased = (elapsed / duration);
      } else {
        // Ease out quart over the slowdown portion
        const slowT = (elapsed - fullSpeedMs) / slowdownMs;
        const slowEased = 1 - Math.pow(1 - Math.min(slowT, 1), 4);
        eased = fullSpeedMs / duration + (slowdownAngle / totalSpin) * slowEased;
      }

      rotationRef.current = startRot + totalSpin * eased;
      drawWheel(rotationRef.current);

      if (t < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        const w = getWinner(rotationRef.current);
        setWinner(w);
        setSpinning(false);
        setTimeout(launchConfetti, 300);
      }
    }

    animRef.current = requestAnimationFrame(animate);
  }

  // Cleanup on unmount
  useEffect(() => () => cancelAnimationFrame(animRef.current), []);

  // Canvas size: use the smaller of viewport dimensions
  const canvasSize = typeof window !== "undefined" ? Math.min(window.innerWidth * 0.7, window.innerHeight * 0.7, 620) : 500;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-950/95 backdrop-blur-sm">
      {/* Confetti canvas */}
      {showConfetti && (
        <canvas ref={confettiRef} className="fixed inset-0 pointer-events-none z-60" style={{ width: "100vw", height: "100vh" }} />
      )}

      {/* Close */}
      <button onClick={onClose} className="absolute top-4 right-5 text-white text-4xl leading-none opacity-70 hover:opacity-100 z-10">&times;</button>

      {/* Title */}
      <div className="flex items-center gap-3 mb-4">
        <Image src="/golden-bulldog.png" alt="" width={40} height={40} />
        <h2 className="text-white text-2xl font-bold">Golden Bulldog Drawing — {periodLabel}</h2>
        <Image src="/golden-bulldog.png" alt="" width={40} height={40} />
      </div>

      {/* Wheel + pointer */}
      <div className="relative flex items-center justify-center" style={{ width: canvasSize + 20, height: canvasSize + 20 }}>
        {/* Pointer arrow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10 drop-shadow-lg" style={{ marginTop: -2 }}>
          <svg width="32" height="40" viewBox="0 0 32 40">
            <polygon points="16,38 2,4 30,4" fill="#ef4444" stroke="white" strokeWidth="2" />
          </svg>
        </div>

        <canvas
          ref={canvasRef}
          width={canvasSize}
          height={canvasSize}
          className="rounded-full"
        />
      </div>

      {/* Controls */}
      <div className="mt-6 flex flex-col items-center gap-4">
        {!winner && (
          <button
            onClick={spin}
            disabled={spinning}
            className="px-12 py-4 rounded-2xl text-xl font-bold text-white shadow-2xl transition-all active:scale-95"
            style={{
              background: spinning ? "#6b7280" : "linear-gradient(135deg, #f59e0b, #d97706)",
              cursor: spinning ? "not-allowed" : "pointer",
            }}
          >
            {spinning ? "Spinning…" : "🎡  SPIN!"}
          </button>
        )}

        {winner && (
          <div className="text-center animate-bounce-once">
            <div className="bg-amber-400 text-gray-900 rounded-2xl px-10 py-5 shadow-2xl">
              <p className="text-lg font-bold uppercase tracking-wide mb-1">🎉 Winner!</p>
              <p className="text-4xl font-black">{winner.name}</p>
              <p className="text-sm mt-2 opacity-75">
                {winner.count} Golden Bulldog{winner.count !== 1 ? "s" : ""} = {winner.count} {winner.count !== 1 ? "entries" : "entry"}
              </p>
            </div>
            <button
              onClick={() => { setWinner(null); setSpinning(false); }}
              className="mt-4 px-8 py-3 rounded-xl text-white font-bold bg-white/20 hover:bg-white/30 transition-colors"
            >
              Spin Again
            </button>
          </div>
        )}
      </div>

      {/* Entry list at bottom */}
      <div className="absolute bottom-4 left-4 right-4 flex flex-wrap justify-center gap-2 opacity-60">
        {entries.map((e) => (
          <span key={e.studentId} className="text-white text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: e.color }}>
            {e.name} ×{e.count}
          </span>
        ))}
      </div>
    </div>
  );
}
