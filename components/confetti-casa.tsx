'use client';

import React, { useEffect, useRef } from 'react';

interface ConfettiCasaProps {
  ativo: boolean;
}

type Particula = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  cor: string;
  rotacao: number;
  vRotacao: number;
  opacidade: number;
};

const CORES = [
  '#0284c7', // azul céu
  '#10b981', // verde folga
  '#f59e0b', // amarelo ouro
  '#ec4899', // rosa festa
  '#6366f1', // índigo
  '#38bdf8', // ciano
  '#ef4444', // vermelho
];

/**
 * Chuva de confetes em canvas leve (sem dependências extras)
 * disparada quando o Felipe está de folga em casa!
 */
export function ConfettiCasa({ ativo }: ConfettiCasaProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const jaDisparouRef = useRef(false);

  useEffect(() => {
    if (!ativo) {
      jaDisparouRef.current = false;
      return;
    }

    if (jaDisparouRef.current) return;
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    jaDisparouRef.current = true;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const total = width < 640 ? 90 : 150;
    const particulas: Particula[] = [];

    // Dois canhões laterais + chuva pelo topo
    for (let i = 0; i < total; i++) {
      const origemTipo = i % 3;
      const x =
        origemTipo === 0
          ? width * 0.12
          : origemTipo === 1
            ? width * 0.88
            : Math.random() * width;
      const y = origemTipo === 2 ? -20 - Math.random() * 140 : height * 0.32;
      const vx =
        origemTipo === 0
          ? 2 + Math.random() * 7
          : origemTipo === 1
            ? -(2 + Math.random() * 7)
            : (Math.random() - 0.5) * 4;
      const vy =
        origemTipo === 2
          ? 2 + Math.random() * 3.5
          : -(5 + Math.random() * 8);

      particulas.push({
        x,
        y,
        vx,
        vy,
        w: 6 + Math.random() * 6,
        h: 4 + Math.random() * 4,
        cor: CORES[i % CORES.length]!,
        rotacao: Math.random() * Math.PI * 2,
        vRotacao: (Math.random() - 0.5) * 0.22,
        opacidade: 1,
      });
    }

    let frameId = 0;
    const inicioMs = performance.now();
    const duracaoMs = 4200;

    const animar = (agoraMs: number) => {
      const decorrido = agoraMs - inicioMs;
      ctx.clearRect(0, 0, width, height);

      let visiveis = 0;
      for (const p of particulas) {
        p.vy += 0.16; // gravidade suave
        p.vx *= 0.99; // resistência do ar
        p.x += p.vx + Math.sin(decorrido * 0.004 + p.rotacao) * 0.5;
        p.y += p.vy;
        p.rotacao += p.vRotacao;

        if (decorrido > duracaoMs - 1100) {
          p.opacidade = Math.max(
            0,
            1 - (decorrido - (duracaoMs - 1100)) / 1100
          );
        }

        if (p.opacidade > 0.01 && p.y < height + 30) {
          visiveis++;
          ctx.save();
          ctx.globalAlpha = p.opacidade;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotacao);
          ctx.fillStyle = p.cor;
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          ctx.restore();
        }
      }

      if (decorrido < duracaoMs && visiveis > 0) {
        frameId = window.requestAnimationFrame(animar);
      } else {
        ctx.clearRect(0, 0, width, height);
      }
    };

    frameId = window.requestAnimationFrame(animar);

    return () => {
      window.cancelAnimationFrame(frameId);
      ctx.clearRect(0, 0, width, height);
    };
  }, [ativo]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="fixed inset-0 z-50 pointer-events-none w-screen h-screen"
    />
  );
}
