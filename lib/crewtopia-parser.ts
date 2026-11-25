import { fromZonedTime } from 'date-fns-tz';
import type { EventoEscala, TipoEvento } from './types';
import { gerarCandidatosCallsign } from './opensky';

export type OpcoesParserCrewtopia = {
  /** Ano explícito (se omitido, é inferido automaticamente pelos dias da semana no PDF). */
  anoReferencia?: number;
  /** Fuso horário dos horários exibidos no PDF (padrão Crewtopia Brasil: America/Sao_Paulo). */
  fusoHorarioPdf?: string;
  /** Aeroportos considerados "base" do tripulante para não gerar pernoite em casa. */
  aeroportosBase?: string[];
  /** Se true, gera eventos de pernoite entre jornadas que terminam e recomeçam fora da base. */
  inferirPernoites?: boolean;
};

export type ResultadoCrewtopia = {
  detectado: true;
  formato: 'crewtopia';
  tripulante: string | null;
  mesReferencia: string; // YYYY-MM
  anoInferido: number;
  fusoAplicado: string;
  eventos: EventoEscala[];
  avisos: string[];
  estatisticas: {
    voos: number;
    voosExtras: number;
    sobreavisos: number;
    folgas: number;
    treinamentos: number;
    pernoitesInferidos: number;
  };
};

const MESES_MAP: Record<string, number> = {
  jan: 1,
  feb: 2,
  fev: 2,
  mar: 3,
  apr: 4,
  abr: 4,
  may: 5,
  mai: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  ago: 8,
  sep: 9,
  set: 9,
  oct: 10,
  out: 10,
  nov: 11,
  dec: 12,
  dez: 12,
};

const WEEKDAY_MAP: Record<string, number> = {
  sun: 0,
  dom: 0,
  mon: 1,
  seg: 1,
  tue: 2,
  ter: 2,
  wed: 3,
  qua: 3,
  thu: 4,
  qui: 4,
  fri: 5,
  sex: 5,
  sat: 6,
  sab: 6,
  sáb: 6,
};

const ATIVIDADE_INFO: Record<
  string,
  { tipo: TipoEvento; descricao: string }
> = {
  ASB: { tipo: 'sobreaviso', descricao: 'Reserva no aeroporto (ASB)' },
  HSB: { tipo: 'sobreaviso', descricao: 'Sobreaviso em casa (HSB)' },
  SBY: { tipo: 'sobreaviso', descricao: 'Sobreaviso (SBY)' },
  RES: { tipo: 'sobreaviso', descricao: 'Reserva (RES)' },
  DO: { tipo: 'folga', descricao: 'Folga (DO)' },
  DR: { tipo: 'folga', descricao: 'Folga regulamentar (DR)' },
  OFF: { tipo: 'folga', descricao: 'Folga (OFF)' },
  FR: { tipo: 'folga', descricao: 'Folga regulamentar (FR)' },
  SIM: { tipo: 'treinamento', descricao: 'Simulador (SIM)' },
  TRN: { tipo: 'treinamento', descricao: 'Treinamento (TRN)' },
  CRM: { tipo: 'treinamento', descricao: 'Treinamento CRM' },
  EAD: { tipo: 'treinamento', descricao: 'Treinamento EAD' },
  GS: { tipo: 'treinamento', descricao: 'Ground School (GS)' },
  TRE: { tipo: 'treinamento', descricao: 'Treinamento (TRE)' },
};

const DAY_HEADER_REGEX =
  /(?:^|\s)(Sun|Mon|Tue|Wed|Thu|Fri|Sat|Dom|Seg|Ter|Qua|Qui|Sex|Sáb|Sab)\s+(\d{1,2})\s+(Jan|Feb|Fev|Mar|Apr|Abr|May|Mai|Jun|Jul|Aug|Ago|Sep|Set|Oct|Out|Nov|Dec|Dez)(?=\s|$)/gi;

type BlocoDiaBruto = {
  weekdayNum: number;
  day: number;
  month: number;
  body: string;
};

type DiaResolvido = BlocoDiaBruto & {
  year: number;
  apresentacaoUtc?: string;
  terminoJornadaUtc?: string;
};

/**
 * Remove caracteres de fonte de ícones (Private Use Area) e normaliza espaços.
 */
function limparTextoPdf(raw: string): string {
  return raw
    .replace(/[\uE000-\uF8FF]/g, ' ')
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\r\n/g, '\n')
    .trim();
}

/**
 * Detecta rapidamente se o texto extraído corresponde a um PDF do Crewtopia.
 */
export function isFormatoCrewtopia(texto: string): boolean {
  const limpo = limparTextoPdf(texto);
  if (/crewtopia/i.test(limpo)) return true;
  if (/Tripulante\s*:/i.test(limpo) && /Apresenta[çc][ãa]o\s*:/i.test(limpo)) {
    return true;
  }
  const matches = Array.from(limpo.matchAll(DAY_HEADER_REGEX));
  return matches.length >= 5 && /\b(ASB|HSB|DO|DR|OFF|T[ée]rmino da Jornada)\b/i.test(limpo);
}

/**
 * Converte data/hora local no fuso do PDF para ISO 8601 UTC.
 */
function paraUtcIso(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  fusoHorario: string
): string {
  const localStr = `${year}-${String(month).padStart(2, '0')}-${String(
    day
  ).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(
    minute
  ).padStart(2, '0')}:00`;
  const utcDate = fromZonedTime(localStr, fusoHorario);
  return utcDate.toISOString();
}

/**
 * Resolve o ano mais provável para o mês dominante comparando os dias da semana
 * impressos no PDF (ex.: Sat 31 Oct + Sun 01 Nov -> 2026).
 */
function inferirAno(
  blocos: BlocoDiaBruto[],
  mesDominante: number,
  anoSugerido?: number
): number {
  const anoAtual = new Date().getUTCFullYear();
  const candidatos = new Set<number>();
  if (anoSugerido) candidatos.add(anoSugerido);
  candidatos.add(anoAtual);
  candidatos.add(anoAtual + 1);
  candidatos.add(anoAtual - 1);
  for (let y = anoAtual - 4; y <= anoAtual + 4; y++) {
    candidatos.add(y);
  }

  let melhorAno = anoSugerido ?? anoAtual;
  let melhorPontuacao = -1;

  for (const ano of candidatos) {
    let acertos = 0;
    for (const b of blocos) {
      let y = ano;
      if (mesDominante === 1 && b.month === 12) y = ano - 1;
      else if (mesDominante === 12 && b.month === 1) y = ano + 1;

      const dt = new Date(Date.UTC(y, b.month - 1, b.day));
      if (
        dt.getUTCMonth() === b.month - 1 &&
        dt.getUTCDate() === b.day &&
        dt.getUTCDay() === b.weekdayNum
      ) {
        acertos++;
      }
    }

    if (acertos > melhorPontuacao) {
      melhorPontuacao = acertos;
      melhorAno = ano;
    }
  }

  return melhorAno;
}

function resolverAnoDoDia(
  month: number,
  mesDominante: number,
  anoDominante: number
): number {
  if (mesDominante === 1 && month === 12) return anoDominante - 1;
  if (mesDominante === 12 && month === 1) return anoDominante + 1;
  return anoDominante;
}

function extrairNomeTripulante(texto: string): string | null {
  const m = texto.match(
    /Tripulante\s*:\s*([A-ZÀ-Ú][A-ZÀ-Úa-zà-ú\s.'-]{2,60}?)(?=\n|(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat|Dom|Seg|Ter|Qua|Qui|Sex|Sáb|Sab)\s+\d{1,2}\s+|$)/i
  );
  return m ? m[1]!.replace(/\s+/g, ' ').trim() : null;
}

/**
 * Parser determinístico dedicado ao PDF de escala mensal do Crewtopia.
 * Extrai voos (regulares e extras), sobreavisos (ASB/HSB), folgas (DO/DR/OFF),
 * treinamentos e infere pernoites entre jornadas fora da base.
 */
export function parseCrewtopiaRoster(
  textoBruto: string,
  opcoes: OpcoesParserCrewtopia = {}
): ResultadoCrewtopia | null {
  const texto = limparTextoPdf(textoBruto);
  const fuso = opcoes.fusoHorarioPdf || 'America/Sao_Paulo';
  const aeroportosBase = new Set(
    (opcoes.aeroportosBase ?? ['GRU', 'CGH', 'VCP']).map((a) =>
      a.trim().toUpperCase()
    )
  );
  const inferirPernoites = opcoes.inferirPernoites ?? true;

  const headerMatches = Array.from(texto.matchAll(DAY_HEADER_REGEX));
  if (headerMatches.length === 0) return null;

  const blocos: BlocoDiaBruto[] = [];
  for (let i = 0; i < headerMatches.length; i++) {
    const m = headerMatches[i]!;
    const weekdayStr = m[1]!.toLowerCase();
    const day = Number(m[2]);
    const monthStr = m[3]!.toLowerCase();
    const month = MESES_MAP[monthStr];
    const weekdayNum = WEEKDAY_MAP[weekdayStr];
    if (!month || weekdayNum === undefined || day < 1 || day > 31) continue;

    const startBody = (m.index ?? 0) + m[0].length;
    const endBody =
      i + 1 < headerMatches.length
        ? (headerMatches[i + 1]!.index ?? texto.length)
        : texto.length;

    blocos.push({
      weekdayNum,
      day,
      month,
      body: texto.slice(startBody, endBody).trim(),
    });
  }

  if (blocos.length === 0) return null;

  // Mês dominante (ex.: 30 dias de Nov vs 1 dia de Oct -> Nov)
  const contagemMes = new Map<number, number>();
  for (const b of blocos) {
    contagemMes.set(b.month, (contagemMes.get(b.month) ?? 0) + 1);
  }
  let mesDominante = blocos[0]!.month;
  let maxDias = 0;
  for (const [m, count] of contagemMes.entries()) {
    if (count > maxDias) {
      maxDias = count;
      mesDominante = m;
    }
  }

  const anoDominante = inferirAno(blocos, mesDominante, opcoes.anoReferencia);
  const mesReferencia = `${anoDominante}-${String(mesDominante).padStart(
    2,
    '0'
  )}`;
  const tripulante = extrairNomeTripulante(texto);

  const eventos: EventoEscala[] = [];
  const avisos: string[] = [];
  const diasResolvidos: DiaResolvido[] = [];

  // Rastreia janelas de apresentação / término de jornada por dia para inferir pernoites com exatidão
  const jornadasTerminoPorDia = new Map<string, string>(); // YYYY-MM-DD -> ISO UTC
  const jornadasApresentacaoPorDia = new Map<string, string>(); // YYYY-MM-DD -> ISO UTC

  let voosCount = 0;
  let voosExtrasCount = 0;
  let sobreavisosCount = 0;
  let folgasCount = 0;
  let treinamentosCount = 0;

  // Expressão combinada que preserva a ordem cronológica exata dentro do dia:
  // 1) Voo: LA 3336 [Extra] GRU 23:53 VIX 01:12 [(2/11)]
  // 2) Atividade: ASB|HSB|DO|DR|OFF|... CGH 12:01 CGH 12:00 [(7/11)]
  const ITEM_REGEX =
    /(?:\b([A-Z]{2}|[A-Z]\d|\d[A-Z])\s*(\d{3,4})\s+(?:(Extra)\s+)?([A-Z]{3})\s+(\d{2}):(\d{2})\s+([A-Z]{3})\s+(\d{2}):(\d{2})(?:\s*\((\d{1,2})\/(\d{1,2})\))?)|(?:\b(ASB|HSB|SBY|RES|DR|DO|OFF|FR|SIM|TRN|CRM|EAD|GS|TRE)\b\s+([A-Z]{3})\s+(\d{2}):(\d{2})\s+([A-Z]{3})\s+(\d{2}):(\d{2})(?:\s*\((\d{1,2})\/(\d{1,2})\))?)/gi;

  for (const bloco of blocos) {
    const year = resolverAnoDoDia(bloco.month, mesDominante, anoDominante);
    const diaKey = `${year}-${String(bloco.month).padStart(2, '0')}-${String(
      bloco.day
    ).padStart(2, '0')}`;

    const diaInfo: DiaResolvido = { ...bloco, year };

    const apresMatch = bloco.body.match(/Apresenta[çc][ãa]o\s*:\s*(\d{2}):(\d{2})/i);
    if (apresMatch) {
      diaInfo.apresentacaoUtc = paraUtcIso(
        year,
        bloco.month,
        bloco.day,
        Number(apresMatch[1]),
        Number(apresMatch[2]),
        fuso
      );
      jornadasApresentacaoPorDia.set(diaKey, diaInfo.apresentacaoUtc);
    }

    const termMatch = bloco.body.match(
      /T[ée]rmino\s+da\s+Jornada\s*:\s*(\d{2}):(\d{2})/i
    );
    if (termMatch) {
      diaInfo.terminoJornadaUtc = paraUtcIso(
        year,
        bloco.month,
        bloco.day,
        Number(termMatch[1]),
        Number(termMatch[2]),
        fuso
      );
      jornadasTerminoPorDia.set(diaKey, diaInfo.terminoJornadaUtc);
    }

    diasResolvidos.push(diaInfo);

    let ordemNoDia = 0;
    for (const m of bloco.body.matchAll(ITEM_REGEX)) {
      ordemNoDia++;

      if (m[1] && m[2]) {
        // Voo
        const cia = m[1].toUpperCase();
        const num = m[2];
        const isExtra = Boolean(m[3]);
        const origem = m[4]!.toUpperCase();
        const hIni = Number(m[5]);
        const minIni = Number(m[6]);
        const destino = m[7]!.toUpperCase();
        const hFim = Number(m[8]);
        const minFim = Number(m[9]);
        const endDay = m[10] ? Number(m[10]) : bloco.day;
        const endMonth = m[11] ? Number(m[11]) : bloco.month;
        const endYear = resolverAnoDoDia(endMonth, mesDominante, anoDominante);

        const inicioUtc = paraUtcIso(
          year,
          bloco.month,
          bloco.day,
          hIni,
          minIni,
          fuso
        );
        let fimUtc = paraUtcIso(
          endYear,
          endMonth,
          endDay,
          hFim,
          minFim,
          fuso
        );

        if (new Date(fimUtc).getTime() <= new Date(inicioUtc).getTime()) {
          fimUtc = new Date(
            new Date(fimUtc).getTime() + 24 * 60 * 60 * 1000
          ).toISOString();
        }

        const numeroVoo = `${cia}${num}`;
        const candidatosCallsign = gerarCandidatosCallsign(numeroVoo);

        voosCount++;
        if (isExtra) voosExtrasCount++;

        eventos.push({
          id: `${diaKey}-${String(ordemNoDia).padStart(
            2,
            '0'
          )}-${numeroVoo.toLowerCase()}`,
          tipo: 'voo',
          origem,
          destino,
          inicioUtc,
          fimUtc,
          numeroVoo,
          callsign: candidatosCallsign[0],
          extra: isExtra || undefined,
          observacao: isExtra ? 'Tripulante extra (deslocamento)' : undefined,
        });
      } else if (m[12]) {
        // Atividade em solo (ASB, HSB, DO, DR, OFF, SIM, etc.)
        const codigo = m[12].toUpperCase();
        const info = ATIVIDADE_INFO[codigo] ?? {
          tipo: 'sobreaviso' as TipoEvento,
          descricao: codigo,
        };
        const origem = m[13]!.toUpperCase();
        const hIni = Number(m[14]);
        const minIni = Number(m[15]);
        const destino = m[16]!.toUpperCase();
        const hFim = Number(m[17]);
        const minFim = Number(m[18]);
        const endDay = m[19] ? Number(m[19]) : bloco.day;
        const endMonth = m[20] ? Number(m[20]) : bloco.month;
        const endYear = resolverAnoDoDia(endMonth, mesDominante, anoDominante);

        const inicioUtc = paraUtcIso(
          year,
          bloco.month,
          bloco.day,
          hIni,
          minIni,
          fuso
        );
        let fimUtc = paraUtcIso(
          endYear,
          endMonth,
          endDay,
          hFim,
          minFim,
          fuso
        );

        if (new Date(fimUtc).getTime() <= new Date(inicioUtc).getTime()) {
          fimUtc = new Date(
            new Date(fimUtc).getTime() + 24 * 60 * 60 * 1000
          ).toISOString();
        }

        if (info.tipo === 'sobreaviso') sobreavisosCount++;
        else if (info.tipo === 'folga') folgasCount++;
        else if (info.tipo === 'treinamento') treinamentosCount++;

        eventos.push({
          id: `${diaKey}-${String(ordemNoDia).padStart(
            2,
            '0'
          )}-${codigo.toLowerCase()}`,
          tipo: info.tipo,
          origem,
          destino,
          inicioUtc,
          fimUtc,
          codigoAtividade: codigo,
          observacao: info.descricao,
        });
      }
    }
  }

  // Ordena eventos cronologicamente
  eventos.sort(
    (a, b) => new Date(a.inicioUtc).getTime() - new Date(b.inicioUtc).getTime()
  );

  // Inferência automática de pernoites entre voos fora da base (ex.: BEL, GIG, VIX, SLZ, MAO)
  let pernoitesInferidos = 0;
  if (inferirPernoites) {
    const apenasVoos = eventos.filter((e) => e.tipo === 'voo');
    const pernoites: EventoEscala[] = [];

    for (let i = 0; i < apenasVoos.length - 1; i++) {
      const vooAtual = apenasVoos[i]!;
      const proxVoo = apenasVoos[i + 1]!;
      const cidadeChegada = vooAtual.destino;
      const cidadePartida = proxVoo.origem;

      if (!cidadeChegada || !cidadePartida) continue;
      if (cidadeChegada !== cidadePartida) continue;
      if (aeroportosBase.has(cidadeChegada)) continue;

      const chegadaMs = new Date(vooAtual.fimUtc).getTime();
      const proxPartidaMs = new Date(proxVoo.inicioUtc).getTime();
      const gapHoras = (proxPartidaMs - chegadaMs) / 3_600_000;

      // Pernoite real fora da base: intervalo >= 6 horas entre pouso e próxima decolagem
      if (gapHoras < 6) continue;

      // Usa Término da Jornada / Apresentação se disponíveis próximos aos horários dos voos
      const diaChegadaKey = vooAtual.id.slice(0, 10);
      const diaProxKey = proxVoo.id.slice(0, 10);

      const termJornada = jornadasTerminoPorDia.get(diaChegadaKey);
      const apresJornada = jornadasApresentacaoPorDia.get(diaProxKey);

      let inicioPernoite =
        termJornada &&
        new Date(termJornada).getTime() >= chegadaMs &&
        new Date(termJornada).getTime() - chegadaMs <= 2 * 3_600_000
          ? termJornada
          : new Date(chegadaMs + 30 * 60_000).toISOString();

      let fimPernoite =
        apresJornada &&
        new Date(apresJornada).getTime() <= proxPartidaMs &&
        proxPartidaMs - new Date(apresJornada).getTime() <= 2 * 3_600_000
          ? apresJornada
          : new Date(proxPartidaMs - 30 * 60_000).toISOString();

      if (new Date(fimPernoite).getTime() <= new Date(inicioPernoite).getTime()) {
        inicioPernoite = vooAtual.fimUtc;
        fimPernoite = proxVoo.inicioUtc;
      }

      pernoitesInferidos++;
      pernoites.push({
        id: `${diaChegadaKey}-pernoite-${cidadeChegada.toLowerCase()}-${pernoitesInferidos}`,
        tipo: 'pernoite',
        origem: cidadeChegada,
        destino: cidadeChegada,
        inicioUtc: inicioPernoite,
        fimUtc: fimPernoite,
        inferido: true,
        observacao: `Pernoite em ${cidadeChegada} (inferido automaticamente entre jornadas)`,
      });
    }

    eventos.push(...pernoites);
    eventos.sort(
      (a, b) =>
        new Date(a.inicioUtc).getTime() - new Date(b.inicioUtc).getTime()
    );
  }

  if (eventos.length === 0) return null;

  avisos.push(
    `Formato Crewtopia detectado automaticamente (${voosCount} voos, ${pernoitesInferidos} pernoites inferidos, ${sobreavisosCount} sobreavisos/reservas e ${folgasCount} folgas).`
  );
  avisos.push(
    `Ano inferido pelo calendário do PDF: ${anoDominante} (${mesReferencia}). Horários convertidos de ${fuso} para UTC.`
  );

  return {
    detectado: true,
    formato: 'crewtopia',
    tripulante,
    mesReferencia,
    anoInferido: anoDominante,
    fusoAplicado: fuso,
    eventos,
    avisos,
    estatisticas: {
      voos: voosCount,
      voosExtras: voosExtrasCount,
      sobreavisos: sobreavisosCount,
      folgas: folgasCount,
      treinamentos: treinamentosCount,
      pernoitesInferidos,
    },
  };
}
