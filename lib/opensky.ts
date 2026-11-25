import { estaNaJanelaOpenSky } from './status';
import type { EventoEscala, PosicaoAoVivo } from './types';

const ADSBLOL_API_BASE = 'https://api.adsb.lol/v2';
const AIRPLANES_LIVE_API_BASE = 'https://api.airplanes.live/v2';

// Mapa IATA -> prefixos ICAO de callsign usados no controle de tráfego aéreo
const IATA_PARA_CALLSIGN: Record<string, string[]> = {
  LA: ['TAM', 'LAN', 'LPE', 'LNE', 'LCO'],
  JJ: ['TAM'],
  G3: ['GLO'],
  AD: ['AZU'],
  TP: ['TAP'],
  AF: ['AFR'],
  IB: ['IBE'],
  UX: ['AEA'],
  LH: ['DLH'],
  BA: ['BAW'],
  KL: ['KLM'],
  AZ: ['ITY'],
  LX: ['SWR'],
  AA: ['AAL'],
  UA: ['UAL'],
  DL: ['DAL'],
  AC: ['ACA'],
  AM: ['AMX'],
  AV: ['AVA'],
  CM: ['CMP'],
  AR: ['ARG'],
  EK: ['UAE'],
  QR: ['QTR'],
  TK: ['THY'],
  ET: ['ETH'],
  SA: ['SAA'],
};

type AdsbV2Aircraft = {
  hex?: string;
  flight?: string;
  r?: string;
  t?: string;
  lat?: number;
  lon?: number;
  alt_baro?: number | 'ground';
  alt_geom?: number;
  gs?: number;    // knots
  track?: number; // degrees
};

type AdsbV2Response = {
  ac?: AdsbV2Aircraft[];
};

type CachedPosition = {
  data: PosicaoAoVivo;
  expiresAtMs: number;
};

const POSICAO_CACHE_TTL_MS = 60_000;
const ICAO_CACHE_TTL_MS = 6 * 60 * 60_000;

const posicaoCache = new Map<string, CachedPosition>();
const icaoResolutionCache = new Map<
  string,
  { icao24: string; callsign?: string; expiresAtMs: number }
>();

/**
 * Gera possíveis callsigns ATC a partir de um número de voo comercial (ex.: LA3366 -> TAM3366, LAN3366).
 */
export function gerarCandidatosCallsign(
  numeroVoo?: string,
  callsignExplicito?: string
): string[] {
  const candidatos = new Set<string>();
  if (callsignExplicito?.trim()) {
    candidatos.add(callsignExplicito.trim().toUpperCase().replace(/\s+/g, ''));
  }

  if (!numeroVoo?.trim()) return Array.from(candidatos);
  const limpo = numeroVoo.trim().toUpperCase().replace(/\s+/g, '');
  const match = limpo.match(/^([A-Z0-9]{2})(\d{1,4}[A-Z]?)$/);
  if (!match) {
    candidatos.add(limpo);
    return Array.from(candidatos);
  }

  const [, iata, numero] = match;
  const semZeros = numero.replace(/^0+/, '') || numero;
  const prefixos = IATA_PARA_CALLSIGN[iata] ?? [iata];

  for (const prefixo of prefixos) {
    candidatos.add(`${prefixo}${numero}`);
    candidatos.add(`${prefixo}${semZeros}`);
  }

  return Array.from(candidatos);
}

function mapearAeronaveParaPosicao(
  ac: AdsbV2Aircraft,
  provedor: 'adsb.lol' | 'airplanes.live',
  evento: EventoEscala
): PosicaoAoVivo | null {
  if (typeof ac.lat !== 'number' || typeof ac.lon !== 'number') {
    return null;
  }

  const noSolo = ac.alt_baro === 'ground';
  const altitudePes =
    typeof ac.alt_baro === 'number'
      ? ac.alt_baro
      : typeof ac.alt_geom === 'number'
        ? ac.alt_geom
        : null;

  return {
    fonte: 'ao-vivo',
    provedor,
    icao24: ac.hex?.trim().toLowerCase() || evento.icao24,
    callsign: ac.flight?.trim().toUpperCase() || evento.callsign || null,
    matricula: ac.r?.trim().toUpperCase() || null,
    aeronaveTipo: ac.t?.trim().toUpperCase() || null,
    lng: ac.lon,
    lat: ac.lat,
    altitude:
      noSolo
        ? 0
        : altitudePes !== null
          ? Math.round(altitudePes * 0.3048)
          : null,
    velocidadeMs:
      typeof ac.gs === 'number' ? Math.round(ac.gs * 0.514444 * 10) / 10 : null,
    rumo: typeof ac.track === 'number' ? ac.track : null,
    noSolo,
    atualizadoEm: new Date().toISOString(),
  };
}

async function consultarAdsbEndpoint(
  url: string
): Promise<AdsbV2Aircraft | null> {
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'onde-esta-felipe/1.0',
      },
      signal: AbortSignal.timeout(7000),
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as AdsbV2Response;
    if (!Array.isArray(json.ac) || json.ac.length === 0) return null;
    return (
      json.ac.find(
        (a) => typeof a.lat === 'number' && typeof a.lon === 'number'
      ) ?? json.ac[0] ?? null
    );
  } catch {
    return null;
  }
}

async function buscarPorHex(
  icao24: string,
  evento: EventoEscala
): Promise<PosicaoAoVivo | null> {
  const hex = icao24.trim().toLowerCase();

  // 1. Principal: adsb.lol (gratuito, sem cadastro/API key)
  const acPrimary = await consultarAdsbEndpoint(
    `${ADSBLOL_API_BASE}/hex/${encodeURIComponent(hex)}`
  );
  if (acPrimary) {
    const mapped = mapearAeronaveParaPosicao(acPrimary, 'adsb.lol', evento);
    if (mapped) return mapped;
  }

  // 2. Backup gratuito: airplanes.live
  const acBackup = await consultarAdsbEndpoint(
    `${AIRPLANES_LIVE_API_BASE}/hex/${encodeURIComponent(hex)}`
  );
  if (acBackup) {
    const mapped = mapearAeronaveParaPosicao(
      acBackup,
      'airplanes.live',
      evento
    );
    if (mapped) return mapped;
  }

  return null;
}

async function buscarPorCallsign(
  candidatos: string[],
  evento: EventoEscala
): Promise<PosicaoAoVivo | null> {
  // Limita a 3 primeiros candidatos mais prováveis (ex.: TAM3366, LAN3366)
  const topCandidatos = candidatos.slice(0, 3);

  for (const callsign of topCandidatos) {
    const acPrimary = await consultarAdsbEndpoint(
      `${ADSBLOL_API_BASE}/callsign/${encodeURIComponent(callsign)}`
    );
    if (acPrimary) {
      const mapped = mapearAeronaveParaPosicao(acPrimary, 'adsb.lol', evento);
      if (mapped) return mapped;
    }
  }

  // Fallback para airplanes.live com o candidato principal
  if (topCandidatos[0]) {
    const acBackup = await consultarAdsbEndpoint(
      `${AIRPLANES_LIVE_API_BASE}/callsign/${encodeURIComponent(
        topCandidatos[0]
      )}`
    );
    if (acBackup) {
      const mapped = mapearAeronaveParaPosicao(
        acBackup,
        'airplanes.live',
        evento
      );
      if (mapped) return mapped;
    }
  }

  return null;
}

/**
 * Busca posição ao vivo usando adsb.lol (principal, gratuito e sem conta)
 * com backup em airplanes.live e cache de 60 segundos por eventoId.
 *
 * - Fora da janela (partida - 1h até chegada + 1h): não faz chamadas externas.
 * - Com 2 ou 50 familiares conectados: no máximo 1 consulta por minuto.
 * - Sem sinal ADS-B (ex.: oceano): devolve `{ fonte: 'estimada' }`.
 */
export async function buscarPosicaoAoVivo(
  evento: EventoEscala,
  agora: Date = new Date(),
  onIcaoResolved?: (icao24: string, callsign?: string) => Promise<void>
): Promise<PosicaoAoVivo> {
  // 1. Fora da janela do voo: usa somente a escala
  if (!estaNaJanelaOpenSky(evento, agora)) {
    return {
      fonte: 'estimada',
      motivo: 'fora-da-janela',
      atualizadoEm: agora.toISOString(),
    };
  }

  // 2. Cache em memória de 60s
  const cached = posicaoCache.get(evento.id);
  if (cached && cached.expiresAtMs > Date.now()) {
    return cached.data;
  }

  // 3. Tenta primeiro por icao24 (do evento ou cache de resolução)
  const cacheKey = `${evento.id}:${evento.numeroVoo ?? ''}`;
  const icaoCached = icaoResolutionCache.get(cacheKey);
  const icao24Conhecido =
    evento.icao24?.trim().toLowerCase() ||
    (icaoCached && icaoCached.expiresAtMs > Date.now()
      ? icaoCached.icao24
      : undefined);

  let aoVivo: PosicaoAoVivo | null = null;

  if (icao24Conhecido) {
    aoVivo = await buscarPorHex(icao24Conhecido, evento);
  }

  // 4. Se ainda não encontrou (ou não tinha icao24), busca direto pelo callsign no adsb.lol!
  if (!aoVivo) {
    const candidatos = gerarCandidatosCallsign(
      evento.numeroVoo,
      evento.callsign
    );
    if (candidatos.length > 0) {
      aoVivo = await buscarPorCallsign(candidatos, evento);

      // Se resolveu o icao24 da aeronave, guarda em cache e persiste no Firestore
      if (aoVivo?.icao24 && aoVivo.icao24 !== evento.icao24) {
        icaoResolutionCache.set(cacheKey, {
          icao24: aoVivo.icao24,
          callsign: aoVivo.callsign ?? undefined,
          expiresAtMs: Date.now() + ICAO_CACHE_TTL_MS,
        });
        if (onIcaoResolved) {
          await onIcaoResolved(
            aoVivo.icao24,
            aoVivo.callsign ?? undefined
          ).catch(() => {});
        }
      }
    }
  }

  if (aoVivo) {
    posicaoCache.set(evento.id, {
      data: aoVivo,
      expiresAtMs: Date.now() + POSICAO_CACHE_TTL_MS,
    });
    return aoVivo;
  }

  // 5. Sem cobertura ADS-B no momento -> fallback suave para arco da escala
  const estimada: PosicaoAoVivo = {
    fonte: 'estimada',
    motivo: 'sem-sinal-adsb',
    icao24: icao24Conhecido,
    atualizadoEm: agora.toISOString(),
  };

  posicaoCache.set(evento.id, {
    data: estimada,
    expiresAtMs: Date.now() + POSICAO_CACHE_TTL_MS,
  });

  return estimada;
}

export function limparCacheOpenSky(): void {
  posicaoCache.clear();
  icaoResolutionCache.clear();
}
