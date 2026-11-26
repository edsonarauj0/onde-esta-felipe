'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Coffee,
  GraduationCap,
  Moon,
  Plane,
  Radio,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatarCidadeEstado, getAeroporto } from '@/lib/airports';
import {
  formatarDataLocal,
  formatarHoraLocal,
  getIntervaloEfetivo,
} from '@/lib/status';
import type { EventoEscala } from '@/lib/types';

interface ProximosDiasProps {
  eventos: EventoEscala[];
  agora?: Date;
  baseIata?: string;
}

const ITENS_POR_PAGINA = 5;
const FUSO_PADRAO = 'America/Sao_Paulo';

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

export function ProximosDias({
  eventos,
  agora = new Date(),
  baseIata = 'GRU',
}: ProximosDiasProps) {
  const base = getAeroporto(baseIata);
  const agoraMs = agora.getTime();

  // Todos os eventos ativos hoje e futuros cadastrados, ordenados cronologicamente
  const eventosFuturos = useMemo(() => {
    return eventos
      .filter((ev) => {
        if (ev.cancelado) return false;
        const { fim } = getIntervaloEfetivo(ev);
        return fim.getTime() >= agoraMs;
      })
      .sort(
        (a, b) =>
          getIntervaloEfetivo(a).inicio.getTime() -
          getIntervaloEfetivo(b).inicio.getTime()
      );
  }, [eventos, agoraMs]);

  const totalPaginas = Math.max(
    1,
    Math.ceil(eventosFuturos.length / ITENS_POR_PAGINA)
  );
  const [pagina, setPagina] = useState(0);

  // Volta para a primeira página se o conjunto de eventos diminuir ou mudar de cenário
  useEffect(() => {
    setPagina((p) => Math.min(p, Math.max(0, totalPaginas - 1)));
  }, [totalPaginas]);

  const paginaSegura = Math.min(pagina, totalPaginas - 1);
  const inicioIdx = paginaSegura * ITENS_POR_PAGINA;
  const itensPagina = eventosFuturos.slice(
    inicioIdx,
    inicioIdx + ITENS_POR_PAGINA
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-sky-500" />
            Próximos destinos
          </CardTitle>
          {eventosFuturos.length > 0 && (
            <Badge variant="secondary" className="font-mono text-[11px]">
              {inicioIdx + 1}–{inicioIdx + itensPagina.length} de{' '}
              {eventosFuturos.length}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {itensPagina.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Nada na agenda! Será que finalmente vai aparecer no almoço de
            domingo? 🍝
          </p>
        ) : (
          <div
            className={
              totalPaginas > 1
                ? 'h-[472px] overflow-y-auto pr-0.5'
                : undefined
            }
          >
            <ul className="space-y-2.5">
              {itensPagina.map((ev) => {
                const origem = getAeroporto(ev.origem);
                const destino = getAeroporto(ev.destino);
                const tzInicio =
                  origem?.tz ?? destino?.tz ?? base?.tz ?? FUSO_PADRAO;
                const tzFim =
                  destino?.tz ?? origem?.tz ?? base?.tz ?? FUSO_PADRAO;
                const { inicio, fim } = getIntervaloEfetivo(ev);
                const emAndamento =
                  agoraMs >= inicio.getTime() && agoraMs <= fim.getTime();
                const rotaCidades =
                  ev.tipo === 'voo' && (origem || destino)
                    ? `${origem ? formatarCidadeEstado(origem) : ev.origem ?? '---'} → ${destino ? formatarCidadeEstado(destino) : ev.destino ?? '---'}`
                    : null;
                const resumoHorario = `${formatarDataLocal(inicio.toISOString(), tzInicio)} · ${formatarHoraLocal(inicio.toISOString(), tzInicio)} – ${formatarHoraLocal(fim.toISOString(), tzFim)}${
                  ev.tipo === 'voo' && destino
                    ? ` (${destino.iata} · ${formatarCidadeEstado(destino)})`
                    : ''
                }`;

                return (
                  <li
                    key={ev.id}
                    className={`flex items-start justify-between gap-3 rounded-xl border p-3 transition-colors ${
                      emAndamento
                        ? 'border-sky-300 dark:border-sky-700 bg-sky-50/70 dark:bg-sky-950/40'
                        : 'border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <div className="mt-0.5 p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700 shrink-0">
                        <IconeTipo tipo={ev.tipo} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-sm">
                            {ev.tipo === 'voo'
                              ? `${ev.origem ?? '---'} → ${ev.destino ?? '---'}`
                              : `${TIPO_LABEL[ev.tipo]}${
                                  ev.codigoAtividade
                                    ? ` (${ev.codigoAtividade})`
                                    : ''
                                }${
                                  destino || origem
                                    ? ` · ${formatarCidadeEstado(destino ?? origem)}`
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
                          {emAndamento && (
                            <Badge
                              variant="live"
                              className="text-[10px] px-1.5 py-0"
                            >
                              Agora
                            </Badge>
                          )}
                        </div>
                        {rotaCidades && (
                          <div
                            className="text-[11px] font-medium text-slate-600 dark:text-slate-300 mt-0.5 truncate"
                            title={rotaCidades}
                          >
                            {rotaCidades}
                          </div>
                        )}
                        <div
                          className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate"
                          title={resumoHorario}
                        >
                          {resumoHorario}
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
          </div>
        )}

        {/* Setas de paginação (máximo 5 itens por página) */}
        {totalPaginas > 1 && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs"
              disabled={paginaSegura <= 0}
              onClick={() => setPagina((p) => Math.max(0, p - 1))}
              aria-label="Página anterior"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Anterior</span>
            </Button>

            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-mono font-medium text-slate-700 dark:text-slate-200">
                {paginaSegura + 1} / {totalPaginas}
              </span>
              {paginaSegura > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[11px] text-sky-600 dark:text-sky-400"
                  onClick={() => setPagina(0)}
                >
                  Início
                </Button>
              )}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs"
              disabled={paginaSegura >= totalPaginas - 1}
              onClick={() =>
                setPagina((p) => Math.min(totalPaginas - 1, p + 1))
              }
              aria-label="Próxima página"
            >
              <span className="hidden sm:inline">Próximo</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
