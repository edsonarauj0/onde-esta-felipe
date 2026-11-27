'use client';

import React from 'react';
import {
  Clock,
  Coffee,
  Compass,
  Gauge,
  GraduationCap,
  MapPin,
  Moon,
  Plane,
  PlaneTakeoff,
  Radio,
  Shield,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { formatarCidadeEstado, getAeroporto } from '@/lib/airports';
import {
  formatarDataLocal,
  formatarDuracao,
  formatarHoraLocal,
  getIntervaloEfetivo,
} from '@/lib/status';
import type {
  ConfiguracoesApp,
  EstadoStatus,
  PosicaoAoVivo,
  StatusFelipe,
} from '@/lib/types';

const ESTADO_BADGE_LABEL: Record<
  Exclude<EstadoStatus, 'voo' | 'sem-escala'>,
  string
> = {
  pernoite: 'Pernoite',
  'em-solo': 'Em solo',
  folga: 'Folga',
  sobreaviso: 'Sobreaviso',
  treinamento: 'Treinamento',
};

interface StatusCardProps {
  status: StatusFelipe;
  posicaoAoVivo: PosicaoAoVivo | null;
  config: ConfiguracoesApp;
}

export function StatusCard({ status, posicaoAoVivo, config }: StatusCardProps) {
  const nome = config.nomePiloto || 'Felipe';
  const isLive = status.estado === 'voo' && posicaoAoVivo?.fonte === 'ao-vivo';

  if (status.estado === 'sem-escala') {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-slate-500" />
              Sem escala cadastrada
            </CardTitle>
            <Badge variant="secondary">Sem escala</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Nenhuma escala ativa foi encontrada para o período atual. Assim que
            o PDF da escala for importado no painel administrativo, o status e a
            localização de {nome} serão exibidos aqui.
          </p>
          {status.aeroportoAtual && (
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <MapPin className="w-3.5 h-3.5" />
              Base cadastrada: {status.aeroportoAtual.cidade} ({status.aeroportoAtual.iata})
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  const descricaoStatus =
    status.estado === 'voo'
      ? status.progresso < 25
        ? 'Voo recém-iniciado, em fase inicial de subida e navegação.'
        : status.progresso < 80
          ? 'Voo em andamento, seguindo a rota prevista na escala.'
          : 'Voo em fase final de aproximação para o aeroporto de destino.'
      : status.estado === 'pernoite'
        ? 'Em descanso fora da base, com pernoite programado nesta localidade.'
        : status.estado === 'em-solo'
          ? 'Em solo entre etapas da programação do dia, aguardando a próxima decolagem.'
          : status.estado === 'folga'
            ? 'Em período de folga programada conforme a escala mensal.'
            : status.estado === 'sobreaviso'
              ? 'Em regime de sobreaviso, à disposição da companhia aérea em caso de acionamento.'
              : 'Em atividade de treinamento em simulador prevista na escala.';

  const proximoVooEmSolo =
    status.estado === 'em-solo'
      ? status.proximoEvento?.tipo === 'voo'
        ? status.proximoEvento
        : (status.proximosEventos.find((ev) => ev.tipo === 'voo') ?? null)
      : null;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {status.estado === 'voo' && (
              <Plane className="w-5 h-5 text-sky-500" />
            )}
            {status.estado === 'pernoite' && (
              <Moon className="w-5 h-5 text-indigo-500" />
            )}
            {status.estado === 'em-solo' && (
              <PlaneTakeoff className="w-5 h-5 text-sky-500" />
            )}
            {status.estado === 'folga' && (
              <Coffee className="w-5 h-5 text-emerald-500" />
            )}
            {status.estado === 'sobreaviso' && (
              <Radio className="w-5 h-5 text-amber-500" />
            )}
            {status.estado === 'treinamento' && (
              <GraduationCap className="w-5 h-5 text-violet-500" />
            )}
            <CardTitle>
              {status.estado === 'voo' && `${nome} está em voo`}
              {status.estado === 'pernoite' &&
                `${nome} está em pernoite${
                  status.aeroportoAtual ? ` em ${status.aeroportoAtual.cidade}` : ''
                }`}
              {status.estado === 'em-solo' &&
                `${nome} está em solo${
                  status.aeroportoAtual ? ` em ${status.aeroportoAtual.cidade}` : ''
                }`}
              {status.estado === 'folga' &&
                `${nome} está ${
                  status.aeroportoAtual?.iata === 'CASA'
                    ? 'de folga em casa (São Vicente)'
                    : `de folga${
                        status.aeroportoAtual
                          ? ` em ${status.aeroportoAtual.cidade}`
                          : ''
                      }`
                }`}
              {status.estado === 'sobreaviso' &&
                (status.aeroportoAtual?.iata === 'CASA'
                  ? `${nome} está de sobreaviso em casa (HSB)`
                  : `${nome} está de reserva no aeroporto (${
                      status.eventoAtual?.codigoAtividade || 'ASB'
                    })`)}
              {status.estado === 'treinamento' && `${nome} está em treinamento`}
            </CardTitle>
          </div>

          {status.estado === 'voo' ? (
            <Badge variant={isLive ? 'live' : 'estimated'}>
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isLive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
              />
              {isLive ? 'Ao vivo' : 'Posição estimada'}
            </Badge>
          ) : (
            <Badge variant="secondary">
              {ESTADO_BADGE_LABEL[status.estado]}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 rounded-xl px-3 py-2">
          {descricaoStatus}
        </p>

        {/* Bloco detalhado de VOO */}
        {status.estado === 'voo' &&
          status.origemAeroporto &&
          status.destinoAeroporto &&
          status.inicioEfetivoUtc &&
          status.fimEfetivoUtc && (
            <>
              <div className="flex items-center justify-between gap-2 sm:gap-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 sm:p-4">
                <div className="min-w-0">
                  <div className="text-xl sm:text-2xl font-bold tracking-tight">
                    {status.origemAeroporto.iata}
                  </div>
                  <div className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate max-w-[115px] sm:max-w-none">
                    {formatarCidadeEstado(status.origemAeroporto)}
                  </div>
                  <div className="mt-1 text-xs sm:text-sm font-semibold">
                    {formatarHoraLocal(
                      status.inicioEfetivoUtc,
                      status.origemAeroporto.tz
                    )}
                    <span className="ml-1 text-[10px] sm:text-[11px] font-normal text-slate-500">
                      local
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-center text-center px-1 sm:px-2 shrink-0">
                  <Badge variant="outline" className="mb-1 sm:mb-1.5 font-mono text-[11px]">
                    {status.eventoAtual?.numeroVoo || 'VOO'}
                  </Badge>
                  <div className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400">
                    {status.rota
                      ? `${Math.round(status.rota.distanciaTotalKm).toLocaleString('pt-BR')} km`
                      : ''}
                  </div>
                </div>

                <div className="text-right min-w-0">
                  <div className="text-xl sm:text-2xl font-bold tracking-tight">
                    {status.destinoAeroporto.iata}
                  </div>
                  <div className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate max-w-[115px] sm:max-w-none ml-auto">
                    {formatarCidadeEstado(status.destinoAeroporto)}
                  </div>
                  <div className="mt-1 text-xs sm:text-sm font-semibold">
                    {formatarHoraLocal(
                      status.fimEfetivoUtc,
                      status.destinoAeroporto.tz
                    )}
                    <span className="ml-1 text-[10px] sm:text-[11px] font-normal text-slate-500">
                      local
                    </span>
                  </div>
                </div>
              </div>

              {/* Barra de progresso */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">
                    Progresso do voo
                  </span>
                  <span className="font-semibold">
                    {status.progresso}% · falta{' '}
                    {formatarDuracao(status.tempoRestanteMs)}
                  </span>
                </div>
                <Progress value={status.progresso} />
                <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span>
                    Decolagem:{' '}
                    {formatarDataLocal(
                      status.inicioEfetivoUtc,
                      status.origemAeroporto.tz
                    )}
                  </span>
                  <span>
                    Chegada prevista:{' '}
                    {formatarDataLocal(
                      status.fimEfetivoUtc,
                      status.destinoAeroporto.tz
                    )}
                  </span>
                </div>
              </div>

              {/* Telemetria ADS-B (adsb.lol) quando Ao Vivo */}
              {isLive && posicaoAoVivo && (
                <div className="space-y-2 pt-1">
                  {(posicaoAoVivo.aeronaveTipo || posicaoAoVivo.matricula) && (
                    <div className="flex items-center justify-between text-[11px] text-emerald-700 dark:text-emerald-300 px-1">
                      <span>
                        Aeronave:{' '}
                        <strong>
                          {[posicaoAoVivo.aeronaveTipo, posicaoAoVivo.matricula]
                            .filter(Boolean)
                            .join(' · ')}
                        </strong>
                      </span>
                      <span className="opacity-75">
                        via {posicaoAoVivo.provedor || 'adsb.lol'}
                      </span>
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/30 p-2.5 text-center">
                      <div className="text-[10px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center justify-center gap-1">
                        <Gauge className="w-3 h-3" /> Altitude
                      </div>
                      <div className="text-sm font-bold mt-0.5">
                        {posicaoAoVivo.noSolo
                          ? 'No solo'
                          : posicaoAoVivo.altitude != null
                            ? `${Math.round(posicaoAoVivo.altitude * 3.28084).toLocaleString('pt-BR')} ft`
                            : '—'}
                      </div>
                    </div>
                    <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/30 p-2.5 text-center">
                      <div className="text-[10px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center justify-center gap-1">
                        <Plane className="w-3 h-3" /> Velocidade
                      </div>
                      <div className="text-sm font-bold mt-0.5">
                        {posicaoAoVivo.velocidadeMs != null
                          ? `${Math.round(posicaoAoVivo.velocidadeMs * 3.6)} km/h`
                          : '—'}
                      </div>
                    </div>
                    <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/30 p-2.5 text-center">
                      <div className="text-[10px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center justify-center gap-1">
                        <Compass className="w-3 h-3" /> Rumo
                      </div>
                      <div className="text-sm font-bold mt-0.5">
                        {posicaoAoVivo.rumo != null
                          ? `${Math.round(posicaoAoVivo.rumo)}°`
                          : '—'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {!isLive && (
                <Alert variant="warning" className="py-2.5">
                  <Radio className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <AlertTitle className="text-xs">
                      Sem recepção ADS-B no momento
                    </AlertTitle>
                    <AlertDescription>
                      A posição exibida no mapa está sendo estimada
                      automaticamente com base nos horários e na rota da escala.
                    </AlertDescription>
                  </div>
                </Alert>
              )}

              {status.eventoAtual?.atrasoMinutos ? (
                <Badge variant="destructive" className="w-fit">
                  Ajuste manual de horário:{' '}
                  {status.eventoAtual.atrasoMinutos > 0 ? '+' : ''}
                  {status.eventoAtual.atrasoMinutos} min
                </Badge>
              ) : null}
            </>
          )}

        {/* Bloco para Pernoite / Folga / Sobreaviso / Treinamento */}
        {status.estado !== 'voo' && status.aeroportoAtual && (
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-sky-500" />
                <span className="font-semibold">
                  {formatarCidadeEstado(status.aeroportoAtual)}
                </span>
              </div>
              <Badge variant="outline">
                {status.aeroportoAtual.iata === 'CASA'
                  ? 'Em casa'
                  : status.aeroportoAtual.iata}
              </Badge>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Clock className="w-3.5 h-3.5" />
              <span>
                Hora local agora:{' '}
                <strong className="text-slate-700 dark:text-slate-200">
                  {formatarHoraLocal(
                    status.referenciaAgoraUtc,
                    status.aeroportoAtual.tz
                  )}
                </strong>
              </span>
            </div>

            {proximoVooEmSolo &&
              (() => {
                const inicioProx = getIntervaloEfetivo(proximoVooEmSolo).inicio;
                const tzProx =
                  getAeroporto(proximoVooEmSolo.origem)?.tz ??
                  status.aeroportoAtual.tz;
                const faltaMs =
                  inicioProx.getTime() -
                  new Date(status.referenciaAgoraUtc).getTime();
                return (
                  <div className="flex items-center gap-2 text-xs text-sky-700 dark:text-sky-300 pt-0.5">
                    <Plane className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      Próximo voo:{' '}
                      <strong className="font-mono">
                        {proximoVooEmSolo.numeroVoo || 'Voo'}
                      </strong>{' '}
                      ({proximoVooEmSolo.origem ?? '---'} →{' '}
                      {proximoVooEmSolo.destino ?? '---'}) às{' '}
                      <strong>
                        {formatarHoraLocal(inicioProx.toISOString(), tzProx)}
                      </strong>
                      {faltaMs > 0 ? ` · em ${formatarDuracao(faltaMs)}` : ''}
                    </span>
                  </div>
                );
              })()}

            {status.fimEfetivoUtc && (
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Até{' '}
                {formatarDataLocal(
                  status.fimEfetivoUtc,
                  status.aeroportoAtual.tz
                )}{' '}
                às{' '}
                {formatarHoraLocal(
                  status.fimEfetivoUtc,
                  status.aeroportoAtual.tz
                )}{' '}
                (hora local)
              </div>
            )}
          </div>
        )}

        {/* Aviso quando há atraso de privacidade configurado */}
        {config.atrasoPrivacidadeMinutos > 0 && (
          <>
            <Separator />
            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
              <Shield className="w-3.5 h-3.5 text-sky-500 shrink-0" />
              <span>
                Atraso de privacidade ativo: posição exibida com{' '}
                {config.atrasoPrivacidadeMinutos} min de diferença.
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
