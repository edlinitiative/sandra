'use client';

import { useEffect, useRef } from 'react';

interface OracleOrbProps {
  /** Size in pixels (width & height) */
  size?: number;
  /** Active state — intensifies the animation (e.g., when AI is thinking) */
  active?: boolean;
  /** Additional CSS classes */
  className?: string;
}

interface Particle {
  angle: number;      // current angle around center
  radius: number;     // distance from center
  speed: number;      // angular velocity
  size: number;       // dot radius
  opacity: number;    // base opacity
  drift: number;      // radial oscillation amplitude
  driftSpeed: number; // radial oscillation speed
  phase: number;      // phase offset for drift
  trail: number[];    // previous positions for smoke trail
  hue: number;        // color hue offset
}

interface Wisp {
  angle: number;
  speed: number;
  length: number;
  opacity: number;
  curl: number;
}

export function OracleOrb({ size = 200, active = false, className }: OracleOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef(active);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const maxR = size * 0.38;

    // Initialize particles
    const NUM_PARTICLES = 100;
    const particles: Particle[] = Array.from({ length: NUM_PARTICLES }, () => ({
      angle: Math.random() * Math.PI * 2,
      radius: maxR * (0.15 + Math.random() * 0.85),
      speed: (0.002 + Math.random() * 0.008) * (Math.random() > 0.5 ? 1 : -1),
      size: 0.5 + Math.random() * 2,
      opacity: 0.2 + Math.random() * 0.6,
      drift: maxR * (0.05 + Math.random() * 0.15),
      driftSpeed: 0.005 + Math.random() * 0.015,
      phase: Math.random() * Math.PI * 2,
      trail: [],
      hue: Math.random() * 40 - 20, // -20 to +20 degrees from base hue
    }));

    // Initialize wisps
    const NUM_WISPS = 7;
    const wisps: Wisp[] = Array.from({ length: NUM_WISPS }, () => ({
      angle: Math.random() * Math.PI * 2,
      speed: 0.003 + Math.random() * 0.005,
      length: maxR * (0.5 + Math.random() * 0.4),
      opacity: 0.03 + Math.random() * 0.06,
      curl: 0.3 + Math.random() * 0.7,
    }));

    let t = 0;
    let raf: number;

    const draw = () => {
      const isActive = activeRef.current;
      const speedMul = isActive ? 2.5 : 1;
      const glowIntensity = isActive ? 0.45 : 0.2;
      const wispAlphaMul = isActive ? 2.5 : 1;
      const breathAmp = isActive ? 0.08 : 0.04;

      t += 0.016; // ~60fps time step
      const breath = 1 + Math.sin(t * 0.8) * breathAmp;

      ctx.clearRect(0, 0, size, size);

      // ── Outer glow ──
      const outerGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR * 1.5 * breath);
      outerGlow.addColorStop(0, `rgba(174, 198, 255, ${glowIntensity * 0.6})`);
      outerGlow.addColorStop(0.4, `rgba(100, 140, 255, ${glowIntensity * 0.3})`);
      outerGlow.addColorStop(0.7, `rgba(80, 100, 200, ${glowIntensity * 0.1})`);
      outerGlow.addColorStop(1, 'rgba(80, 100, 200, 0)');
      ctx.fillStyle = outerGlow;
      ctx.fillRect(0, 0, size, size);

      // ── Light rays ──
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.05);
      const numRays = 12;
      for (let i = 0; i < numRays; i++) {
        const rayAngle = (Math.PI * 2 * i) / numRays;
        ctx.save();
        ctx.rotate(rayAngle);
        const rayGrad = ctx.createLinearGradient(0, 0, maxR * 1.2 * breath, 0);
        rayGrad.addColorStop(0, `rgba(174, 198, 255, ${isActive ? 0.08 : 0.03})`);
        rayGrad.addColorStop(1, 'rgba(174, 198, 255, 0)');
        ctx.fillStyle = rayGrad;
        ctx.beginPath();
        ctx.moveTo(0, -1.5);
        ctx.lineTo(maxR * 1.2 * breath, -0.5);
        ctx.lineTo(maxR * 1.2 * breath, 0.5);
        ctx.lineTo(0, 1.5);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();

      // ── Core sphere (radial gradient) ──
      const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR * 0.5 * breath);
      coreGrad.addColorStop(0, `rgba(200, 220, 255, ${isActive ? 0.35 : 0.2})`);
      coreGrad.addColorStop(0.5, `rgba(140, 170, 255, ${isActive ? 0.15 : 0.08})`);
      coreGrad.addColorStop(1, 'rgba(100, 130, 255, 0)');
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, maxR * 0.5 * breath, 0, Math.PI * 2);
      ctx.fill();

      // ── Wisps (smoke curves) ──
      wisps.forEach((w) => {
        w.angle += w.speed * speedMul;
        const wAlpha = w.opacity * wispAlphaMul;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(w.angle);

        ctx.beginPath();
        ctx.moveTo(0, 0);
        const cp1x = w.length * 0.3 * breath;
        const cp1y = w.length * w.curl * Math.sin(t * 0.5 + w.angle) * breath;
        const cp2x = w.length * 0.7 * breath;
        const cp2y = -w.length * w.curl * 0.5 * Math.cos(t * 0.3 + w.angle) * breath;
        const endX = w.length * breath;
        const endY = w.length * 0.1 * Math.sin(t * 0.7 + w.angle) * breath;
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);

        ctx.strokeStyle = `rgba(174, 198, 255, ${wAlpha})`;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();
      });

      // ── Particles ──
      particles.forEach((p) => {
        p.angle += p.speed * speedMul;
        p.phase += p.driftSpeed * speedMul;
        const r = (p.radius + Math.sin(p.phase) * p.drift) * breath;
        const x = cx + Math.cos(p.angle) * r;
        const y = cy + Math.sin(p.angle) * r;

        // Trail (smoke effect) — store last 5 positions
        p.trail.push(x, y);
        if (p.trail.length > 10) {
          p.trail.splice(0, 2);
        }

        // Draw trail
        if (p.trail.length >= 4) {
          for (let i = 0; i < p.trail.length - 2; i += 2) {
            const trailAlpha = (i / p.trail.length) * p.opacity * 0.3;
            ctx.beginPath();
            ctx.arc(p.trail[i]!, p.trail[i + 1]!, p.size * 0.6, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(140, 180, 255, ${trailAlpha})`;
            ctx.fill();
          }
        }

        // Draw particle
        const baseHue = 220 + p.hue; // blue range
        const alpha = p.opacity * (isActive ? 1 : 0.7);
        ctx.beginPath();
        ctx.arc(x, y, p.size * (isActive ? 1.3 : 1), 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${baseHue}, 80%, 78%, ${alpha})`;
        ctx.fill();

        // Particle glow
        if (p.size > 1.2) {
          ctx.beginPath();
          ctx.arc(x, y, p.size * 3, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${baseHue}, 80%, 78%, ${alpha * 0.1})`;
          ctx.fill();
        }
      });

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);

    return () => cancelAnimationFrame(raf);
  }, [size]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}
