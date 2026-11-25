'use client';

import React from 'react';
import { Clock, Globe2, MapPin, Plane } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatarMesAno } from '@/lib/status';
import type { ResumoMes } from '@/lib/types';

interface ResumoMesCardProps {
  resumo: ResumoMes;
  mesAtivo: string;
}

export function ResumoMesCard({ resumo, mesAtivo }: ResumoMesCardProps) {
  const viagensPraiaGrande = Math.max(
    1,
    Math.round(resumo.distanciaTotalKm / 75)
  );
  const voltasNaTerra = (resumo.distanciaTotalKm / 40075).toFixed(2);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Globe2 className="w-4 h-4 text-sky-500" />
            Balanço da saudade no mês 💔
          </CardTitle>
          <Badge variant="secondary" className="font-mono">
            {formatarMesAno(mesAtivo)}
          </Badge>
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
          <p className="text-xs text-slate-600 dark:text-slate-300 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/50 rounded-xl px-3 py-2">
            🧮 Isso dá <strong>{voltasNaTerra} voltas na Terra</strong> (ou{' '}
            <strong>{viagensPraiaGrande} descidas</strong> pra Praia Grande sem
            pegar trânsito na Imigrantes!).
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
