import { describe, expect, it } from 'vitest';
import { formatarCidadeEstado, getAeroporto } from '@/lib/airports';
import {
  calcularMudancasImportacao,
  calcularResumoMes,
  deslocarMes,
  estaNaJanelaOpenSky,
  formatarDataHoraUtc,
  formatarDataLocal,
  formatarMesAno,
  getMesesJanela,
  getMesReferencia,
  getStatus,
  mesclarEventosDeMeses,
  selecionarMesResumo,
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

  it('retorna em-solo (e não pernoite) quando há múltiplos voos no mesmo dia fora da base', () => {
    const eventosMesmoDia: EventoEscala[] = [
      {
        id: '2026-11-27-01-la3266',
        tipo: 'voo',
        origem: 'GRU',
        destino: 'GYN',
        inicioUtc: '2026-11-27T14:00:00Z', // 11:00 BRT
        fimUtc: '2026-11-27T15:40:00Z', // 12:40 BRT
        numeroVoo: 'LA3266',
      },
      {
        id: '2026-11-27-02-la3267',
        tipo: 'voo',
        origem: 'GYN',
        destino: 'GRU',
        inicioUtc: '2026-11-27T17:05:00Z', // 14:05 BRT
        fimUtc: '2026-11-27T18:55:00Z', // 15:55 BRT
        numeroVoo: 'LA3267',
      },
      {
        id: '2026-11-27-03-la3490',
        tipo: 'voo',
        origem: 'GRU',
        destino: 'BPS',
        inicioUtc: '2026-11-27T19:50:00Z', // 16:50 BRT
        fimUtc: '2026-11-27T21:45:00Z', // 18:45 BRT
        numeroVoo: 'LA3490',
      },
      {
        id: '2026-11-28-01-la3491',
        tipo: 'voo',
        origem: 'BPS',
        destino: 'GRU',
        inicioUtc: '2026-11-28T11:00:00Z', // 08:00 BRT do dia seguinte
        fimUtc: '2026-11-28T13:00:00Z',
        numeroVoo: 'LA3491',
      },
    ];

    // 13:20 BRT em Goiânia aguardando LA3267 às 14:05 -> em-solo (NÃO pernoite)
    const emGyn = getStatus(eventosMesmoDia, new Date('2026-11-27T16:20:00Z'));
    expect(emGyn.estado).toBe('em-solo');
    expect(emGyn.aeroportoAtual?.iata).toBe('GYN');
    expect(emGyn.proximoEvento?.numeroVoo).toBe('LA3267');

    // 16:15 BRT em Guarulhos entre GYN->GRU e GRU->BPS -> em-solo no aeroporto GRU (NÃO folga em casa)
    const emGru = getStatus(eventosMesmoDia, new Date('2026-11-27T19:15:00Z'));
    expect(emGru.estado).toBe('em-solo');
    expect(emGru.aeroportoAtual?.iata).toBe('GRU');
    expect(emGru.proximoEvento?.numeroVoo).toBe('LA3490');

    // 19:30 BRT em Porto Seguro após o último voo do dia (próximo voo só amanhã) -> pernoite
    const emBps = getStatus(eventosMesmoDia, new Date('2026-11-27T22:30:00Z'));
    expect(emBps.estado).toBe('pernoite');
    expect(emBps.aeroportoAtual?.iata).toBe('BPS');
  });

  it('não classifica conexão curta na virada da meia-noite nem pernoite inferido no mesmo dia como pernoite', () => {
    const eventosVirada: EventoEscala[] = [
      {
        id: 'voo-noturno-1',
        tipo: 'voo',
        origem: 'GRU',
        destino: 'VIX',
        inicioUtc: '2026-11-02T01:00:00Z', // 01/11 22:00 BRT
        fimUtc: '2026-11-02T02:15:00Z', // 01/11 23:15 BRT
        numeroVoo: 'LA3336',
      },
      {
        id: 'voo-noturno-2',
        tipo: 'voo',
        origem: 'VIX',
        destino: 'GRU',
        inicioUtc: '2026-11-02T04:30:00Z', // 02/11 01:30 BRT (intervalo 2h15)
        fimUtc: '2026-11-02T06:00:00Z',
        numeroVoo: 'LA4537',
      },
    ];

    // 01/11 23:45 BRT em VIX com voo às 01:30 BRT -> conexão curta, NÃO pernoite
    const virada = getStatus(eventosVirada, new Date('2026-11-02T02:45:00Z'));
    expect(virada.estado).toBe('em-solo');
    expect(virada.aeroportoAtual?.iata).toBe('VIX');

    // Pernoite inferido legado no mesmo dia local deve ser ignorado em getStatus e calcularResumoMes
    const eventosComPernoiteLegado: EventoEscala[] = [
      {
        id: 'voo-manha',
        tipo: 'voo',
        origem: 'GRU',
        destino: 'GYN',
        inicioUtc: '2026-11-27T09:00:00Z', // 06:00 BRT
        fimUtc: '2026-11-27T10:30:00Z', // 07:30 BRT
        numeroVoo: 'LA3260',
      },
      {
        id: '2026-11-27-pernoite-gyn-1',
        tipo: 'pernoite',
        origem: 'GYN',
        destino: 'GYN',
        inicioUtc: '2026-11-27T11:00:00Z', // 08:00 BRT
        fimUtc: '2026-11-27T16:35:00Z', // 13:35 BRT (mesmo dia!)
        inferido: true,
      },
      {
        id: 'voo-tarde',
        tipo: 'voo',
        origem: 'GYN',
        destino: 'GRU',
        inicioUtc: '2026-11-27T17:05:00Z', // 14:05 BRT
        fimUtc: '2026-11-27T18:55:00Z',
        numeroVoo: 'LA3267',
      },
    ];

    const duranteIntervalo = getStatus(
      eventosComPernoiteLegado,
      new Date('2026-11-27T16:20:00Z') // 13:20 BRT
    );
    expect(duranteIntervalo.estado).toBe('em-solo');
    expect(duranteIntervalo.aeroportoAtual?.iata).toBe('GYN');
    expect(calcularResumoMes(eventosComPernoiteLegado).totalPernoites).toBe(0);
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

describe('Continuidade entre meses (importação antecipada do próximo mês)', () => {
  it('calcula mês de referência em BRT e janela anterior/atual/próximo incluindo virada de ano', () => {
    // 01/12 01:00 UTC ainda é 30/11 22:00 em São Paulo
    expect(getMesReferencia(new Date('2026-12-01T01:00:00Z'))).toBe('2026-11');
    expect(deslocarMes('2026-12', 1)).toBe('2027-01');
    expect(deslocarMes('2026-01', -1)).toBe('2025-12');

    // Mesmo com mesAtivo = 2026-12, em 26/11/2026 a janela inclui 2026-11 e 2026-12
    expect(
      getMesesJanela(new Date('2026-11-26T04:06:00Z'), '2026-12')
    ).toEqual(['2026-10', '2026-11', '2026-12']);
  });

  it('mantém pernoite de hoje em Manaus e próximos voos de novembro ao importar dezembro', () => {
    const eventosNov: EventoEscala[] = [
      {
        id: '2026-11-25-pernoite-mao-1',
        tipo: 'pernoite',
        origem: 'MAO',
        destino: 'MAO',
        inicioUtc: '2026-11-25T11:42:00Z',
        fimUtc: '2026-11-26T06:05:00Z',
      },
      {
        id: '2026-11-26-01-la3847',
        tipo: 'voo',
        origem: 'MAO',
        destino: 'GRU',
        inicioUtc: '2026-11-26T06:35:00Z',
        fimUtc: '2026-11-26T10:40:00Z',
        numeroVoo: 'LA3847',
        icao24: 'e48c55',
      },
      {
        id: '2026-11-30-01-asb',
        tipo: 'sobreaviso',
        codigoAtividade: 'ASB',
        origem: 'GRU',
        destino: 'GRU',
        inicioUtc: '2026-11-30T18:50:00Z',
        fimUtc: '2026-12-01T00:50:00Z',
      },
    ];

    const eventosDez: EventoEscala[] = [
      // Dia de fronteira 30/11 repetido no PDF de dezembro
      {
        id: '2026-11-30-01-asb',
        tipo: 'sobreaviso',
        codigoAtividade: 'ASB',
        origem: 'GRU',
        destino: 'GRU',
        inicioUtc: '2026-11-30T18:50:00Z',
        fimUtc: '2026-12-01T00:50:00Z',
      },
      {
        id: '2026-12-01-01-hsb',
        tipo: 'sobreaviso',
        codigoAtividade: 'HSB',
        origem: 'GRU',
        destino: 'GRU',
        inicioUtc: '2026-12-01T13:05:00Z',
        fimUtc: '2026-12-01T23:00:00Z',
      },
    ];

    const { eventos, mesPorEventoId } = mesclarEventosDeMeses({
      '2026-11': eventosNov,
      '2026-12': eventosDez,
    });

    // 30/11 não duplica: ficam 4 eventos únicos em ordem cronológica
    expect(eventos.map((e) => e.id)).toEqual([
      '2026-11-25-pernoite-mao-1',
      '2026-11-26-01-la3847',
      '2026-11-30-01-asb',
      '2026-12-01-01-hsb',
    ]);
    expect(mesPorEventoId['2026-11-26-01-la3847']).toBe('2026-11');
    expect(mesPorEventoId['2026-12-01-01-hsb']).toBe('2026-12');

    // Em 26/11 01:06 BRT (04:06Z), Felipe segue de pernoite em Manaus
    const statusHoje = getStatus(eventos, new Date('2026-11-26T04:06:00Z'));
    expect(statusHoje.estado).toBe('pernoite');
    expect(statusHoje.aeroportoAtual?.iata).toBe('MAO');
    expect(statusHoje.proximoEvento?.id).toBe('2026-11-26-01-la3847');
    expect(statusHoje.proximosEventos.map((e) => e.id)).toEqual([
      '2026-11-26-01-la3847',
      '2026-11-30-01-asb',
      '2026-12-01-01-hsb',
    ]);
  });

  it('substitui folga antiga no dia de fronteira se o próximo mês agendou atividade', () => {
    const { eventos } = mesclarEventosDeMeses({
      '2026-11': [
        {
          id: '2026-11-30-01-do',
          tipo: 'folga',
          codigoAtividade: 'DO',
          origem: 'GRU',
          destino: 'GRU',
          inicioUtc: '2026-11-30T03:00:00Z',
          fimUtc: '2026-12-01T02:59:00Z',
        },
      ],
      '2026-12': [
        {
          id: '2026-11-30-01-asb',
          tipo: 'sobreaviso',
          codigoAtividade: 'ASB',
          origem: 'GRU',
          destino: 'GRU',
          inicioUtc: '2026-11-30T18:50:00Z',
          fimUtc: '2026-12-01T00:50:00Z',
        },
      ],
    });

    expect(eventos.map((e) => e.id)).toEqual(['2026-11-30-01-asb']);
  });

  it('prioriza o mês atual no resumo mensal mesmo se mesAtivo apontar para o próximo mês', () => {
    expect(
      selecionarMesResumo(
        ['2026-11', '2026-12'],
        new Date('2026-11-26T04:06:00Z'),
        '2026-12'
      )
    ).toBe('2026-11');

    // Quando vira dezembro, seleciona dezembro automaticamente
    expect(
      selecionarMesResumo(
        ['2026-11', '2026-12'],
        new Date('2026-12-01T04:00:00Z'),
        '2026-11'
      )
    ).toBe('2026-12');
  });
});
