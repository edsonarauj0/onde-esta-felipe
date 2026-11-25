import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getAdminDb,
  isFirebaseAdminConfigured,
  isFirestoreNotFoundError,
  verifyAdminRequest,
} from '@/lib/firebase-admin';
import { CONVITES_DEMO } from '@/lib/demo-data';
import type { Convite } from '@/lib/types';

export const runtime = 'nodejs';

const CriarConviteSchema = z.object({
  rotulo: z.string().trim().min(2).max(80),
  codigo: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_-]{4,24}$/)
    .optional(),
  expiraEm: z.string().datetime({ offset: true }).nullable().optional(),
});

function gerarCodigoAleatorio(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code')?.trim().toUpperCase();

  // Validação pública de um código de convite específico
  if (code) {
    if (!isFirebaseAdminConfigured()) {
      const demoFound = CONVITES_DEMO.find(
        (c) => c.codigo.toUpperCase() === code && c.ativo
      );
      return NextResponse.json({
        valido: Boolean(demoFound),
        rotulo: demoFound?.rotulo ?? null,
      });
    }

    const db = getAdminDb()!;
    const snap = await db
      .collection('convites')
      .where('codigo', '==', code)
      .where('ativo', '==', true)
      .limit(1)
      .get();

    if (snap.empty) {
      return NextResponse.json({ valido: false, rotulo: null });
    }

    const convite = snap.docs[0]!.data() as Convite;
    if (convite.expiraEm && new Date(convite.expiraEm).getTime() < Date.now()) {
      return NextResponse.json({ valido: false, rotulo: null, expirado: true });
    }

    return NextResponse.json({ valido: true, rotulo: convite.rotulo });
  }

  // Listagem completa: apenas admin
  const auth = await verifyAdminRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ convites: CONVITES_DEMO, demo: true });
  }

  const db = getAdminDb()!;
  try {
    const snap = await db
      .collection('convites')
      .orderBy('criadoEm', 'desc')
      .get();
    const convites: Convite[] = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<Convite, 'id'>),
    }));

    return NextResponse.json({ convites, demo: false });
  } catch (err) {
    if (isFirestoreNotFoundError(err)) {
      return NextResponse.json(
        {
          convites: [],
          demo: false,
          avisoFirestore:
            'Banco Firestore "(default)" não encontrado. Crie o banco Firestore no Firebase Console ou defina FIREBASE_DATABASE_ID no .env.local.',
        },
        { status: 200 }
      );
    }
    throw err;
  }
}

export async function POST(request: Request) {
  const auth = await verifyAdminRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const parsed = CriarConviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dados do convite inválidos.' },
      { status: 400 }
    );
  }

  const novo: Convite = {
    id: `conv-${Date.now()}`,
    codigo: parsed.data.codigo || gerarCodigoAleatorio(),
    rotulo: parsed.data.rotulo,
    ativo: true,
    criadoEm: new Date().toISOString(),
    expiraEm: parsed.data.expiraEm ?? null,
  };

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ convite: novo, demo: true }, { status: 201 });
  }

  const db = getAdminDb()!;
  const docRef = await db.collection('convites').add({
    codigo: novo.codigo,
    rotulo: novo.rotulo,
    ativo: novo.ativo,
    criadoEm: novo.criadoEm,
    expiraEm: novo.expiraEm,
  });

  return NextResponse.json(
    { convite: { ...novo, id: docRef.id }, demo: false },
    { status: 201 }
  );
}

export async function PATCH(request: Request) {
  const auth = await verifyAdminRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json()) as { id?: string; ativo?: boolean };
  if (!body.id || typeof body.ativo !== 'boolean') {
    return NextResponse.json({ error: 'Parâmetros inválidos.' }, { status: 400 });
  }

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: true, demo: true });
  }

  const db = getAdminDb()!;
  await db.doc(`convites/${body.id}`).set({ ativo: body.ativo }, { merge: true });
  return NextResponse.json({ ok: true, demo: false });
}

export async function DELETE(request: Request) {
  const auth = await verifyAdminRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Informe o id do convite.' }, { status: 400 });
  }

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: true, demo: true });
  }

  const db = getAdminDb()!;
  await db.doc(`convites/${id}`).delete();
  return NextResponse.json({ ok: true, demo: false });
}
