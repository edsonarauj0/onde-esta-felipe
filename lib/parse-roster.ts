import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import {
  isFormatoCrewtopia,
  parseCrewtopiaRoster,
  type OpcoesParserCrewtopia,
} from './crewtopia-parser';
import type { EventoEscala } from './types';

export const TipoEventoSchema = z.enum([
  'voo',
  'pernoite',
  'folga',
  'sobreaviso',
  'treinamento',
]);

export const EventoEscalaSchema = z.object({
  id: z.string().min(1),
  tipo: TipoEventoSchema,
  origem: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, 'Código IATA deve ter 3 letras')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  destino: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, 'Código IATA deve ter 3 letras')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  inicioUtc: z.string().datetime({ offset: true }),
  fimUtc: z.string().datetime({ offset: true }),
  numeroVoo: z.string().trim().max(16).optional(),
  icao24: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[0-9a-f]{6}$/, 'icao24 deve ter 6 caracteres hex')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  callsign: z.string().trim().toUpperCase().max(12).optional(),
  codigoAtividade: z.string().trim().toUpperCase().max(12).optional(),
  extra: z.boolean().optional(),
  inferido: z.boolean().optional(),
  cancelado: z.boolean().optional(),
  atrasoMinutos: z.number().int().min(-180).max(1440).optional(),
  observacao: z.string().max(240).optional(),
});

export const EscalaParseadaSchema = z.object({
  mesReferencia: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'Formato esperado YYYY-MM'),
  tripulante: z.string().nullable().optional(),
  formato: z.enum(['crewtopia', 'claude', 'fallback']).optional(),
  eventos: z.array(EventoEscalaSchema),
  avisos: z.array(z.string()).default([]),
  estatisticas: z
    .object({
      voos: z.number(),
      voosExtras: z.number(),
      sobreavisos: z.number(),
      folgas: z.number(),
      treinamentos: z.number(),
      pernoitesInferidos: z.number(),
    })
    .optional(),
});

export type EscalaParseada = z.infer<typeof EscalaParseadaSchema>;

const SYSTEM_PROMPT = `Você é um especialista em escalas de tripulantes de companhias aéreas (Crewtopia, LATAM, Azul, GOL, CrewLink, Sabre, Jeppesen).
Sua tarefa é converter o texto extraído de um PDF de escala mensal de piloto em um JSON estrito.

Regras obrigatórias:
1. Retorne SOMENTE um objeto JSON válido, sem markdown, sem explicações.
2. Formato exato:
{
  "mesReferencia": "YYYY-MM",
  "tripulante": "NOME DO TRIPULANTE",
  "eventos": [
    {
      "id": "ev-01-la8084",
      "tipo": "voo" | "pernoite" | "folga" | "sobreaviso" | "treinamento",
      "origem": "GRU",
      "destino": "LIS",
      "inicioUtc": "2026-11-02T22:30:00Z",
      "fimUtc": "2026-11-03T08:00:00Z",
      "numeroVoo": "LA8084",
      "observacao": "opcional"
    }
  ],
  "avisos": ["eventuais ambiguidades encontradas"]
}
3. Converta TODOS os horários para ISO 8601 UTC com sufixo "Z".
4. Códigos de aeroporto devem ser IATA de 3 letras maiúsculas (ex.: GRU, CGH, GIG, VIX, BEL).
5. Mapeamento de atividades comuns:
   - Voos comerciais / etapas (LA, G3, AD, JJ, etc.) -> tipo: "voo"
   - Layover / pernoite fora da base -> tipo: "pernoite" (NUNCA inclua nome de hotel!)
   - Folga / OFF / DO / DR / FR -> tipo: "folga"
   - Sobreaviso / SBY / ASB / HSB / RES -> tipo: "sobreaviso"
   - Simulador / SIM / Ground School / CRM / Treinamento -> tipo: "treinamento"
6. Nunca inclua nomes ou endereços de hotéis no campo observacao.`;

/**
 * Parser determinístico genérico usado quando o formato não é Crewtopia e ANTHROPIC_API_KEY não está configurada.
 */
export function parseRosterFallback(
  texto: string,
  mesPadrao = new Date().toISOString().slice(0, 7)
): EscalaParseada {
  const mesMatch = texto.match(/(20\d{2})[-/](\d{2})/);
  const mesReferencia = mesMatch ? `${mesMatch[1]}-${mesMatch[2]}` : mesPadrao;
  const [anoStr, mesStr] = mesReferencia.split('-');
  const ano = Number(anoStr);
  const mes = Number(mesStr);

  const eventos: EventoEscala[] = [];
  const linhas = texto.split(/\r?\n/);
  let idx = 0;

  for (const raw of linhas) {
    const linha = raw.trim();
    if (!linha) continue;

    const vooMatch = linha.match(
      /(\d{2})\/(\d{2})\s+([A-Z0-9]{2}\d{2,4})\s+([A-Z]{3})\s+(\d{2}):(\d{2})Z?\s*(?:->|-|–)\s*([A-Z]{3})\s+(\d{2}):(\d{2})Z?(?:\s*\(\+(\d)\))?/i
    );
    if (vooMatch) {
      idx++;
      const [, dd, mm, numVoo, orig, h1, m1, dest, h2, m2, plusDays] = vooMatch;
      const inicio = new Date(
        Date.UTC(ano, Number(mm) - 1, Number(dd), Number(h1), Number(m1))
      );
      let fim = new Date(
        Date.UTC(
          ano,
          Number(mm) - 1,
          Number(dd) + (plusDays ? Number(plusDays) : 0),
          Number(h2),
          Number(m2)
        )
      );
      if (fim.getTime() <= inicio.getTime()) {
        fim = new Date(fim.getTime() + 86_400_000);
      }

      eventos.push({
        id: `${mesReferencia}-${String(idx).padStart(2, '0')}-${numVoo.toLowerCase()}`,
        tipo: 'voo',
        origem: orig.toUpperCase(),
        destino: dest.toUpperCase(),
        inicioUtc: inicio.toISOString(),
        fimUtc: fim.toISOString(),
        numeroVoo: numVoo.toUpperCase(),
      });
      continue;
    }

    const outroMatch = linha.match(
      /(\d{2})\/(\d{2})\s+(LAYOVER|PERNOITE|OFF|FOLGA|SIM|TREINAMENTO|SBY|SOBREAVISO)\s+([A-Z]{3})\s+(\d{2}):(\d{2})Z?\s*(?:->|-|–)\s*(?:(\d{2})\/(\d{2})\s+)?(\d{2}):(\d{2})Z?/i
    );
    if (outroMatch) {
      idx++;
      const [, dd1, mm1, kw, iata, h1, m1, dd2, mm2, h2, m2] = outroMatch;
      const upperKw = kw.toUpperCase();
      const tipo: EventoEscala['tipo'] =
        upperKw === 'LAYOVER' || upperKw === 'PERNOITE'
          ? 'pernoite'
          : upperKw === 'OFF' || upperKw === 'FOLGA'
            ? 'folga'
            : upperKw === 'SIM' || upperKw === 'TREINAMENTO'
              ? 'treinamento'
              : 'sobreaviso';

      const inicio = new Date(
        Date.UTC(ano, Number(mm1) - 1, Number(dd1), Number(h1), Number(m1))
      );
      let fim = new Date(
        Date.UTC(
          ano,
          Number(mm2 ?? mm1) - 1,
          Number(dd2 ?? dd1),
          Number(h2),
          Number(m2)
        )
      );
      if (fim.getTime() <= inicio.getTime()) {
        fim = new Date(fim.getTime() + 86_400_000);
      }

      eventos.push({
        id: `${mesReferencia}-${String(idx).padStart(2, '0')}-${tipo}`,
        tipo,
        origem: iata.toUpperCase(),
        destino: iata.toUpperCase(),
        inicioUtc: inicio.toISOString(),
        fimUtc: fim.toISOString(),
      });
    }
  }

  return EscalaParseadaSchema.parse({
    mesReferencia,
    formato: 'fallback',
    eventos,
    avisos: [
      `Parser local genérico utilizado (${mes}/${ano}). Revise os horários antes de publicar.`,
    ],
  });
}

/**
 * Pipeline principal de processamento da escala:
 * 1. Tenta primeiro o parser dedicado Crewtopia (determinístico, instantâneo e 100% gratuito).
 * 2. Se o PDF for de outro formato, usa a API do Claude (@anthropic-ai/sdk) ou fallback local.
 * 3. Valida todo o resultado com Zod antes de retornar/salvar no Firebase.
 */
export async function parseRosterWithClaude(
  textoExtraido: string,
  mesHint?: string,
  opcoesCrewtopia: OpcoesParserCrewtopia = {}
): Promise<EscalaParseada> {
  // 1. Parser dedicado Crewtopia
  if (isFormatoCrewtopia(textoExtraido)) {
    const anoHint =
      opcoesCrewtopia.anoReferencia ??
      (mesHint && /^\d{4}-\d{2}$/.test(mesHint)
        ? Number(mesHint.slice(0, 4))
        : undefined);

    const crewtopia = parseCrewtopiaRoster(textoExtraido, {
      ...opcoesCrewtopia,
      anoReferencia: anoHint,
    });

    if (crewtopia && crewtopia.eventos.length > 0) {
      return EscalaParseadaSchema.parse({
        mesReferencia: crewtopia.mesReferencia,
        tripulante: crewtopia.tripulante,
        formato: 'crewtopia',
        eventos: crewtopia.eventos,
        avisos: crewtopia.avisos,
        estatisticas: crewtopia.estatisticas,
      });
    }
  }

  // 2. Fallback para outros formatos via Claude
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return parseRosterFallback(textoExtraido, mesHint);
  }

  const client = new Anthropic({ apiKey });
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';

  const userPrompt = [
    mesHint ? `Mês de referência sugerido: ${mesHint}` : '',
    'Texto extraído do PDF da escala:',
    '---',
    textoExtraido.slice(0, 60_000),
    '---',
  ]
    .filter(Boolean)
    .join('\n');

  const message = await client.messages.create({
    model,
    max_tokens: 8192,
    temperature: 0,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const textBlock = message.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude não retornou texto na resposta.');
  }

  const rawText = textBlock.text.trim();
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(cleaned);
  } catch {
    throw new Error(
      'A resposta do modelo não é um JSON válido. Tente novamente ou verifique o PDF.'
    );
  }

  return EscalaParseadaSchema.parse({
    ...(parsedJson as Record<string, unknown>),
    formato: 'claude',
  });
}
