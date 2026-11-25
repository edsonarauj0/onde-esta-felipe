import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getAdminDb,
  getConfiguracoesServer,
  isFirebaseAdminConfigured,
  verifyAdminRequest,
} from '@/lib/firebase-admin';

export const runtime = 'nodejs';

const ConfigSchema = z.object({
  nomePiloto: z.string().trim().min(1).max(60).optional(),
  baseIata: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/)
    .optional(),
  mesAtivo: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  modoPrivacidade: z.boolean().optional(),
  atrasoPrivacidadeMinutos: z.number().int().min(0).max(240).optional(),
  exigirConvite: z.boolean().optional(),
});

export async function GET() {
  const config = await getConfiguracoesServer();
  return NextResponse.json({
    config,
    firebaseConfigurado: isFirebaseAdminConfigured(),
    openskyConfigurado: Boolean(
      (process.env.OPENSKY_CLIENT_ID && process.env.OPENSKY_CLIENT_SECRET) ||
        (process.env.OPENSKY_USERNAME && process.env.OPENSKY_PASSWORD)
    ),
    claudeConfigurado: Boolean(process.env.ANTHROPIC_API_KEY),
  });
}

export async function PUT(request: Request) {
  const auth = await verifyAdminRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const parsed = ConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Configurações inválidas.', detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const payload = {
    ...parsed.data,
    atualizadoEm: new Date().toISOString(),
  };

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: true, demo: true, config: payload });
  }

  const db = getAdminDb()!;
  await db.doc('configuracoes/app').set(payload, { merge: true });
  return NextResponse.json({ ok: true, demo: false, config: payload });
}
