import type { ConfiguracoesApp, Convite, EventoEscala } from './types';

function addHours(base: Date, hours: number): string {
  return new Date(base.getTime() + hours * 3_600_000).toISOString();
}

/**
 * Gera uma escala de demonstração ancorada no momento atual para que
 * o app funcione perfeitamente mesmo antes de configurar o Firebase.
 */
export function gerarEscalaDemo(agora: Date = new Date()): EventoEscala[] {
  return [
    {
      id: 'demo-voo-anterior',
      tipo: 'voo',
      origem: 'GIG',
      destino: 'GRU',
      inicioUtc: addHours(agora, -18),
      fimUtc: addHours(agora, -16.8),
      numeroVoo: 'LA3912',
      callsign: 'TAM3912',
    },
    {
      id: 'demo-voo-atual',
      tipo: 'voo',
      origem: 'GRU',
      destino: 'LIS',
      inicioUtc: addHours(agora, -4.2),
      fimUtc: addHours(agora, 5.3),
      numeroVoo: 'LA8084',
      callsign: 'TAM8084',
      observacao: 'Trecho transatlântico — cobertura ADS-B limitada sobre o oceano',
    },
    {
      id: 'demo-pernoite-lis',
      tipo: 'pernoite',
      origem: 'LIS',
      destino: 'LIS',
      inicioUtc: addHours(agora, 5.5),
      fimUtc: addHours(agora, 29.5),
    },
    {
      id: 'demo-voo-volta-lis',
      tipo: 'voo',
      origem: 'LIS',
      destino: 'GRU',
      inicioUtc: addHours(agora, 30.5),
      fimUtc: addHours(agora, 40.5),
      numeroVoo: 'LA8085',
      callsign: 'TAM8085',
    },
    {
      id: 'demo-folga-sp',
      tipo: 'folga',
      origem: 'GRU',
      destino: 'GRU',
      inicioUtc: addHours(agora, 42),
      fimUtc: addHours(agora, 90),
    },
    {
      id: 'demo-voo-scl',
      tipo: 'voo',
      origem: 'GRU',
      destino: 'SCL',
      inicioUtc: addHours(agora, 94),
      fimUtc: addHours(agora, 98.2),
      numeroVoo: 'LA8065',
      callsign: 'LAN8065',
    },
    {
      id: 'demo-pernoite-scl',
      tipo: 'pernoite',
      origem: 'SCL',
      destino: 'SCL',
      inicioUtc: addHours(agora, 98.5),
      fimUtc: addHours(agora, 120),
    },
    {
      id: 'demo-voo-scl-gru',
      tipo: 'voo',
      origem: 'SCL',
      destino: 'GRU',
      inicioUtc: addHours(agora, 121),
      fimUtc: addHours(agora, 124.8),
      numeroVoo: 'LA8064',
      callsign: 'LAN8064',
    },
    {
      id: 'demo-treinamento',
      tipo: 'treinamento',
      origem: 'GRU',
      destino: 'GRU',
      inicioUtc: addHours(agora, 144),
      fimUtc: addHours(agora, 152),
      observacao: 'Simulador B787',
    },
    {
      id: 'demo-sobreaviso',
      tipo: 'sobreaviso',
      origem: 'GRU',
      destino: 'GRU',
      inicioUtc: addHours(agora, 168),
      fimUtc: addHours(agora, 180),
    },
  ];
}

export const CONFIG_DEMO: ConfiguracoesApp = {
  nomePiloto: 'Felipe',
  baseIata: 'GRU',
  mesAtivo: new Date().toISOString().slice(0, 7),
  modoPrivacidade: true,
  atrasoPrivacidadeMinutos: 0,
  exigirConvite: false,
  atualizadoEm: new Date().toISOString(),
};

export const CONVITES_DEMO: Convite[] = [
  {
    id: 'convite-familia',
    codigo: 'FAMILIA2026',
    rotulo: 'Grupo da Família',
    ativo: true,
    criadoEm: new Date().toISOString(),
    expiraEm: null,
  },
  {
    id: 'convite-amigos',
    codigo: 'AMIGOSVOANDO',
    rotulo: 'Amigos próximos',
    ativo: true,
    criadoEm: new Date().toISOString(),
    expiraEm: null,
  },
];

export const TEXTO_ESCALA_EXEMPLO = `Crewtopia
Tripulante: FELIPE COSTA
Sat 31 Oct
ASB GRU 23:55 GRU 03:00 (1/11)
Sun 01 Nov
Apresentação: 22:50
LA 3336 Extra GRU 23:53 VIX 01:12 (2/11)
Mon 02 Nov
LA 4537 VIX 05:03 GRU 06:37
Término da Jornada: 07:07
Tue 03 Nov
HSB GRU 06:01 GRU 07:05
ASB CGH 09:35 CGH 15:30
Thu 05 Nov
Apresentação: 12:00
LA 3102 CGH 12:45 GYN 14:34
LA 3103 GYN 15:13 CGH 17:00
Término da Jornada: 17:30
Fri 06 Nov
DR CGH 12:01 CGH 12:00 (7/11)
Tue 10 Nov
Apresentação: 12:18
LA 3366 GRU 13:09 GIG 13:55
LA 3731 GIG 16:48 BSB 18:36
LA 3576 BSB 20:40 BEL 23:04
Término da Jornada: 23:34
Wed 11 Nov
Thu 12 Nov
Apresentação: 03:50
LA 3736 BEL 04:17 GRU 07:58
Término da Jornada: 08:28
DO CGH 23:51 CGH 23:50 (13/11)`;
