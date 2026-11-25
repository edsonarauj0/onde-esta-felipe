import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buscarPosicaoAoVivo,
  gerarCandidatosCallsign,
  limparCacheOpenSky,
} from '@/lib/opensky';
import { parseRosterFallback } from '@/lib/parse-roster';
import { TEXTO_ESCALA_EXEMPLO } from '@/lib/demo-data';
import type { EventoEscala } from '@/lib/types';

describe('Rastreamento ADS-B (adsb.lol + airplanes.live)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    limparCacheOpenSky();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('converte códigos IATA comerciais em candidatos de callsign ATC', () => {
    const latam = gerarCandidatosCallsign('LA3366');
    expect(latam).toContain('TAM3366');
    expect(latam).toContain('LAN3366');

    const gol = gerarCandidatosCallsign('G31204');
    expect(gol).toContain('GLO1204');
  });

  it('não consulta adsb.lol fora da janela de voo', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const evento: EventoEscala = {
      id: 'ev-fora',
      tipo: 'voo',
      origem: 'GRU',
      destino: 'LIS',
      inicioUtc: '2026-11-10T22:00:00Z',
      fimUtc: '2026-11-11T08:00:00Z',
      numeroVoo: 'LA8084',
    };

    const res = await buscarPosicaoAoVivo(
      evento,
      new Date('2026-11-10T18:00:00Z')
    );

    expect(res.fonte).toBe('estimada');
    expect(res.motivo).toBe('fora-da-janela');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('busca por callsign no adsb.lol, resolve icao24, converte unidades e faz cache por 60s', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ac: [
          {
            hex: 'e48c55',
            flight: 'TAM3366 ',
            r: 'PR-MYP',
            t: 'A320',
            lat: -23.12,
            lon: -44.85,
            alt_baro: 35000, // pés -> ~10668 m
            gs: 450, // nós -> ~231.5 m/s
            track: 78.4,
          },
        ],
      }),
    });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const onResolved = vi.fn().mockResolvedValue(undefined);
    const evento: EventoEscala = {
      id: 'ev-live-callsign',
      tipo: 'voo',
      origem: 'GRU',
      destino: 'GIG',
      inicioUtc: '2026-11-10T16:00:00Z',
      fimUtc: '2026-11-10T17:00:00Z',
      numeroVoo: 'LA3366',
      callsign: 'TAM3366',
    };

    const agora = new Date('2026-11-10T16:25:00Z');
    const r1 = await buscarPosicaoAoVivo(evento, agora, onResolved);
    const r2 = await buscarPosicaoAoVivo(evento, agora, onResolved);

    expect(r1.fonte).toBe('ao-vivo');
    expect(r1.provedor).toBe('adsb.lol');
    expect(r1.icao24).toBe('e48c55');
    expect(r1.matricula).toBe('PR-MYP');
    expect(r1.aeronaveTipo).toBe('A320');
    expect(r1.lat).toBe(-23.12);
    expect(r1.lng).toBe(-44.85);
    expect(r1.altitude).toBe(Math.round(35000 * 0.3048));
    expect(r1.velocidadeMs).toBeCloseTo(231.5, 1);
    expect(r1.rumo).toBe(78.4);
    expect(r1.noSolo).toBe(false);
    expect(onResolved).toHaveBeenCalledWith('e48c55', 'TAM3366');
    expect(r2).toEqual(r1);
    // 50 familiares abrindo o app -> apenas 1 chamada ao adsb.lol no minuto
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]?.[0]).toContain(
      'https://api.adsb.lol/v2/callsign/TAM3366'
    );
  });

  it('trata alt_baro="ground" como aeronave no solo', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ac: [
          {
            hex: 'e48c55',
            flight: 'TAM3366',
            lat: -23.4356,
            lon: -46.4731,
            alt_baro: 'ground',
            gs: 12,
            track: 90,
          },
        ],
      }),
    });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const evento: EventoEscala = {
      id: 'ev-solo',
      tipo: 'voo',
      origem: 'GRU',
      destino: 'GIG',
      inicioUtc: '2026-11-10T16:00:00Z',
      fimUtc: '2026-11-10T17:00:00Z',
      icao24: 'e48c55',
    };

    const res = await buscarPosicaoAoVivo(
      evento,
      new Date('2026-11-10T15:50:00Z')
    );

    expect(res.fonte).toBe('ao-vivo');
    expect(res.noSolo).toBe(true);
    expect(res.altitude).toBe(0);
    expect(fetchSpy.mock.calls[0]?.[0]).toContain(
      'https://api.adsb.lol/v2/hex/e48c55'
    );
  });

  it('faz fallback para estimada quando não há sinal ADS-B (ex.: sobre o Atlântico)', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ac: [] }),
    });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const evento: EventoEscala = {
      id: 'ev-atlantico',
      tipo: 'voo',
      origem: 'GRU',
      destino: 'LIS',
      inicioUtc: '2026-11-10T22:00:00Z',
      fimUtc: '2026-11-11T08:00:00Z',
      icao24: 'e48c55',
    };

    const res = await buscarPosicaoAoVivo(
      evento,
      new Date('2026-11-11T03:00:00Z')
    );

    expect(res.fonte).toBe('estimada');
    expect(res.motivo).toBe('sem-sinal-adsb');
  });
});

describe('Parser de escala (Zod + fallback)', () => {
  it('interpreta o texto de escala de exemplo Crewtopia e valida com Zod', async () => {
    const { parseRosterWithClaude } = await import('@/lib/parse-roster');
    const parsed = await parseRosterWithClaude(TEXTO_ESCALA_EXEMPLO, '2026-11');
    expect(parsed.mesReferencia).toBe('2026-11');
    expect(parsed.formato).toBe('crewtopia');
    expect(parsed.eventos.length).toBeGreaterThanOrEqual(8);
    const primeiroVoo = parsed.eventos.find((e) => e.tipo === 'voo');
    expect(primeiroVoo?.origem).toBe('GRU');
    expect(primeiroVoo?.destino).toBe('VIX');
    expect(primeiroVoo?.numeroVoo).toBe('LA3336');
  });

  it('mantém fallback genérico funcional para formatos simples', () => {
    const simples = `02/11 LA8084 GRU 22:30Z -> LIS 08:00Z (+1)`;
    const parsed = parseRosterFallback(simples, '2026-11');
    expect(parsed.eventos).toHaveLength(1);
    expect(parsed.eventos[0]?.numeroVoo).toBe('LA8084');
  });
});
