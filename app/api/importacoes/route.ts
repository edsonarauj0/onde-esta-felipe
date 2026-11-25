import { NextResponse } from 'next/server';
import {
  getAdminDb,
  isFirebaseAdminConfigured,
  isFirestoreNotFoundError,
  verifyAdminRequest,
} from '@/lib/firebase-admin';
import type { ImportacaoHistorico } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await verifyAdminRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json(
      { importacoes: [], demo: true },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const db = getAdminDb()!;
  try {
    const snap = await db
      .collection('importacoes')
      .orderBy('criadoEm', 'desc')
      .limit(30)
      .get();

    const importacoes: ImportacaoHistorico[] = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<ImportacaoHistorico, 'id'>),
    }));

    return NextResponse.json(
      { importacoes, demo: false },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    if (isFirestoreNotFoundError(err)) {
      return NextResponse.json(
        { importacoes: [], demo: false },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }
    const message =
      err instanceof Error
        ? err.message
        : 'Erro ao carregar histórico de importações.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
