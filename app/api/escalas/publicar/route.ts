import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  publicarEscalaNoFirestore,
  verifyAdminRequest,
} from '@/lib/firebase-admin';
import { EventoEscalaSchema } from '@/lib/parse-roster';

export const runtime = 'nodejs';

const PublicarSchema = z.object({
  mes: z.string().regex(/^\d{4}-\d{2}$/, 'Mês deve estar no formato YYYY-MM'),
  modo: z
    .enum(['atualizar-futuros', 'substituir', 'complementar'])
    .default('atualizar-futuros'),
  ativarMes: z.boolean().default(true),
  tripulante: z.string().nullable().optional(),
  formato: z.string().optional(),
  nomeArquivo: z.string().max(160).optional(),
  eventos: z.array(EventoEscalaSchema),
});

export async function POST(request: Request) {
  const auth = await verifyAdminRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const parsed = PublicarSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Dados da escala inválidos.',
          detalhes: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { mes, modo, ativarMes, eventos, tripulante, formato, nomeArquivo } =
      parsed.data;
    const result = await publicarEscalaNoFirestore({
      mes,
      modo,
      ativarMes,
      eventos,
      tripulante,
      formato,
      nomeArquivo,
      publicadoPor: auth.token?.email ?? null,
    });

    return NextResponse.json({
      ok: true,
      demo: result.demo,
      mes,
      modo,
      totalPublicado: result.totalPublicado,
      passadosPreservados: result.passadosPreservados,
      futurosSubstituidos: result.futurosSubstituidos,
      importacao: result.importacao,
    });
  } catch (err) {
    const code = (err as { code?: unknown })?.code;
    const rawMsg =
      err instanceof Error ? err.message : 'Erro ao publicar escala.';
    const message =
      code === 5 || rawMsg.includes('5 NOT_FOUND')
        ? 'Banco Firestore não encontrado (5 NOT_FOUND). Crie o banco "(default)" no Firebase Console em Firestore Database ou configure FIREBASE_DATABASE_ID no .env.local.'
        : rawMsg;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
