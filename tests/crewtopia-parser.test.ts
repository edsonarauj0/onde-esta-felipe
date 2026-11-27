import { describe, expect, it } from 'vitest';
import {
  isFormatoCrewtopia,
  parseCrewtopiaRoster,
} from '@/lib/crewtopia-parser';
import { parseRosterWithClaude } from '@/lib/parse-roster';

const CREWTOPIA_PDF_REAL = `Crewtopia
Tripulante: FELIPE COSTA
Sat
31
Oct
\uF235 ASB
GRU 23:55
GRU 03:00
(1/11)
Sun
01
Nov
Apresentação: 22:50
\uE539
LA 3336
Extra
GRU 23:53
VIX 01:12
(2/11)
Mon
02
Nov
\uE539 LA 4537 VIX 05:03
GRU 06:37
Término da Jornada: 07:07
Tue
03
Nov
\uF235 HSB GRU 06:01
GRU 07:05
\uF235 ASB CGH 09:35
CGH 15:30
Wed
04
Nov \uF235 HSB GRU 10:05
GRU 22:00
Thu
05
Nov
Apresentação: 12:00
\uE539 LA 3102 CGH 12:45
GYN 14:34
\uE539 LA 3103 GYN 15:13
CGH 17:00
Término da Jornada: 17:30
Fri
06
Nov \uE88A DR
CGH 12:01
CGH 12:00
(7/11)
Sat
07
Nov \uE88A DR
CGH 12:01
CGH 12:00
(8/11)
Sun
08
Nov \uE88A DR
CGH 12:01
CGH 12:00
(9/11)
Mon
09
Nov \uE88A DO
CGH 12:01
CGH 12:00
(10/11)
Tue
10
Nov
Apresentação: 12:18
\uE539 LA 3366 GRU 13:09
GIG 13:55
\uE539 LA 3731 GIG 16:48
BSB 18:36
\uE539 LA 3576 BSB 20:40
BEL 23:04
Término da Jornada: 23:34
Wed
11
Nov
Thu
12
Nov
Apresentação: 03:50
\uE539 LA 3736 BEL 04:17
GRU 07:58
Término da Jornada: 08:28
\uE88A DO
CGH 23:51
CGH 23:50
(13/11)
Fri
13
Nov \uE88A DO
CGH 23:51
CGH 23:50
(14/11)
Sat
14
Nov \uE88A OFF CGH 23:51
CGH 23:59
Sun
15
Nov
\uF235 HSB CGH 00:05
CGH 05:10
Apresentação: 07:40
\uE539 LA 3318 GRU 08:45
FOR 11:52
\uE539 LA 3319 FOR 12:54
GRU 16:14
Término da Jornada: 16:44
Mon
16
Nov
\uF235 HSB CGH 07:05
CGH 09:55
Apresentação: 12:54
\uE539 LA 3366 GRU 13:49
GIG 14:52
\uE539 LA 3731 GIG 16:48
BSB 18:41
\uE539 LA 3576 BSB 20:57
BEL 23:21
Término da Jornada: 23:51
Tue
17
Nov
Wed
18
Nov
Apresentação: 02:07
\uE539 LA 3227 BEL 02:42
GRU 06:16
\uE539
LA 3472
Extra
GRU 08:33
GIG 09:30
Término da Jornada: 10:00
Thu
19
Nov
Apresentação: 06:01
\uE539 LA 4720 GIG 06:36
SSA 08:30
\uE539 LA 4721 SSA 09:25
GIG 11:30
\uE539 LA 3844 GIG 12:56
VIX 14:01
Término da Jornada: 14:31
Fri
20
Nov
Apresentação: 04:40
\uE539 LA 4537 VIX 05:01
GRU 06:45
\uE539 LA 9421 GRU 08:42
VIX 10:03
\uE539 LA 9300 VIX 10:42
GRU 12:04
Término da Jornada: 12:34
Sat
21
Nov \uE88A DO
CGH 05:51
CGH 05:50
(22/11)
Sun
22
Nov \uE88A DO
CGH 05:51
CGH 05:50
(23/11)
Mon
23
Nov
\uF235 ASB CGH 06:05
CGH 07:00
Apresentação: 07:00
\uE539 LA 3474 CGH 07:40
SJP 08:47
\uE539 LA 3475 SJP 09:26
CGH 10:41
Término da Jornada: 11:11
Tue
24
Nov
Apresentação: 06:20
\uE539
LA 4742
Extra
GRU 07:05
SLZ 10:30
Término da Jornada: 11:00
Wed
25
Nov
Apresentação: 02:20
\uE539 LA 3437 SLZ 02:50
FOR 04:05
\uE539 LA 4691 FOR 05:00
MAO 08:30
Término da Jornada: 09:00
Thu
26
Nov
Apresentação: 03:05
\uE539 LA 3847 MAO 03:35
GRU 07:40
Término da Jornada: 08:10
Fri
27
Nov \uF235 HSB CGH 07:00
CGH 15:00
Sat
28
Nov \uE88A DO
CGH 15:36
CGH 15:35
(29/11)
Sun
29
Nov \uE88A DO
CGH 15:36
CGH 15:35
(30/11)
Mon
30
Nov \uF235 ASB CGH 15:50
CGH 21:50`;

describe('Processador Crewtopia PDF (escala real completa)', () => {
  it('detecta o formato Crewtopia corretamente', () => {
    expect(isFormatoCrewtopia(CREWTOPIA_PDF_REAL)).toBe(true);
  });

  it('extrai tripulante, ano 2026, todos os 27 voos, 3 voos Extra, sobreavisos, folgas e 6 pernoites', () => {
    const res = parseCrewtopiaRoster(CREWTOPIA_PDF_REAL);
    expect(res).not.toBeNull();
    expect(res!.tripulante).toBe('FELIPE COSTA');
    expect(res!.anoInferido).toBe(2026);
    expect(res!.mesReferencia).toBe('2026-11');

    // Contagem exata da escala enviada
    expect(res!.estatisticas.voos).toBe(27);
    expect(res!.estatisticas.voosExtras).toBe(3); // LA3336, LA3472, LA4742
    expect(res!.estatisticas.sobreavisos).toBe(9); // 4 ASB + 5 HSB
    expect(res!.estatisticas.folgas).toBe(11); // 3 DR + 7 DO + 1 OFF
    expect(res!.estatisticas.pernoitesInferidos).toBe(6); // BEL, BEL, GIG, VIX, SLZ, MAO

    // Confere voo com virada de dia + Extra + conversão BRT (UTC-3) para UTC
    const la3336 = res!.eventos.find((e) => e.numeroVoo === 'LA3336');
    expect(la3336).toBeDefined();
    expect(la3336!.extra).toBe(true);
    expect(la3336!.origem).toBe('GRU');
    expect(la3336!.destino).toBe('VIX');
    expect(la3336!.callsign).toBe('TAM3336');
    // 01/11 23:53 BRT -> 02/11 02:53Z
    expect(la3336!.inicioUtc).toBe('2026-11-02T02:53:00.000Z');
    // 02/11 01:12 BRT -> 02/11 04:12Z
    expect(la3336!.fimUtc).toBe('2026-11-02T04:12:00.000Z');

    // Confere todos os 6 pernoites inferidos fora de SP (BEL, BEL, GIG, VIX, SLZ, MAO)
    const pernoites = res!.eventos.filter((e) => e.tipo === 'pernoite');
    expect(pernoites.map((p) => p.destino)).toEqual([
      'BEL',
      'BEL',
      'GIG',
      'VIX',
      'SLZ',
      'MAO',
    ]);

    // Confere primeiro pernoite em Belém cobrindo o dia vazio 11/11
    expect(pernoites[0]!.inicioUtc).toBe('2026-11-11T02:34:00.000Z'); // 10/11 23:34 BRT
    expect(pernoites[0]!.fimUtc).toBe('2026-11-12T06:50:00.000Z'); // 12/11 03:50 BRT

    // Confere voo final de Manaus para Guarulhos
    const la3847 = res!.eventos.find((e) => e.numeroVoo === 'LA3847');
    expect(la3847).toBeDefined();
    expect(la3847!.origem).toBe('MAO');
    expect(la3847!.destino).toBe('GRU');
    expect(la3847!.inicioUtc).toBe('2026-11-26T06:35:00.000Z');
    expect(la3847!.fimUtc).toBe('2026-11-26T10:40:00.000Z');
  });

  it('valida toda a saída do pipeline unificado com Zod sem precisar de API do Claude', async () => {
    const parsed = await parseRosterWithClaude(CREWTOPIA_PDF_REAL);
    expect(parsed.formato).toBe('crewtopia');
    expect(parsed.mesReferencia).toBe('2026-11');
    expect(parsed.tripulante).toBe('FELIPE COSTA');
    expect(parsed.eventos).toHaveLength(53); // 27 voos + 9 sobreavisos + 11 folgas + 6 pernoites
  });

  it('não infere pernoite quando há vários voos no mesmo dia mesmo com intervalo longo (>= 6h)', () => {
    const escalaMesmoDia = `Crewtopia
Tripulante: FELIPE COSTA
Fri 27 Nov
Apresentação: 05:30
LA 3260 GRU 06:00 GYN 07:30
LA 3267 GYN 14:05 GRU 15:55
LA 3490 GRU 16:50 BPS 18:45
Término da Jornada: 19:15
Sat 28 Nov
Apresentação: 07:30
LA 3491 BPS 08:00 GRU 10:00
Término da Jornada: 10:30`;

    const res = parseCrewtopiaRoster(escalaMesmoDia, { anoReferencia: 2026 });
    expect(res).not.toBeNull();
    // Em GYN (07:30 -> 14:05 no mesmo dia 27/11) NÃO é pernoite;
    // Em BPS (18:45 de 27/11 -> 08:00 de 28/11) É pernoite!
    const pernoites = res!.eventos.filter((e) => e.tipo === 'pernoite');
    expect(pernoites).toHaveLength(1);
    expect(pernoites[0]!.destino).toBe('BPS');
  });
});
