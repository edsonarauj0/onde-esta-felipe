'use client';

import React from 'react';
import {
  Calendar,
  Coffee,
  GraduationCap,
  Moon,
  Plane,
  Radio,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getAeroporto } from '@/lib/airports';
import {
  formatarDataLocal,
  formatarHoraLocal,
  getIntervaloEfetivo,
} from '@/lib/status';
import type { EventoEscala } from '@/lib/types';

interface ProximosDiasProps {
  eventos: EventoEscala[];
  baseIata?: string;
}

const TIPO_LABEL: Record<EventoEscala['tipo'], string> = {
  voo: 'Voo',
  pernoite: 'Pernoite',
  folga: 'Folga',
  sobreaviso: 'Sobreaviso',
  treinamento: 'Treinamento',
};

function IconeTipo({ tipo }: { tipo: EventoEscala['tipo'] }) {
  switch (tipo) {
    case 'voo':
      return <Plane className="w-4 h-4 text-sky-500" />;
    case 'pernoite':
      return <Moon className="w-4 h-4 text-indigo-500" />;
    case 'folga':
      return <Coffee className="w-4 h-4 text-emerald-500" />;
    case 'sobreaviso':
      return <Radio className="w-4 h-4 text-amber-500" />;
    case 'treinamento':
      return <GraduationCap className="w-4 h-4 text-violet-500" />;
  }
}

export function ProximosDias({ eventos, baseIata = 'GRU' }: ProximosDiasProps) {
  const base = getAeroporto(baseIata);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-sky-500" />
          Próximas aventuras do homi
        </CardTitle>
      </CardHeader>
      <CardContent>
        {eventos.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Nada na agenda! Será que finalmente vai aparecer no almoço de
            domingo? 🍝
          </p>
        ) : (
          <ul className="space-y-2.5">
            {eventos.map((ev) => {
              const origem = getAeroporto(ev.origem);
              const destino = getAeroporto(ev.destino);
              const tzInicio = origem?.tz ?? destino?.tz ?? base?.tz ?? 'America/Sao_Paulo';
              const tzFim = destino?.tz ?? origem?.tz ?? base?.tz ?? 'America/Sao_Paulo';
              const { inicio, fim } = getIntervaloEfetivo(ev);

              return (
                <li
                  key={ev.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="mt-0.5 p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700 shrink-0">
                      <IconeTipo tipo={ev.tipo} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-sm">
                          {ev.tipo === 'voo'
                            ? `${ev.origem ?? '---'} → ${ev.destino ?? '---'}`
                            : `${TIPO_LABEL[ev.tipo]}${
                                destino || origem
                                  ? ` · ${(destino ?? origem)!.cidade}`
                                  : ''
                              }`}
                        </span>
                        {ev.numeroVoo && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 font-mono"
                          >
                            {ev.numeroVoo}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {formatarDataLocal(inicio.toISOString(), tzInicio)} ·{' '}
                        {formatarHoraLocal(inicio.toISOString(), tzInicio)} –{' '}
                        {formatarHoraLocal(fim.toISOString(), tzFim)}
                        {ev.tipo === 'voo' && destino ? ` (${destino.iata})` : ''}
                      </div>
                    </div>
                  </div>

                  {ev.atrasoMinutos ? (
                    <Badge variant="destructive" className="text-[10px] shrink-0">
                      {ev.atrasoMinutos > 0 ? '+' : ''}
                      {ev.atrasoMinutos}m
                    </Badge>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
