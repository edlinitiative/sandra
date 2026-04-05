'use client';

import { useEffect, useRef } from 'react';

interface Pt {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/** Very subtle slow-drifting neural-net canvas for the chat background */
export function AmbientParticles({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

    const N = 28;
    let pts: Pt[] = Array.from({ length: N }, () => ({
      x: Math.random() * canvas.offsetWidth,
      y: Math.random() * canvas.offsetHeight,
      vx: (Math.random() - 0.5) * 0.18,
      vy: (Math.random() - 0.5) * 0.18,
    }));

    let raf: number;

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      pts.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
      });

      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const dx = pts[i]!.x - pts[j]!.x;
          const dy = pts[i]!.y - pts[j]!.y;
          const d = Math.hypot(dx, dy);
          if (d < 140) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(56,157,246,${0.07 * (1 - d / 140)})`;
            ctx.lineWidth = 0.4;
            ctx.moveTo(pts[i]!.x, pts[i]!.y);
            ctx.lineTo(pts[j]!.x, pts[j]!.y);
            ctx.stroke();
          }
        }
      }

      pts.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(56,157,246,0.18)';
        ctx.fill();
      });

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);

    const ro = new ResizeObserver(() => {
      resize();
      pts = Array.from({ length: N }, () => ({
        x: Math.random() * canvas.offsetWidth,
        y: Math.random() * canvas.offsetHeight,
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.18,
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
      className={className ?? 'pointer-events-none absolute inset-0 z-0'}
      style={{ width: '100%', height: '100%' }}
    />
  );
}
