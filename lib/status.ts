import along from '@turf/along';
import bearing from '@turf/bearing';
import greatCircle from '@turf/great-circle';
import { lineString, point } from '@turf/helpers';
import length from '@turf/length';
import { formatInTimeZone } from 'date-fns-tz';
import { ptBR } from 'date-fns/locale';
import {
  AEROPORTO_PADRAO,
  CASA_FELIPE,
  formatarCidadeEstado,
  getAeroporto,
} from './airports';
import type {
  Aeroporto,
  ConfiguracoesApp,
  EventoEscala,
  ModoPublicacao,
  ResumoMes,
  RotaGeoJSON,
  StatusFelipe,
} from './types';

export const CONFIG_PADRAO: ConfiguracoesApp = {
  nomePiloto: 'Felipe',
  baseIata: 'GRU',
  mesAtivo: new Date().toISOString().slice(0, 7),
  modoPrivacidade: true,
  atrasoPrivacidadeMinutos: 0,
  exigirConvite: false,
};

export function aplicarAtraso(isoUtc: string, atrasoMinutos = 0): Date {
  const base = new Date(isoUtc).getTime();
  return new Date(base + atrasoMinutos * 60_000);
}

export function getIntervaloEfetivo(evento: EventoEscala): {
  inicio: Date;
  fim: Date;
} {
  const atraso = evento.atrasoMinutos ?? 0;
  return {
    inicio: aplicarAtraso(evento.inicioUtc, atraso),
    fim: aplicarAtraso(evento.fimUtc, atraso),
  };
}

/**
 * Normaliza a linha retornada pelo @turf/great-circle (que pode ser LineString ou MultiLineString
 * ao cruzar o antimeridiano) para uma única Feature<LineString>.
 */
function normalizarGreatCircle(
  origem: Aeroporto,
  destino: Aeroporto
): GeoJSON.Feature<GeoJSON.LineString> {
  if (origem.iata === destino.iata) {
    return lineString([
      [origem.lng, origem.lat],
      [destino.lng, destino.lat],
    ]);
  }

  const gc = greatCircle(
    point([origem.lng, origem.lat]),
    point([destino.lng, destino.lat]),
    { npoints: 100 }
  );

  if (gc.geometry.type === 'LineString') {
    return gc as GeoJSON.Feature<GeoJSON.LineString>;
  }

  // MultiLineString (antimeridiano): concatena os segmentos mantendo a ordem
  const coords = gc.geometry.coordinates.flat();
  return lineString(coords);
}

/**
 * Calcula arco de grande círculo, posição estimada, rumo e segmentos percorrido/restante.
 */
export function calcularPosicaoNoArco(
  origem: Aeroporto,
  destino: Aeroporto,
  progresso01: number
): {
  coordenada: [number, number];
  rumo: number;
  rota: RotaGeoJSON;
} {
  const clamped = Math.max(0, Math.min(1, progresso01));
  const completa = normalizarGreatCircle(origem, destino);
  const distanciaTotalKm = length(completa, { units: 'kilometers' });

  if (distanciaTotalKm <= 0.1) {
    const coord: [number, number] = [origem.lng, origem.lat];
    return {
      coordenada: coord,
      rumo: 0,
      rota: {
        completa,
        percorrida: lineString([coord, coord]),
        restante: lineString([coord, coord]),
        distanciaTotalKm: 0,
      },
    };
  }

  const distanciaAtual = distanciaTotalKm * clamped;
  const pontoAtual = along(completa, distanciaAtual, { units: 'kilometers' });
  const pontoFrente = along(
    completa,
    Math.min(distanciaTotalKm, distanciaAtual + Math.max(10, distanciaTotalKm * 0.02)),
    { units: 'kilometers' }
  );

  const rumoBruto =
    clamped >= 0.995
      ? bearing(
          along(completa, Math.max(0, distanciaTotalKm - 20), { units: 'kilometers' }),
          pontoAtual
        )
      : bearing(pontoAtual, pontoFrente);

  const rumo = ((rumoBruto % 360) + 360) % 360;
  const coordenada = pontoAtual.geometry.coordinates as [number, number];

  const coords = completa.geometry.coordinates;
  const splitIdx = Math.max(
    1,
    Math.min(coords.length - 1, Math.round(clamped * (coords.length - 1)))
  );

  const percorridaCoords = [...coords.slice(0, splitIdx), coordenada];
  const restanteCoords = [coordenada, ...coords.slice(splitIdx)];

  return {
    coordenada,
    rumo,
    rota: {
      completa,
      percorrida: lineString(
        percorridaCoords.length >= 2 ? percorridaCoords : [coords[0], coordenada]
      ),
      restante: lineString(
        restanteCoords.length >= 2
          ? restanteCoords
          : [coordenada, coords[coords.length - 1]]
      ),
      distanciaTotalKm,
    },
  };
}

/**
 * Encontra o último aeroporto conhecido antes de um instante (útil em folgas/pernoites sem origem explícita).
 */
function inferirAeroportoAtual(
  eventosAtivos: EventoEscala[],
  agoraMs: number,
  base: Aeroporto
): Aeroporto {
  let ultimoDestino: Aeroporto | null = null;
  for (const ev of eventosAtivos) {
    const { fim } = getIntervaloEfetivo(ev);
    if (fim.getTime() <= agoraMs) {
      const dest = getAeroporto(ev.destino ?? ev.origem);
      if (dest) ultimoDestino = dest;
    }
  }
  return ultimoDestino ?? base;
}

function isAeroportoDaBase(iata: string | undefined, baseIata: string): boolean {
  if (!iata) return true;
  const upper = iata.toUpperCase();
  const baseUpper = baseIata.toUpperCase();
  if (upper === baseUpper) return true;
  // Base São Paulo inclui Guarulhos, Congonhas e Viracopos
  if (['GRU', 'CGH', 'VCP'].includes(baseUpper)) {
    return ['GRU', 'CGH', 'VCP'].includes(upper);
  }
  return false;
}

/**
 * Função principal: determina onde o Felipe está em um dado instante `agora`.
 */
export function getStatus(
  eventos: EventoEscala[],
  agora: Date = new Date(),
  config: Partial<ConfiguracoesApp> = {}
): StatusFelipe {
  const cfg: ConfiguracoesApp = { ...CONFIG_PADRAO, ...config };
  const base = getAeroporto(cfg.baseIata) ?? AEROPORTO_PADRAO;

  const atrasoPrivMs =
    cfg.atrasoPrivacidadeMinutos > 0
      ? cfg.atrasoPrivacidadeMinutos * 60_000
      : 0;

  const agoraEfetivo = new Date(agora.getTime() - atrasoPrivMs);
  const agoraMs = agoraEfetivo.getTime();

  const eventosValidos = [...eventos]
    .filter((e) => !e.cancelado)
    .sort(
      (a, b) =>
        getIntervaloEfetivo(a).inicio.getTime() -
        getIntervaloEfetivo(b).inicio.getTime()
    );

  if (eventosValidos.length === 0) {
    return {
      estado: 'sem-escala',
      eventoAtual: null,
      proximoEvento: null,
      proximosEventos: [],
      progresso: 0,
      coordenada: [base.lng, base.lat],
      rumo: 0,
      rota: null,
      origemAeroporto: null,
      destinoAeroporto: null,
      aeroportoAtual: base,
      inicioEfetivoUtc: null,
      fimEfetivoUtc: null,
      tempoRestanteMs: null,
      referenciaAgoraUtc: agoraEfetivo.toISOString(),
      privacidadeAplicada: atrasoPrivMs > 0,
    };
  }

  // Encontra evento ativo agora (prioriza 'voo' se houver sobreposição mínima)
  const ativos = eventosValidos.filter((ev) => {
    const { inicio, fim } = getIntervaloEfetivo(ev);
    return agoraMs >= inicio.getTime() && agoraMs <= fim.getTime();
  });

  const eventoAtual =
    ativos.find((e) => e.tipo === 'voo') ?? ativos[0] ?? null;

  const proximosEventos = eventosValidos.filter((ev) => {
    const { inicio } = getIntervaloEfetivo(ev);
    return inicio.getTime() > agoraMs;
  });

  const proximoEvento = proximosEventos[0] ?? null;

  if (!eventoAtual) {
    // Entre eventos: se o último destino foi fora da base -> pernoite; se na base -> em casa (São Vicente)
    const ultimoAeroporto = inferirAeroportoAtual(eventosValidos, agoraMs, base);
    const naBase = isAeroportoDaBase(ultimoAeroporto.iata, base.iata);
    const estadoImplicito = naBase ? 'folga' : 'pernoite';
    const localAtual = naBase ? CASA_FELIPE : ultimoAeroporto;

    return {
      estado: estadoImplicito,
      eventoAtual: null,
      proximoEvento,
      proximosEventos: proximosEventos.slice(0, 12),
      progresso: 0,
      coordenada: [localAtual.lng, localAtual.lat],
      rumo: 0,
      rota: null,
      origemAeroporto: null,
      destinoAeroporto: null,
      aeroportoAtual: localAtual,
      inicioEfetivoUtc: null,
      fimEfetivoUtc: null,
      tempoRestanteMs: proximoEvento
        ? getIntervaloEfetivo(proximoEvento).inicio.getTime() - agoraMs
        : null,
      referenciaAgoraUtc: agoraEfetivo.toISOString(),
      privacidadeAplicada: atrasoPrivMs > 0,
    };
  }

  const { inicio, fim } = getIntervaloEfetivo(eventoAtual);
  const duracaoMs = Math.max(1, fim.getTime() - inicio.getTime());
  const decorridoMs = Math.max(0, Math.min(duracaoMs, agoraMs - inicio.getTime()));
  const progresso01 = decorridoMs / duracaoMs;
  const progresso = Math.round(progresso01 * 100);
  const tempoRestanteMs = Math.max(0, fim.getTime() - agoraMs);

  if (eventoAtual.tipo === 'voo') {
    const origem = getAeroporto(eventoAtual.origem) ?? base;
    const destino = getAeroporto(eventoAtual.destino) ?? base;
    const { coordenada, rumo, rota } = calcularPosicaoNoArco(
      origem,
      destino,
      progresso01
    );

    return {
      estado: 'voo',
      eventoAtual,
      proximoEvento,
      proximosEventos: proximosEventos.slice(0, 12),
      progresso,
      coordenada,
      rumo,
      rota,
      origemAeroporto: origem,
      destinoAeroporto: destino,
      aeroportoAtual: null,
      inicioEfetivoUtc: inicio.toISOString(),
      fimEfetivoUtc: fim.toISOString(),
      tempoRestanteMs,
      referenciaAgoraUtc: agoraEfetivo.toISOString(),
      privacidadeAplicada: atrasoPrivMs > 0,
    };
  }

  const aeroportoEvento =
    getAeroporto(eventoAtual.destino ?? eventoAtual.origem) ??
    inferirAeroportoAtual(eventosValidos, agoraMs, base);

  // Folga na base (DO/DR/OFF) ou Sobreaviso em casa (HSB) -> posiciona em casa (São Vicente, SP)
  const emCasa =
    (eventoAtual.tipo === 'folga' &&
      isAeroportoDaBase(aeroportoEvento.iata, base.iata)) ||
    (eventoAtual.tipo === 'sobreaviso' &&
      eventoAtual.codigoAtividade?.toUpperCase() === 'HSB');

  const aeroportoAtual = emCasa ? CASA_FELIPE : aeroportoEvento;

  return {
    estado: eventoAtual.tipo,
    eventoAtual,
    proximoEvento,
    proximosEventos: proximosEventos.slice(0, 12),
    progresso,
    coordenada: [aeroportoAtual.lng, aeroportoAtual.lat],
    rumo: 0,
    rota: null,
    origemAeroporto: getAeroporto(eventoAtual.origem),
    destinoAeroporto: getAeroporto(eventoAtual.destino),
    aeroportoAtual,
    inicioEfetivoUtc: inicio.toISOString(),
    fimEfetivoUtc: fim.toISOString(),
    tempoRestanteMs,
    referenciaAgoraUtc: agoraEfetivo.toISOString(),
    privacidadeAplicada: atrasoPrivMs > 0,
  };
}

/**
 * Verifica se o voo está dentro da janela permitida para consulta OpenSky:
 * partida - 1h até chegada + 1h.
 */
export function estaNaJanelaOpenSky(
  evento: EventoEscala,
  agora: Date = new Date()
): boolean {
  if (evento.tipo !== 'voo' || evento.cancelado) return false;
  const { inicio, fim } = getIntervaloEfetivo(evento);
  const umaHoraMs = 60 * 60 * 1000;
  const agoraMs = agora.getTime();
  return (
    agoraMs >= inicio.getTime() - umaHoraMs &&
    agoraMs <= fim.getTime() + umaHoraMs
  );
}

export function formatarHoraLocal(
  isoUtc: string,
  timeZone: string,
  padrao = 'HH:mm'
): string {
  try {
    return formatInTimeZone(new Date(isoUtc), timeZone, padrao, {
      locale: ptBR,
    });
  } catch {
    return formatInTimeZone(new Date(isoUtc), 'America/Sao_Paulo', padrao, {
      locale: ptBR,
    });
  }
}

export function formatarDataLocal(isoUtc: string, timeZone: string): string {
  return formatarHoraLocal(isoUtc, timeZone, 'dd/MM/yyyy');
}

export function formatarDataHoraUtc(isoUtc?: string | null): string {
  if (!isoUtc) return '—';
  return formatarHoraLocal(isoUtc, 'UTC', 'dd/MM/yyyy HH:mm');
}

export function formatarMesAno(yyyyMm?: string | null): string {
  if (!yyyyMm) return '';
  const match = yyyyMm.match(/^(\d{4})-(\d{2})$/);
  return match ? `${match[2]}/${match[1]}` : yyyyMm;
}

/**
 * Calcula quais eventos devem ser mantidos, removidos e gravados ao importar
 * uma nova escala no mesmo mês:
 * - `atualizar-futuros`: preserva eventos já concluídos (fimUtc < agora) e substitui apenas os em andamento/futuros.
 * - `substituir`: apaga todos os eventos existentes do mês e grava apenas os novos.
 * - `complementar`: mantém todos os existentes e adiciona/atualiza os novos por ID.
 */
export function calcularMudancasImportacao(
  existentes: EventoEscala[],
  novos: EventoEscala[],
  modo: ModoPublicacao,
  agora: Date = new Date()
): {
  idsParaRemover: string[];
  eventosParaGravar: EventoEscala[];
  eventosFinais: EventoEscala[];
  passadosPreservados: number;
  futurosSubstituidos: number;
} {
  const agoraMs = agora.getTime();

  if (modo === 'substituir') {
    const idsNovos = new Set(novos.map((e) => e.id));
    const idsParaRemover = existentes
      .filter((e) => !idsNovos.has(e.id))
      .map((e) => e.id);
    return {
      idsParaRemover,
      eventosParaGravar: novos,
      eventosFinais: novos,
      passadosPreservados: 0,
      futurosSubstituidos: existentes.length,
    };
  }

  if (modo === 'complementar') {
    const mapa = new Map<string, EventoEscala>();
    for (const ev of existentes) mapa.set(ev.id, ev);
    for (const ev of novos) mapa.set(ev.id, ev);
    const finais = Array.from(mapa.values()).sort(
      (a, b) =>
        new Date(a.inicioUtc).getTime() - new Date(b.inicioUtc).getTime()
    );
    return {
      idsParaRemover: [],
      eventosParaGravar: novos,
      eventosFinais: finais,
      passadosPreservados: existentes.filter(
        (e) => getIntervaloEfetivo(e).fim.getTime() < agoraMs
      ).length,
      futurosSubstituidos: 0,
    };
  }

  // Modo 'atualizar-futuros' (padrão recomendado para mudança de escala no meio do mês)
  const passadosExistentes = existentes.filter(
    (e) => getIntervaloEfetivo(e).fim.getTime() < agoraMs
  );
  const futurosExistentes = existentes.filter(
    (e) => getIntervaloEfetivo(e).fim.getTime() >= agoraMs
  );

  // Dos novos eventos do PDF:
  // - todos os em andamento/futuros entram (substituindo os futuros antigos)
  // - eventos passados do PDF só entram se ainda não havia nenhum evento passado salvo
  const novosParaGravar =
    passadosExistentes.length > 0
      ? novos.filter((e) => getIntervaloEfetivo(e).fim.getTime() >= agoraMs)
      : novos;

  const idsGravados = new Set(novosParaGravar.map((e) => e.id));
  const idsParaRemover = futurosExistentes
    .filter((e) => !idsGravados.has(e.id))
    .map((e) => e.id);

  const mapaFinal = new Map<string, EventoEscala>();
  for (const ev of passadosExistentes) mapaFinal.set(ev.id, ev);
  for (const ev of novosParaGravar) mapaFinal.set(ev.id, ev);

  const eventosFinais = Array.from(mapaFinal.values()).sort(
    (a, b) => new Date(a.inicioUtc).getTime() - new Date(b.inicioUtc).getTime()
  );

  return {
    idsParaRemover,
    eventosParaGravar: novosParaGravar,
    eventosFinais,
    passadosPreservados: passadosExistentes.length,
    futurosSubstituidos: futurosExistentes.length,
  };
}

export function formatarDuracao(ms: number | null): string {
  if (ms === null || ms <= 0) return '0min';
  const totalMin = Math.round(ms / 60_000);
  const horas = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (horas <= 0) return `${mins}min`;
  if (mins === 0) return `${horas}h`;
  return `${horas}h ${mins}min`;
}

export function calcularResumoMes(eventos: EventoEscala[]): ResumoMes {
  const validos = eventos.filter((e) => !e.cancelado);
  let totalVoos = 0;
  let totalPernoites = 0;
  let totalFolgas = 0;
  let distanciaTotalKm = 0;
  let horasVoo = 0;
  const cidadesSet = new Set<string>();

  for (const ev of validos) {
    if (ev.tipo === 'voo') {
      totalVoos++;
      const origem = getAeroporto(ev.origem);
      const destino = getAeroporto(ev.destino);
      if (origem && destino) {
        const { rota } = calcularPosicaoNoArco(origem, destino, 0.5);
        distanciaTotalKm += rota.distanciaTotalKm;
        cidadesSet.add(`${formatarCidadeEstado(destino)} (${destino.iata})`);
      }
      const durH =
        (new Date(ev.fimUtc).getTime() - new Date(ev.inicioUtc).getTime()) /
        3_600_000;
      if (durH > 0) horasVoo += durH;
    } else if (ev.tipo === 'pernoite') {
      totalPernoites++;
      const ap = getAeroporto(ev.destino ?? ev.origem);
      if (ap) cidadesSet.add(`${formatarCidadeEstado(ap)} (${ap.iata})`);
    } else if (ev.tipo === 'folga') {
      totalFolgas++;
    }
  }

  return {
    totalVoos,
    totalPernoites,
    totalFolgas,
    distanciaTotalKm: Math.round(distanciaTotalKm),
    horasVoo: Math.round(horasVoo * 10) / 10,
    cidadesVisitadas: Array.from(cidadesSet),
  };
}
