'use client';

import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Globe2,
  MapPin,
  Plane,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatarMesAno } from '@/lib/status';
import type { ResumoMes } from '@/lib/types';

interface ResumoMesCardProps {
  resumo: ResumoMes;
  mesAtivo: string;
  mesesDisponiveis?: string[];
  onSelecionarMes?: (mes: string) => void;
}

export function ResumoMesCard({
  resumo,
  mesAtivo,
  mesesDisponiveis = [],
  onSelecionarMes,
}: ResumoMesCardProps) {
  const voltasNaTerra = (resumo.distanciaTotalKm / 40075).toFixed(2);
  const idxAtual = mesesDisponiveis.indexOf(mesAtivo);
  const podeNavegarMeses =
    Boolean(onSelecionarMes) && mesesDisponiveis.length > 1 && idxAtual !== -1;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Globe2 className="w-4 h-4 text-sky-500" />
            Resumo do mês
          </CardTitle>
          {podeNavegarMeses ? (
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                disabled={idxAtual <= 0}
                onClick={() => onSelecionarMes!(mesesDisponiveis[idxAtual - 1]!)}
                aria-label="Mês anterior"
                title="Ver mês anterior"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <Badge variant="secondary" className="font-mono">
                {formatarMesAno(mesAtivo)}
              </Badge>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                disabled={idxAtual >= mesesDisponiveis.length - 1}
                onClick={() => onSelecionarMes!(mesesDisponiveis[idxAtual + 1]!)}
                aria-label="Próximo mês"
                title="Ver próximo mês"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          ) : (
            <Badge variant="secondary" className="font-mono">
              {formatarMesAno(mesAtivo)}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3 text-center">
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1">
              <Plane className="w-3 h-3" /> Voos
            </div>
            <div className="text-lg font-bold mt-0.5">{resumo.totalVoos}</div>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3 text-center">
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1">
              <Clock className="w-3 h-3" /> Horas
            </div>
            <div className="text-lg font-bold mt-0.5">{resumo.horasVoo}h</div>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3 text-center">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Distância
            </div>
            <div className="text-lg font-bold mt-0.5">
              {resumo.distanciaTotalKm.toLocaleString('pt-BR')}
              <span className="text-[11px] font-normal ml-0.5">km</span>
            </div>
          </div>
        </div>

        {resumo.distanciaTotalKm > 0 && (
          <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 rounded-xl px-3 py-2">
            Distância equivalente a <strong>{voltasNaTerra} voltas na Terra</strong>{' '}
            ({resumo.totalPernoites}{' '}
            {resumo.totalPernoites === 1 ? 'pernoite' : 'pernoites'} e{' '}
            {resumo.totalFolgas}{' '}
            {resumo.totalFolgas === 1 ? 'folga' : 'folgas'} na escala).
          </p>
        )}

        {resumo.cidadesVisitadas.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <MapPin className="w-3 h-3" /> Destinos da escala
            </div>
            <div className="flex flex-wrap gap-1.5">
              {resumo.cidadesVisitadas.map((cidade) => (
                <Badge key={cidade} variant="outline" className="text-[11px]">
                  {cidade}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
