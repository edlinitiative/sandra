'use client';

import { useEffect, useRef } from 'react';

interface Pt {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface ParticleCanvasProps {
  /** When true particles speed up, dots brighten, and connections glow */
  active: boolean;
  className?: string;
}

export function ParticleCanvas({ active, className }: ParticleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Use a ref so the draw loop always reads the latest `active` value
  const activeRef = useRef(active);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();

    const N = 55;
    let pts: Pt[] = Array.from({ length: N }, () => ({
      x: Math.random() * canvas.offsetWidth,
      y: Math.random() * canvas.offsetHeight,
      vx: (Math.random() - 0.5) * 0.6,
      vy: (Math.random() - 0.5) * 0.6,
    }));

    let raf: number;

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      const isActive = activeRef.current;
      const speed = isActive ? 2.8 : 1;
      const linkDist = isActive ? 110 : 72;
      const lineAlphaMax = isActive ? 0.55 : 0.18;
      const dotAlpha = isActive ? 0.85 : 0.3;
      const dotR = isActive ? 2.2 : 1.2;

      ctx.clearRect(0, 0, w, h);

      pts.forEach((p) => {
        p.x += p.vx * speed;
        p.y += p.vy * speed;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
      });

      // Connections
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const dx = pts[i]!.x - pts[j]!.x;
          const dy = pts[i]!.y - pts[j]!.y;
          const d = Math.hypot(dx, dy);
          if (d < linkDist) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(56,157,246,${lineAlphaMax * (1 - d / linkDist)})`;
            ctx.lineWidth = 0.6;
            ctx.moveTo(pts[i]!.x, pts[i]!.y);
            ctx.lineTo(pts[j]!.x, pts[j]!.y);
            ctx.stroke();
          }
        }
      }

      // Dots
      pts.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, dotR, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(93,185,250,${dotAlpha})`;
        ctx.fill();
      });

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);

    const ro = new ResizeObserver(() => {
      resize();
      // Re-scatter particles to new bounds
      pts = Array.from({ length: N }, () => ({
        x: Math.random() * canvas.offsetWidth,
        y: Math.random() * canvas.offsetHeight,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
      }));
    });
    ro.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: '100%', height: '100%' }}
    />
  );
}
