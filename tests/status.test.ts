import { describe, expect, it } from 'vitest';
import { formatarCidadeEstado, getAeroporto } from '@/lib/airports';
import {
  calcularMudancasImportacao,
  calcularResumoMes,
  estaNaJanelaOpenSky,
  formatarDataHoraUtc,
  formatarDataLocal,
  formatarMesAno,
  getStatus,
} from '@/lib/status';
import type { EventoEscala } from '@/lib/types';

const EVENTOS_BASE: EventoEscala[] = [
  {
    id: 'voo-1',
    tipo: 'voo',
    origem: 'GRU',
    destino: 'LIS',
    inicioUtc: '2026-11-10T22:00:00Z',
    fimUtc: '2026-11-11T08:00:00Z',
    numeroVoo: 'LA8084',
  },
  {
    id: 'pernoite-1',
    tipo: 'pernoite',
    origem: 'LIS',
    destino: 'LIS',
    inicioUtc: '2026-11-11T08:30:00Z',
    fimUtc: '2026-11-12T10:00:00Z',
  },
  {
    id: 'voo-2',
    tipo: 'voo',
    origem: 'LIS',
    destino: 'GRU',
    inicioUtc: '2026-11-12T11:00:00Z',
    fimUtc: '2026-11-12T21:00:00Z',
    numeroVoo: 'LA8085',
  },
  {
    id: 'folga-1',
    tipo: 'folga',
    origem: 'GRU',
    destino: 'GRU',
    inicioUtc: '2026-11-13T00:00:00Z',
    fimUtc: '2026-11-14T23:59:00Z',
  },
];

describe('getStatus', () => {
  it('retorna sem-escala quando não há eventos', () => {
    const res = getStatus([], new Date('2026-11-10T12:00:00Z'));
    expect(res.estado).toBe('sem-escala');
    expect(res.aeroportoAtual?.iata).toBe('GRU');
    expect(res.rota).toBeNull();
  });

  it('calcula voo ativo, progresso 50% e arco geodésico entre GRU e LIS', () => {
    // Metade exata de 10h de voo: 03:00Z
    const res = getStatus(EVENTOS_BASE, new Date('2026-11-11T03:00:00Z'));
    expect(res.estado).toBe('voo');
    expect(res.eventoAtual?.id).toBe('voo-1');
    expect(res.progresso).toBe(50);
    expect(res.origemAeroporto?.iata).toBe('GRU');
    expect(res.destinoAeroporto?.iata).toBe('LIS');
    expect(res.rota).not.toBeNull();
    expect(res.rota!.distanciaTotalKm).toBeGreaterThan(7500);
    expect(res.rota!.distanciaTotalKm).toBeLessThan(8300);
    // Meio do Atlântico (entre São Paulo e Lisboa)
    expect(res.coordenada[0]).toBeGreaterThan(-40);
    expect(res.coordenada[0]).toBeLessThan(-15);
    expect(res.coordenada[1]).toBeGreaterThan(-5);
    expect(res.coordenada[1]).toBeLessThan(20);
  });

  it('retorna pernoite em Lisboa durante o descanso', () => {
    const res = getStatus(EVENTOS_BASE, new Date('2026-11-11T15:00:00Z'));
    expect(res.estado).toBe('pernoite');
    expect(res.aeroportoAtual?.iata).toBe('LIS');
    expect(res.proximoEvento?.id).toBe('voo-2');
  });

  it('retorna folga em casa (São Vicente) após o retorno para a base', () => {
    const res = getStatus(EVENTOS_BASE, new Date('2026-11-13T12:00:00Z'));
    expect(res.estado).toBe('folga');
    expect(res.aeroportoAtual?.iata).toBe('CASA');
    expect(res.aeroportoAtual?.cidade).toBe('São Vicente');
  });

  it('posiciona HSB em casa (São Vicente) e ASB no aeroporto', () => {
    const eventosStandby: EventoEscala[] = [
      {
        id: 'hsb-1',
        tipo: 'sobreaviso',
        codigoAtividade: 'HSB',
        origem: 'CGH',
        destino: 'CGH',
        inicioUtc: '2026-11-15T03:05:00Z',
        fimUtc: '2026-11-15T08:10:00Z',
      },
      {
        id: 'asb-1',
        tipo: 'sobreaviso',
        codigoAtividade: 'ASB',
        origem: 'CGH',
        destino: 'CGH',
        inicioUtc: '2026-11-15T12:35:00Z',
        fimUtc: '2026-11-15T18:30:00Z',
      },
    ];

    const hsb = getStatus(eventosStandby, new Date('2026-11-15T05:00:00Z'));
    expect(hsb.estado).toBe('sobreaviso');
    expect(hsb.aeroportoAtual?.iata).toBe('CASA');
    expect(hsb.aeroportoAtual?.cidade).toBe('São Vicente');

    const asb = getStatus(eventosStandby, new Date('2026-11-15T14:00:00Z'));
    expect(asb.estado).toBe('sobreaviso');
    expect(asb.aeroportoAtual?.iata).toBe('CGH');
  });

  it('ignora voos cancelados e respeita atraso manual', () => {
    const comAjustes: EventoEscala[] = [
      {
        ...EVENTOS_BASE[0]!,
        atrasoMinutos: 60, // passa a decolar 23:00Z e pousar 09:00Z
      },
      {
        ...EVENTOS_BASE[2]!,
        cancelado: true,
      },
    ];
    // Às 08:30Z ainda está voando devido ao atraso de 60 min
    const res = getStatus(comAjustes, new Date('2026-11-11T08:30:00Z'));
    expect(res.estado).toBe('voo');
    expect(res.progresso).toBe(95);
    expect(res.proximosEventos).toHaveLength(0);
  });

  it('aplica atraso opcional do modo privacidade', () => {
    // 22:20Z com atraso de privacidade de 30 min -> referencia efetiva 21:50Z (antes da decolagem 22:00Z)
    const res = getStatus(EVENTOS_BASE, new Date('2026-11-10T22:20:00Z'), {
      modoPrivacidade: true,
      atrasoPrivacidadeMinutos: 30,
    });
    expect(res.privacidadeAplicada).toBe(true);
    expect(res.estado).toBe('folga');
  });

  it('calcula resumo mensal corretamente', () => {
    const resumo = calcularResumoMes(EVENTOS_BASE);
    expect(resumo.totalVoos).toBe(2);
    expect(resumo.totalPernoites).toBe(1);
    expect(resumo.totalFolgas).toBe(1);
    expect(resumo.horasVoo).toBe(20);
    expect(resumo.distanciaTotalKm).toBeGreaterThan(15000);
  });
});

describe('estaNaJanelaOpenSky', () => {
  const voo = EVENTOS_BASE[0]!; // 22:00Z -> 08:00Z

  it('permite consulta entre partida - 1h e chegada + 1h', () => {
    expect(estaNaJanelaOpenSky(voo, new Date('2026-11-10T21:00:00Z'))).toBe(true);
    expect(estaNaJanelaOpenSky(voo, new Date('2026-11-11T03:00:00Z'))).toBe(true);
    expect(estaNaJanelaOpenSky(voo, new Date('2026-11-11T09:00:00Z'))).toBe(true);
  });

  it('bloqueia consulta fora da janela para economizar créditos', () => {
    expect(estaNaJanelaOpenSky(voo, new Date('2026-11-10T20:59:00Z'))).toBe(false);
    expect(estaNaJanelaOpenSky(voo, new Date('2026-11-11T09:01:00Z'))).toBe(false);
  });
});

describe('Formatação de datas (dd/mm/aaaa)', () => {
  it('formata data local, data/hora UTC e mês/ano no padrão brasileiro', () => {
    expect(formatarDataLocal('2026-11-25T15:30:00Z', 'America/Sao_Paulo')).toBe(
      '25/11/2026'
    );
    expect(formatarDataHoraUtc('2026-11-25T15:30:00Z')).toBe('25/11/2026 15:30');
    expect(formatarMesAno('2026-11')).toBe('11/2026');
  });

  it('reconhece aeroportos regionais brasileiros com Cidade/UF', () => {
    expect(formatarCidadeEstado(getAeroporto('OPS'))).toBe('Sinop/MT');
    expect(formatarCidadeEstado(getAeroporto('XAP'))).toBe('Chapecó/SC');
    expect(formatarCidadeEstado(getAeroporto('PFB'))).toBe('Passo Fundo/RS');
    expect(formatarCidadeEstado(getAeroporto('VDC'))).toBe('Vitória da Conquista/BA');
    expect(formatarCidadeEstado(getAeroporto('MAB'))).toBe('Marabá/PA');
    expect(formatarCidadeEstado(getAeroporto('JDO'))).toBe('Juazeiro do Norte/CE');
  });
});

describe('calcularMudancasImportacao (reimportação no meio do mês)', () => {
  const agoraMeioMes = new Date('2026-11-12T00:00:00Z');
  const antigos: EventoEscala[] = [
    {
      id: 'passado-1',
      tipo: 'voo',
      origem: 'GRU',
      destino: 'GIG',
      inicioUtc: '2026-11-05T12:00:00Z',
      fimUtc: '2026-11-05T13:00:00Z',
      numeroVoo: 'LA3366',
      icao24: 'e48c55',
    },
    {
      id: 'futuro-antigo',
      tipo: 'voo',
      origem: 'GRU',
      destino: 'FOR',
      inicioUtc: '2026-11-15T12:00:00Z',
      fimUtc: '2026-11-15T15:00:00Z',
      numeroVoo: 'LA3318',
    },
  ];
  const novos: EventoEscala[] = [
    {
      id: 'futuro-novo',
      tipo: 'voo',
      origem: 'GRU',
      destino: 'MAO',
      inicioUtc: '2026-11-15T14:00:00Z',
      fimUtc: '2026-11-15T18:00:00Z',
      numeroVoo: 'LA3847',
    },
  ];

  it('no modo atualizar-futuros preserva eventos passados e substitui apenas os futuros', () => {
    const res = calcularMudancasImportacao(
      antigos,
      novos,
      'atualizar-futuros',
      agoraMeioMes
    );
    expect(res.passadosPreservados).toBe(1);
    expect(res.futurosSubstituidos).toBe(1);
    expect(res.idsParaRemover).toEqual(['futuro-antigo']);
    expect(res.eventosFinais.map((e) => e.id)).toEqual([
      'passado-1',
      'futuro-novo',
    ]);
    // Preserva inclusive o icao24 já resolvido do voo passado
    expect(res.eventosFinais[0]?.icao24).toBe('e48c55');
  });

  it('no modo substituir remove tudo do mês anterior e mantém apenas os novos', () => {
    const res = calcularMudancasImportacao(
      antigos,
      novos,
      'substituir',
      agoraMeioMes
    );
    expect(res.idsParaRemover).toEqual(['passado-1', 'futuro-antigo']);
    expect(res.eventosFinais.map((e) => e.id)).toEqual(['futuro-novo']);
  });
});
