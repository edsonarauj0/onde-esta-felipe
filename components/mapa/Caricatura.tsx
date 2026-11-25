'use client';

import React from 'react';
import type { EstadoStatus, FontePosicao } from '@/lib/types';

interface CaricaturaProps {
  estado: EstadoStatus;
  nome?: string;
  rumo?: number;
  fonte?: FontePosicao;
  numeroVoo?: string;
}

const LABELS: Record<EstadoStatus, string> = {
  voo: 'Voando alto ✈️',
  pernoite: 'Dormindo fora 🌙',
  folga: 'De folga 🌴',
  sobreaviso: 'De mala pronta 📞',
  treinamento: 'Piloto de simulador 🎮',
  'sem-escala': 'Sem escala 🤷',
};

/**
 * Caricatura personalizada do Felipe (cabelo crespo curto com degradê lateral,
 * barba fechada bem aparada, terno azul-marinho, camisa branca e gravata azul-clara)
 * com variações de pose para voo (com o avião branco e azul), pernoite, folga,
 * sobreaviso e treinamento.
 */
export function Caricatura({
  estado,
  nome = 'Felipe',
  rumo = 45,
  fonte = 'estimada',
  numeroVoo,
}: CaricaturaProps) {
  const isLive = estado === 'voo' && fonte === 'ao-vivo';
  const isVoo = estado === 'voo';

  // Inverte horizontalmente o avião se estiver voando para o oeste (180°..360°)
  const flipPlane = isVoo && rumo > 180 && rumo < 360;

  return (
    <div className="relative flex flex-col items-center select-none group">
      {/* Pulso suave sob o marcador quando em voo */}
      {isVoo && (
        <span
          className={`absolute top-2 w-16 h-16 rounded-full animate-ping opacity-25 pointer-events-none ${
            isLive ? 'bg-emerald-400' : 'bg-sky-400'
          }`}
        />
      )}

      {/* Container da ilustração */}
      <div className="relative transition-transform duration-300 group-hover:scale-105 scale-90 sm:scale-100 drop-shadow-[0_6px_12px_rgba(15,23,42,0.35)]">
        <svg
          viewBox="0 0 180 150"
          className={isVoo ? 'w-26 h-22 sm:w-28 sm:h-24 overflow-visible' : 'w-18 h-18 sm:w-20 sm:h-20 overflow-visible'}
          aria-label={`Caricatura de ${nome}`}
        >
          <defs>
            {/* Degradê lateral do corte de cabelo (fade nas têmporas) */}
            <linearGradient id="felipeFadeLeft" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2D1B13" />
              <stop offset="62%" stopColor="#7E5E4B" />
              <stop offset="100%" stopColor="#F5CBB0" />
            </linearGradient>
            <linearGradient id="felipeFadeRight" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2D1B13" />
              <stop offset="62%" stopColor="#7E5E4B" />
              <stop offset="100%" stopColor="#F5CBB0" />
            </linearGradient>
            <clipPath id="badgeClip">
              <circle cx="90" cy="68" r="56" />
            </clipPath>
          </defs>

          {/* Fundo circular branco suave para destacar no mapa (fora de voo ou atrás do busto) */}
          <circle
            cx="90"
            cy="68"
            r="56"
            fill="#FFFFFF"
            stroke={
              isLive
                ? '#10B981'
                : estado === 'voo'
                  ? '#1E3A8A'
                  : estado === 'pernoite'
                    ? '#4F46E5'
                    : estado === 'folga'
                      ? '#10B981'
                      : estado === 'sobreaviso'
                        ? '#F59E0B'
                        : '#64748B'
            }
            strokeWidth="4"
          />

          {/* Busto + Rosto do Felipe dentro do medalhão */}
          <g clipPath="url(#badgeClip)">
            {/* Tronco / Roupa */}
            {estado === 'folga' ? (
              <g>
                {/* Camiseta casual verde-esmeralda */}
                <path
                  d="M44 128 C46 98, 66 90, 90 90 C114 90, 134 98, 136 128 Z"
                  fill="#059669"
                  stroke="#064E3B"
                  strokeWidth="2.5"
                />
                <path
                  d="M76 90 Q90 104 104 90"
                  fill="none"
                  stroke="#A7F3D0"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </g>
            ) : estado === 'pernoite' ? (
              <g>
                {/* Suéter azul-índigo confortável */}
                <path
                  d="M44 128 C46 98, 66 90, 90 90 C114 90, 134 98, 136 128 Z"
                  fill="#4338CA"
                  stroke="#1E1B4B"
                  strokeWidth="2.5"
                />
                <path
                  d="M77 90 Q90 102 103 90"
                  fill="none"
                  stroke="#C7D2FE"
                  strokeWidth="2.5"
                />
              </g>
            ) : (
              <g>
                {/* Blazer / terno azul-marinho exatamente como na referência */}
                <path
                  d="M42 128 C45 99, 64 90, 90 90 C116 90, 135 99, 138 128 Z"
                  fill="#2E4387"
                  stroke="#172554"
                  strokeWidth="2.6"
                />
                {/* Camisa social branca */}
                <polygon points="75,88 105,88 90,124" fill="#FFFFFF" />
                {/* Lapelas do terno */}
                <path
                  d="M74 90 L67 104 L76 106 L86 126"
                  fill="none"
                  stroke="#172554"
                  strokeWidth="2.3"
                  strokeLinejoin="round"
                />
                <path
                  d="M106 90 L113 104 L104 106 L94 126"
                  fill="none"
                  stroke="#172554"
                  strokeWidth="2.3"
                  strokeLinejoin="round"
                />
                {/* Gola branca */}
                <polygon
                  points="76,88 89,98 81,103"
                  fill="#FFFFFF"
                  stroke="#CBD5E1"
                  strokeWidth="1"
                />
                <polygon
                  points="104,88 91,98 99,103"
                  fill="#FFFFFF"
                  stroke="#CBD5E1"
                  strokeWidth="1"
                />
                {/* Gravata azul-clara */}
                <polygon points="84,99 96,99 93,107 87,107" fill="#4F95D9" />
                <polygon points="87,107 93,107 96,128 84,128" fill="#4F95D9" />
              </g>
            )}

            {/* Pescoço com sombra sob o queixo */}
            <rect x="80" y="78" width="20" height="15" rx="4" fill="#E8BA9C" />
            <path d="M80 82 Q90 91 100 82 L100 87 Q90 94 80 87 Z" fill="#D4A181" opacity="0.55" />

            {/* Orelhas */}
            <path
              d="M61 52 C56 52, 55 62, 60 66 C62 67, 63 65, 63 63 Z"
              fill="#F2C6AA"
              stroke="#DCA788"
              strokeWidth="1.2"
            />
            <path
              d="M119 52 C124 52, 125 62, 120 66 C118 67, 117 65, 117 63 Z"
              fill="#F2C6AA"
              stroke="#DCA788"
              strokeWidth="1.2"
            />

            {/* Cabelo crespo curto no topo (silhueta arredondada e texturizada) */}
            <path
              d="M62 46
                 C59 38, 61 30, 66 25
                 C68 20, 74 17, 79 16
                 C83 13, 97 13, 101 16
                 C106 17, 112 20, 114 25
                 C119 30, 121 38, 118 46
                 L115 53 L65 53 Z"
              fill="#2B1A12"
            />
            {/* Ondinhas discretas do cabelo crespo no topo */}
            <circle cx="71" cy="22" r="4" fill="#2B1A12" />
            <circle cx="79" cy="18" r="4.5" fill="#2B1A12" />
            <circle cx="90" cy="16.5" r="5" fill="#2B1A12" />
            <circle cx="101" cy="18" r="4.5" fill="#2B1A12" />
            <circle cx="109" cy="22" r="4" fill="#2B1A12" />

            {/* Formato do rosto (tom de pele um pouco mais claro e natural) */}
            <path
              d="M63 45
                 C63 32, 72 26, 90 26
                 C108 26, 117 32, 117 45
                 C117 67, 109 85, 90 87
                 C71 85, 63 67, 63 45 Z"
              fill="#F5CBB0"
            />

            {/* Linha natural da testa / hairline levemente ondulada */}
            <path
              d="M65 44 C66 31, 74 26, 90 26 C106 26, 114 31, 115 44 C113 33, 105 29, 90 29 C75 29, 67 33, 65 44 Z"
              fill="#2B1A12"
            />

            {/* Degradê lateral (fade) nas têmporas */}
            <path
              d="M62 39 L67 40 L66 53 L62 52 Z"
              fill="url(#felipeFadeLeft)"
            />
            <path
              d="M118 39 L113 40 L114 53 L118 52 Z"
              fill="url(#felipeFadeRight)"
            />

            {/* Barba cheia e bem aparada nas bochechas e queixo */}
            <path
              d="M63 54
                 C63 72, 73 88, 90 88
                 C107 88, 117 72, 117 54
                 C115 62, 111 71, 104 75
                 C100 77, 95 79, 90 79
                 C85 79, 80 77, 76 75
                 C69 71, 65 62, 63 54 Z"
              fill="#2B1A12"
            />

            {/* Bigode conectado à barba + cavanhaque/soul patch */}
            <path
              d="M76 74 C76 67, 83 65, 89 66.5 L89 69 C83 68, 79 70, 78 75 Z"
              fill="#2B1A12"
            />
            <path
              d="M104 74 C104 67, 97 65, 91 66.5 L91 69 C97 68, 101 70, 102 75 Z"
              fill="#2B1A12"
            />
            <path d="M86 76 Q90 79.5 94 76 L92.5 79.5 Q90 81 87.5 79.5 Z" fill="#2B1A12" />

            {/* Sobrancelhas expressivas */}
            <path
              d="M70 46 Q77 42.5 84 45.5"
              fill="none"
              stroke="#2B1A12"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
            <path
              d="M96 45.5 Q103 42.5 110 46"
              fill="none"
              stroke="#2B1A12"
              strokeWidth="3.2"
              strokeLinecap="round"
            />

            {/* Nariz suave com sombra lateral */}
            <path
              d="M93 50 C92 54, 92 57, 94 59"
              fill="none"
              stroke="#D69D7C"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
            <path
              d="M84 60 Q90 63.5 96 60"
              fill="none"
              stroke="#D69D7C"
              strokeWidth="1.6"
              strokeLinecap="round"
            />

            {/* Linhas de expressão do sorriso */}
            <path
              d="M74 64 Q71 67 72 70"
              fill="none"
              stroke="#D69D7C"
              strokeWidth="1.1"
              strokeLinecap="round"
            />
            <path
              d="M106 64 Q109 67 108 70"
              fill="none"
              stroke="#D69D7C"
              strokeWidth="1.1"
              strokeLinecap="round"
            />

            {/* Olhos conforme o estado */}
            {estado === 'pernoite' ? (
              <g>
                {/* Olhos fechados descansando */}
                <path
                  d="M72 52 Q77 56 83 52"
                  fill="none"
                  stroke="#1C100B"
                  strokeWidth="2.3"
                  strokeLinecap="round"
                />
                <path
                  d="M97 52 Q103 56 108 52"
                  fill="none"
                  stroke="#1C100B"
                  strokeWidth="2.3"
                  strokeLinecap="round"
                />
              </g>
            ) : (
              <g>
                {/* Olhos escuros amigáveis com brilho branco */}
                <path d="M71 52 Q77 48 84 52 Q77 55 71 52 Z" fill="#FFFFFF" />
                <circle cx="77.5" cy="52" r="3" fill="#140C08" />
                <circle cx="78.8" cy="50.8" r="1" fill="#FFFFFF" />
                <path
                  d="M71 52 Q77 47.8 84 52"
                  fill="none"
                  stroke="#140C08"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />

                <path d="M96 52 Q103 48 109 52 Q103 55 96 52 Z" fill="#FFFFFF" />
                <circle cx="102.5" cy="52" r="3" fill="#140C08" />
                <circle cx="103.8" cy="50.8" r="1" fill="#FFFFFF" />
                <path
                  d="M96 52 Q103 47.8 109 52"
                  fill="none"
                  stroke="#140C08"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </g>
            )}

            {/* Boca / sorriso suave */}
            {estado === 'folga' ? (
              <path
                d="M82 71 Q90 76.5 98 71"
                fill="#FFFFFF"
                stroke="#7C3F23"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            ) : (
              <>
                <path
                  d="M82 71.5 Q90 75 98 71.5"
                  fill="none"
                  stroke="#7C3F23"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                />
                <path
                  d="M84 72 Q90 75.5 96 72"
                  fill="#C97F5A"
                  opacity="0.45"
                />
              </>
            )}
          </g>

          {/* Avião branco e azul na frente (exatamente como na referência!) quando EM VOO */}
          {isVoo && (
            <g
              transform={
                flipPlane
                  ? 'translate(180, 0) scale(-1, 1)'
                  : undefined
              }
            >
              {/* Cauda azul */}
              <path
                d="M24 114 L12 91 L31 91 L43 114 Z"
                fill="#2E4387"
                stroke="#172554"
                strokeWidth="2.8"
                strokeLinejoin="round"
              />
              {/* Fuselagem branca */}
              <path
                d="M24 110
                   L144 110
                   C159 110, 170 116, 173 123
                   C170 128, 158 131, 140 131
                   L26 131
                   C15 131, 10 126, 11 120
                   C12 114, 17 110, 24 110 Z"
                fill="#FFFFFF"
                stroke="#172554"
                strokeWidth="2.8"
                strokeLinejoin="round"
              />
              {/* Faixa azul lateral da fuselagem */}
              <path
                d="M13 123 L171 123 C169 125.5, 162 127, 150 127 L16 127 C14 126, 13 124.5, 13 123 Z"
                fill="#2E4387"
              />
              {/* Janela do cockpit */}
              <path
                d="M148 114 L161 114 C165 115, 167 117.5, 168 120 L148 120 Z"
                fill="#7CB4EB"
                stroke="#172554"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              {/* Janelinhas redondas azuis */}
              {[42, 54, 66, 78, 90, 102, 114, 126].map((cx) => (
                <circle
                  key={cx}
                  cx={cx}
                  cy="118"
                  r="3.2"
                  fill="#7CB4EB"
                  stroke="#172554"
                  strokeWidth="1.6"
                />
              ))}
              {/* Turbina sob a asa */}
              <ellipse
                cx="95"
                cy="138"
                rx="11"
                ry="6.5"
                fill="#DCE6F5"
                stroke="#172554"
                strokeWidth="2.5"
              />
              <ellipse
                cx="102.5"
                cy="138"
                rx="3.2"
                ry="5"
                fill="#94A3B8"
                stroke="#172554"
                strokeWidth="1.8"
              />
              {/* Asa inclinada */}
              <path
                d="M78 126 L108 126 L66 141 L48 141 Z"
                fill="#DCE6F5"
                stroke="#172554"
                strokeWidth="2.6"
                strokeLinejoin="round"
              />
            </g>
          )}

          {/* Acessório de pernoite (lua crescente) */}
          {estado === 'pernoite' && (
            <g transform="translate(124, 16)">
              <circle cx="14" cy="14" r="14" fill="#4F46E5" stroke="#FFFFFF" strokeWidth="2.5" />
              <path
                d="M17 7 A7.5 7.5 0 1 0 21 19.5 A6 6 0 1 1 17 7 Z"
                fill="#FDE68A"
              />
            </g>
          )}

          {/* Acessório de folga (café / solzinho) */}
          {estado === 'folga' && (
            <g transform="translate(124, 16)">
              <circle cx="14" cy="14" r="14" fill="#10B981" stroke="#FFFFFF" strokeWidth="2.5" />
              <circle cx="14" cy="14" r="5" fill="#FEF08A" />
            </g>
          )}

          {/* Acessório de sobreaviso (sinal de rádio) */}
          {estado === 'sobreaviso' && (
            <g transform="translate(124, 16)">
              <circle cx="14" cy="14" r="14" fill="#F59E0B" stroke="#FFFFFF" strokeWidth="2.5" />
              <circle cx="14" cy="14" r="3" fill="#FFFFFF" />
              <path d="M9 10 Q7 14 9 18 M19 10 Q21 14 19 18" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
            </g>
          )}

          {/* Ponto indicador de status (verde pulsante quando Ao Vivo) */}
          {isVoo && (
            <circle
              cx="134"
              cy="28"
              r="7.5"
              fill={isLive ? '#10B981' : '#F59E0B'}
              stroke="#FFFFFF"
              strokeWidth="2.8"
            />
          )}
        </svg>
      </div>

      {/* Etiqueta flutuante sob a caricatura */}
      <div className="-mt-1 px-2.5 py-0.5 rounded-full bg-slate-900/92 dark:bg-white/95 text-white dark:text-slate-950 text-[11px] font-semibold shadow-md whitespace-nowrap flex items-center gap-1.5">
        <span>{nome}</span>
        <span className="opacity-50">·</span>
        <span>{numeroVoo && isVoo ? numeroVoo : LABELS[estado]}</span>
      </div>
    </div>
  );
}
