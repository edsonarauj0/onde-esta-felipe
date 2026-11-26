import {
  cert,
  getApps,
  initializeApp,
  type App,
} from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import type {
  ConfiguracoesApp,
  EventoEscala,
  ImportacaoHistorico,
  ModoPublicacao,
} from './types';
import {
  calcularMudancasImportacao,
  CONFIG_PADRAO,
  getMesReferencia,
} from './status';

export function isFirebaseAdminConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY
  );
}

let adminApp: App | null = null;

export function getAdminApp(): App | null {
  if (!isFirebaseAdminConfigured()) return null;
  if (adminApp) return adminApp;

  if (getApps().length > 0) {
    adminApp = getApps()[0]!;
    return adminApp;
  }

  const privateKey = process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n');

  adminApp = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      privateKey,
    }),
    storageBucket:
      process.env.FIREBASE_STORAGE_BUCKET ||
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });

  return adminApp;
}

export function getAdminDb(): Firestore | null {
  const app = getAdminApp();
  if (!app) return null;
  const databaseId =
    process.env.FIREBASE_DATABASE_ID?.trim() ||
    process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID?.trim();
  return databaseId ? getFirestore(app, databaseId) : getFirestore(app);
}

export function isFirestoreNotFoundError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = (err as { code?: unknown }).code;
  const msg = String((err as { message?: unknown }).message ?? '');
  return code === 5 || msg.includes('5 NOT_FOUND');
}

export type AdminAuthResult =
  | { ok: true; demo: boolean; token?: DecodedIdToken }
  | { ok: false; status: number; error: string };

/**
 * Valida o token Bearer do Firebase Auth e exige a custom claim `admin: true`.
 * Em modo demonstração local (sem Firebase Admin configurado), permite testes locais.
 */
export async function verifyAdminRequest(
  request: Request
): Promise<AdminAuthResult> {
  if (!isFirebaseAdminConfigured()) {
    return { ok: true, demo: true };
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'Token de autenticação ausente.' };
  }

  const idToken = authHeader.slice('Bearer '.length).trim();
  if (!idToken) {
    return { ok: false, status: 401, error: 'Token inválido.' };
  }

  try {
    const app = getAdminApp()!;
    const decoded = await getAuth(app).verifyIdToken(idToken);
    if (decoded.admin !== true) {
      return {
        ok: false,
        status: 403,
        error: 'Acesso negado: conta sem permissão de administrador (claim admin: true).',
      };
    }
    return { ok: true, demo: false, token: decoded };
  } catch {
    return {
      ok: false,
      status: 401,
      error: 'Sessão expirada ou token inválido.',
    };
  }
}

export async function getConfiguracoesServer(): Promise<ConfiguracoesApp> {
  const db = getAdminDb();
  if (!db) return CONFIG_PADRAO;

  try {
    const snap = await db.doc('configuracoes/app').get();
    if (!snap.exists) return CONFIG_PADRAO;
    return { ...CONFIG_PADRAO, ...(snap.data() as Partial<ConfiguracoesApp>) };
  } catch {
    return CONFIG_PADRAO;
  }
}

export async function getEventoServer(
  eventoId: string,
  mes?: string | null
): Promise<{ evento: EventoEscala; mes: string } | null> {
  const db = getAdminDb();
  if (!db) return null;

  const targetMonth = mes || (await getConfiguracoesServer()).mesAtivo;
  const direct = await db
    .doc(`escalas/${targetMonth}/eventos/${eventoId}`)
    .get();

  if (direct.exists) {
    return {
      evento: { id: direct.id, ...(direct.data() as Omit<EventoEscala, 'id'>) },
      mes: targetMonth,
    };
  }

  // Fallback: busca nos meses disponíveis caso o evento pertença a outro mês
  const escalasSnap = await db.collection('escalas').listDocuments();
  for (const escalaDoc of escalasSnap) {
    if (escalaDoc.id === targetMonth) continue;
    const candidate = await escalaDoc.collection('eventos').doc(eventoId).get();
    if (candidate.exists) {
      return {
        evento: {
          id: candidate.id,
          ...(candidate.data() as Omit<EventoEscala, 'id'>),
        },
        mes: escalaDoc.id,
      };
    }
  }

  return null;
}

export async function atualizarIcao24NoFirestore(
  mes: string,
  eventoId: string,
  icao24: string,
  callsign?: string
): Promise<void> {
  const db = getAdminDb();
  if (!db) return;
  await db
    .doc(`escalas/${mes}/eventos/${eventoId}`)
    .set(
      {
        icao24: icao24.toLowerCase(),
        ...(callsign ? { callsign } : {}),
      },
      { merge: true }
    );
}

export async function publicarEscalaNoFirestore(params: {
  mes: string;
  modo: ModoPublicacao;
  ativarMes: boolean;
  eventos: EventoEscala[];
  tripulante?: string | null;
  formato?: string;
  nomeArquivo?: string;
  publicadoPor?: string | null;
}): Promise<{
  demo: boolean;
  totalPublicado: number;
  passadosPreservados: number;
  futurosSubstituidos: number;
  mesAtivado: boolean;
  mesAtivoAtual: string | null;
  importacao: ImportacaoHistorico;
}> {
  const {
    mes,
    modo,
    ativarMes,
    eventos,
    tripulante,
    formato = 'crewtopia',
    nomeArquivo = 'Escala manual',
    publicadoPor = null,
  } = params;

  const agora = new Date();
  const mesAtual = getMesReferencia(agora);
  const totalVoos = eventos.filter((e) => e.tipo === 'voo' && !e.cancelado).length;

  if (!isFirebaseAdminConfigured()) {
    const mesAtivadoDemo = ativarMes && mes <= mesAtual;
    const importacao: ImportacaoHistorico = {
      id: `imp-${Date.now()}`,
      criadoEm: agora.toISOString(),
      mes,
      nomeArquivo,
      formato,
      modo,
      tripulante: tripulante ?? null,
      totalEventos: eventos.length,
      totalVoos,
      passadosPreservados: 0,
      futurosSubstituidos: 0,
      publicadoPor,
    };
    return {
      demo: true,
      totalPublicado: eventos.length,
      passadosPreservados: 0,
      futurosSubstituidos: 0,
      mesAtivado: mesAtivadoDemo,
      mesAtivoAtual: mesAtivadoDemo ? mes : mesAtual,
      importacao,
    };
  }

  const db = getAdminDb()!;
  const colRef = db.collection(`escalas/${mes}/eventos`);

  const existentesSnap = await colRef.get();
  const existentes: EventoEscala[] = existentesSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<EventoEscala, 'id'>),
  }));

  const {
    idsParaRemover,
    eventosParaGravar,
    eventosFinais,
    passadosPreservados,
    futurosSubstituidos,
  } = calcularMudancasImportacao(existentes, eventos, modo, agora);

  const chunkSize = 400;

  // Remove apenas os eventos que devem sair (todos no modo 'substituir', ou apenas futuros antigos em 'atualizar-futuros')
  for (let i = 0; i < idsParaRemover.length; i += chunkSize) {
    const batch = db.batch();
    for (const id of idsParaRemover.slice(i, i + chunkSize)) {
      batch.delete(colRef.doc(id));
    }
    await batch.commit();
  }

  // Grava os eventos novos/atualizados
  for (let i = 0; i < eventosParaGravar.length; i += chunkSize) {
    const chunk = eventosParaGravar.slice(i, i + chunkSize);
    const batch = db.batch();
    for (const ev of chunk) {
      const docRef = colRef.doc(ev.id);
      const cleanData = Object.fromEntries(
        Object.entries(ev).filter(([, v]) => v !== undefined)
      );
      batch.set(docRef, cleanData, { merge: modo === 'complementar' });
    }
    await batch.commit();
  }

  await db.doc(`escalas/${mes}`).set(
    {
      mes,
      totalEventos: eventosFinais.length,
      ...(tripulante ? { tripulante } : {}),
      ...(formato ? { formato } : {}),
      atualizadoEm: agora.toISOString(),
    },
    { merge: true }
  );

  let mesAtivado = false;
  let mesAtivoAtual: string | null = null;
  if (ativarMes) {
    let deveAtivar = true;
    // Ao importar um mês futuro (ex.: 12/2026 ainda em 11/2026), não troca o mesAtivo
    // se o mês atual já tiver escala publicada — evita esconder os eventos de hoje.
    if (mes > mesAtual) {
      const atualSnap = await db
        .collection(`escalas/${mesAtual}/eventos`)
        .limit(1)
        .get();
      if (!atualSnap.empty) {
        deveAtivar = false;
        mesAtivoAtual = mesAtual;
        await db.doc('configuracoes/app').set(
          {
            mesAtivo: mesAtual,
            atualizadoEm: agora.toISOString(),
          },
          { merge: true }
        );
      }
    }

    if (deveAtivar) {
      await db.doc('configuracoes/app').set(
        {
          mesAtivo: mes,
          atualizadoEm: agora.toISOString(),
        },
        { merge: true }
      );
      mesAtivado = true;
      mesAtivoAtual = mes;
    }
  }

  // Registra entrada no histórico de importações
  const registroSemId: Omit<ImportacaoHistorico, 'id'> = {
    criadoEm: agora.toISOString(),
    mes,
    nomeArquivo,
    formato,
    modo,
    tripulante: tripulante ?? null,
    totalEventos: eventosFinais.length,
    totalVoos: eventosFinais.filter((e) => e.tipo === 'voo' && !e.cancelado)
      .length,
    passadosPreservados,
    futurosSubstituidos,
    publicadoPor,
  };

  const impDoc = await db.collection('importacoes').add(registroSemId);

  return {
    demo: false,
    totalPublicado: eventosParaGravar.length,
    passadosPreservados,
    futurosSubstituidos,
    mesAtivado,
    mesAtivoAtual,
    importacao: { id: impDoc.id, ...registroSemId },
  };
}

/**
 * Arquiva o PDF original no Firebase Storage pelo servidor (Admin SDK),
 * evitando bloqueio de CORS no navegador (localhost:3000 ou Vercel).
 */
export async function salvarPdfNoStorageServer(params: {
  mes: string;
  buffer: Buffer;
  nomeOriginal?: string;
}): Promise<{ salvo: boolean; caminho?: string; erro?: string }> {
  const app = getAdminApp();
  const bucketName =
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  if (!app || !bucketName) {
    return { salvo: false, erro: 'Storage bucket não configurado.' };
  }

  try {
    const bucket = getStorage(app).bucket(bucketName);
    const safeName = (params.nomeOriginal || 'escala.pdf').replace(
      /[^a-zA-Z0-9._-]/g,
      '_'
    );
    const caminho = `escalas/${params.mes}/${Date.now()}-${safeName}`;
    const fileRef = bucket.file(caminho);

    await fileRef.save(params.buffer, {
      contentType: 'application/pdf',
      resumable: false,
      metadata: {
        metadata: {
          mes: params.mes,
          origem: 'onde-esta-felipe-admin',
        },
      },
    });

    return { salvo: true, caminho };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { salvo: false, erro: msg };
  }
}
