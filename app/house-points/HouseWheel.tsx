"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { TEAMS, TEAM_COLORS } from "@/lib/leaderboard";

type Entry = { house: string; color: string };

const ENTRIES: Entry[] = TEAMS.map((house) => ({ house, color: TEAM_COLORS[house] ?? "#6366f1" }));
const SLICE = (2 * Math.PI) / ENTRIES.length;

function lighten(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, (num >> 16) + amount);
  const g = Math.min(255, ((num >> 8) & 0xff) + amount);
  const b = Math.min(255, (num & 0xff) + amount);
  return `rgb(${r},${g},${b})`;
}

type Props = {
  points: number;
  onWinner: (house: string) => Promise<void>;
  onClose: () => void;
};

export default function HouseWheel({ points, onWinner, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotationRef = useRef(0);
  const animRef = useRef<number>(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<Entry | null>(null);
  const [awarding, setAwarding] = useState(false);
  const [awarded, setAwarded] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiRef = useRef<HTMLCanvasElement>(null);
  const confettiParticlesRef = useRef<{ x: number; y: number; vx: number; vy: number; color: string; size: number; alpha: number }[]>([]);

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

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur = 24;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.restore();

    let startAngle = rotation - Math.PI / 2;

    ENTRIES.forEach((entry, idx) => {
      const midAngle = startAngle + SLICE / 2;
      const color = idx % 2 === 0 ? entry.color : lighten(entry.color, 30);

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, startAngle + SLICE);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(midAngle);
      const labelRadius = radius * 0.6;
      ctx.translate(labelRadius, 0);

      const fontSize = Math.max(11, Math.min(18, radius / 9));
      ctx.font = `bold ${fontSize}px -apple-system, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 4;
      ctx.fillStyle = "white";

      const maxWidth = radius * 0.75;
      const words = entry.house.split(" ");
      const lines: string[] = [];
      let current = "";
      for (const word of words) {
        const test = current ? `${current} ${word}` : word;
        if (ctx.measureText(test).width > maxWidth && current) {
          lines.push(current);
          current = word;
        } else {
          current = test;
        }
      }
      if (current) lines.push(current);

      if (midAngle > Math.PI / 2 && midAngle < (3 * Math.PI) / 2) ctx.rotate(Math.PI);
      lines.forEach((line, i) => {
        ctx.fillText(line, 0, (i - (lines.length - 1) / 2) * (fontSize + 2));
      });

      ctx.restore();

      startAngle += SLICE;
    });

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.lineWidth = 4;
    ctx.stroke();

    const hubRadius = Math.max(28, radius * 0.11);
    ctx.beginPath();
    ctx.arc(cx, cy, hubRadius, 0, 2 * Math.PI);
    ctx.fillStyle = "white";
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#d1d5db";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#1f2937";
    ctx.font = `bold ${Math.max(14, hubRadius * 0.6)}px -apple-system, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🏠", cx, cy);
  }, []);

  useEffect(() => {
    drawWheel(rotationRef.current);
  }, [drawWheel]);

  function getWinner(rotation: number): Entry {
    const norm = (2 * Math.PI - (rotation % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const idx = Math.min(ENTRIES.length - 1, Math.floor(norm / SLICE));
    return ENTRIES[idx];
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
      if (p.y > canvas.height) p.alpha -= 0.05;
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

  async function handleWinner(w: Entry) {
    setWinner(w);
    setSpinning(false);
    setTimeout(launchConfetti, 300);
    setAwarding(true);
    try {
      await onWinner(w.house);
      setAwarded(true);
    } finally {
      setAwarding(false);
    }
  }

  function spin() {
    if (spinning || winner) return;
    setSpinning(true);
    setAwarded(false);

    const extra = Math.random() * 2 * Math.PI;
    // Fewer full rotations than before (10 vs 20) so the fast phase reads as
    // genuinely slower, not just shorter — packing the old rotation count into
    // a shorter window would have spun faster, the opposite of what's wanted.
    const totalSpin = 10 * 2 * Math.PI + extra;
    const fullSpeedMs = 4000;
    const slowdownMs = 6000;
    const duration = fullSpeedMs + slowdownMs; // 10s total
    const startTime = performance.now();
    const startRot = rotationRef.current;

    const fullSpeedAngle = totalSpin * (fullSpeedMs / duration);
    const slowdownAngle = totalSpin - fullSpeedAngle;

    function animate(now: number) {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);

      let eased: number;
      if (elapsed <= fullSpeedMs) {
        eased = elapsed / duration;
      } else {
        const slowT = (elapsed - fullSpeedMs) / slowdownMs;
        // Higher exponent than before (5 vs 4) so the last stretch is a longer,
        // more visible creep toward the winning segment instead of stopping
        // relatively briskly.
        const slowEased = 1 - Math.pow(1 - Math.min(slowT, 1), 5);
        eased = fullSpeedMs / duration + (slowdownAngle / totalSpin) * slowEased;
      }

      rotationRef.current = startRot + totalSpin * eased;
      drawWheel(rotationRef.current);

      if (t < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        handleWinner(getWinner(rotationRef.current));
      }
    }

    animRef.current = requestAnimationFrame(animate);
  }

  useEffect(() => () => cancelAnimationFrame(animRef.current), []);

  const [canvasSize, setCanvasSize] = useState(400);
  useEffect(() => {
    function calcSize() {
      const maxH = window.innerHeight - 220;
      const maxW = window.innerWidth - 32;
      setCanvasSize(Math.max(220, Math.min(maxH, maxW, 580)));
    }
    calcSize();
    window.addEventListener("resize", calcSize);
    return () => window.removeEventListener("resize", calcSize);
  }, []);

  useEffect(() => {
    drawWheel(rotationRef.current);
  }, [canvasSize, drawWheel]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-gray-950/95 backdrop-blur-sm py-3 px-4 overflow-hidden">
      {showConfetti && (
        <canvas ref={confettiRef} className="fixed inset-0 pointer-events-none z-60" style={{ width: "100vw", height: "100vh" }} />
      )}

      {winner && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-950/98 px-8">
          <p className="text-amber-400 text-2xl font-bold uppercase tracking-widest mb-6">🏠 The wheel has spoken!</p>
          <div className="text-center px-10 py-8 rounded-3xl" style={{ backgroundColor: `${winner.color}22`, border: `3px solid ${winner.color}` }}>
            <p className="text-6xl font-black leading-tight drop-shadow-lg" style={{ color: winner.color }}>{winner.house}</p>
            <p className="text-white text-2xl mt-4 font-bold">
              {awarding ? "Awarding points…" : awarded ? `+${points} pts awarded!` : `+${points} pts`}
            </p>
          </div>
          <button
            onClick={() => { setWinner(null); setAwarded(false); }}
            disabled={awarding}
            className="mt-12 px-10 py-4 rounded-2xl text-white text-lg font-bold bg-white/20 hover:bg-white/30 transition-colors disabled:opacity-50"
          >
            Spin Again
          </button>
          <button onClick={onClose} className="mt-3 text-white/50 hover:text-white text-sm">Close</button>
        </div>
      )}

      <button onClick={onClose} className="absolute top-3 right-4 text-white text-3xl leading-none opacity-70 hover:opacity-100 z-10">&times;</button>

      <div className="flex items-center gap-2 shrink-0">
        <h2 className="text-white text-lg font-bold">🎡 House Spin — {points} pts to the winner</h2>
      </div>

      <div className="relative flex items-center justify-center shrink-0" style={{ width: canvasSize, height: canvasSize }}>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10 drop-shadow-lg" style={{ marginTop: -4 }}>
          <svg width="28" height="36" viewBox="0 0 32 40">
            <polygon points="16,38 2,4 30,4" fill="#ef4444" stroke="white" strokeWidth="2" />
          </svg>
        </div>
        <canvas ref={canvasRef} width={canvasSize} height={canvasSize} className="rounded-full" />
      </div>

      <div className="flex flex-col items-center gap-2 shrink-0 w-full">
        {!winner && (
          <button
            onClick={spin}
            disabled={spinning}
            className="px-10 py-3 rounded-2xl text-lg font-bold text-white shadow-2xl transition-all active:scale-95"
            style={{
              background: spinning ? "#6b7280" : "linear-gradient(135deg, #f59e0b, #d97706)",
              cursor: spinning ? "not-allowed" : "pointer",
            }}
          >
            {spinning ? "Spinning…" : "🎡  SPIN!"}
          </button>
        )}
      </div>
    </div>
  );
}
