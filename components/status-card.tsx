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
  Radio,
  Shield,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { formatarCidadeEstado } from '@/lib/airports';
import {
  formatarDataLocal,
  formatarDuracao,
  formatarHoraLocal,
} from '@/lib/status';
import type { ConfiguracoesApp, PosicaoAoVivo, StatusFelipe } from '@/lib/types';

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
              <Sparkles className="w-5 h-5 text-pink-500" />
              Cadê a escala, {nome}?! 🤷‍♂️
            </CardTitle>
            <Badge variant="secondary">Sumido</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            A família já tá mandando interrogação no grupo e nada da escala do
            mês! Assim que o {nome} subir o PDF do Crewtopia no painel admin, o
            radar da saudade volta ao ar.
          </p>
          {status.aeroportoAtual && (
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <MapPin className="w-3.5 h-3.5" />
              Último paradeiro oficial (base): {status.aeroportoAtual.cidade} ({status.aeroportoAtual.iata})
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  const fraseBregaStatus =
    status.estado === 'voo'
      ? status.progresso < 25
        ? 'Acabou de decolar! Pode mandar áudio de 5 min no Zap que ele só ouve quando pousar 🎙️'
        : status.progresso < 80
          ? 'Lá em cima nas nuvens tomando cafezinho de bordo enquanto a família morre de saudade ☕💔'
          : 'Já tá descendo a ladeira do céu! Vai esquentando o café que o comandante tá chegando 🛬'
      : status.estado === 'pernoite'
        ? 'Descansando em outra cidade — não ligue agora que o homi precisa dormir 😴'
        : status.estado === 'folga'
          ? 'ALERTA DE EVENTO RARO! Aproveite para cobrar o churrasco antes que a escala vire 🥩🎉'
          : status.estado === 'sobreaviso'
            ? 'De mala pronta olhando pro teto... se o celular tocar, ele desaparece em 15 minutos 🧳📞'
            : 'Voando no simulador: não sai do lugar, mas sai suando a camisa branca 🎮✈️';

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
              {status.estado === 'voo' && `${nome} tá nas nuvens (de novo!) ✈️`}
              {status.estado === 'pernoite' &&
                `${nome} tá de pernoite${
                  status.aeroportoAtual ? ` em ${status.aeroportoAtual.cidade}` : ''
                } 🌙`}
              {status.estado === 'folga' &&
                `MILAGRE! ${nome} tá ${
                  status.aeroportoAtual?.iata === 'CASA'
                    ? 'em casa (São Vicente)'
                    : `de folga${
                        status.aeroportoAtual
                          ? ` em ${status.aeroportoAtual.cidade}`
                          : ''
                      }`
                } 🎉`}
              {status.estado === 'sobreaviso' &&
                (status.aeroportoAtual?.iata === 'CASA'
                  ? `${nome} tá de sobreaviso em casa (HSB) 📞`
                  : `${nome} tá de reserva no aeroporto (${
                      status.eventoAtual?.codigoAtividade || 'ASB'
                    }) 📞`)}
              {status.estado === 'treinamento' && `${nome} tá no simulador 🎮`}
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
            <Badge variant="secondary" className="capitalize">
              {status.estado}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-xs italic text-pink-700 dark:text-pink-300 bg-pink-50/70 dark:bg-pink-950/30 border border-pink-200/70 dark:border-pink-900/50 rounded-xl px-3 py-2">
          “{fraseBregaStatus}”
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
                      Sinal sumiu igual mensagem de ex — seguindo pela escala!
                    </AlertTitle>
                    <AlertDescription>
                      Sem recepção ADS-B no momento (normal no oceano ou em
                      áreas remotas). A caricatura segue a rota calculada.
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
                  ? '🏠 Em casa'
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
                {config.atrasoPrivacidadeMinutos} min de diferença 🔒.
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
