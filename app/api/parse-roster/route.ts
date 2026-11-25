import { NextResponse } from 'next/server';
import { extractText } from 'unpdf';
import {
  publicarEscalaNoFirestore,
  salvarPdfNoStorageServer,
  verifyAdminRequest,
} from '@/lib/firebase-admin';
import { parseRosterWithClaude } from '@/lib/parse-roster';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  const auth = await verifyAdminRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const contentType = request.headers.get('content-type') || '';
    let textoExtraido = '';
    let pdfBuffer: Buffer | null = null;
    let pdfFileName: string | undefined;
    let mesHint: string | undefined;
    let anoReferencia: number | undefined;
    let fusoHorarioPdf = 'America/Sao_Paulo';
    let inferirPernoites = true;
    let salvarNoFirebase = false;
    let modoPublicacao: 'substituir' | 'complementar' = 'substituir';
    let ativarMes = true;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file');
      const mesField = formData.get('mes');
      const anoField = formData.get('ano');
      const fusoField = formData.get('fusoHorario');
      const pernoitesField = formData.get('inferirPernoites');
      const salvarField = formData.get('salvarNoFirebase');
      const modoField = formData.get('modo');
      const ativarField = formData.get('ativarMes');

      if (typeof mesField === 'string' && /^\d{4}-\d{2}$/.test(mesField)) {
        mesHint = mesField;
      }
      if (typeof anoField === 'string' && /^\d{4}$/.test(anoField.trim())) {
        anoReferencia = Number(anoField.trim());
      }
      if (typeof fusoField === 'string' && fusoField.trim()) {
        fusoHorarioPdf = fusoField.trim();
      }
      if (typeof pernoitesField === 'string') {
        inferirPernoites = pernoitesField !== 'false';
      }
      if (typeof salvarField === 'string') {
        salvarNoFirebase = salvarField === 'true';
      }
      if (modoField === 'complementar' || modoField === 'substituir') {
        modoPublicacao = modoField;
      }
      if (typeof ativarField === 'string') {
        ativarMes = ativarField !== 'false';
      }

      if (!file || !(file instanceof File)) {
        return NextResponse.json(
          { error: 'Envie um arquivo PDF no campo "file".' },
          { status: 400 }
        );
      }

      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json(
          { error: 'O arquivo PDF excede o limite de 10 MB.' },
          { status: 400 }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);
      pdfBuffer = Buffer.from(arrayBuffer);
      pdfFileName = file.name;
      const { text } = await extractText(uint8, { mergePages: true });
      textoExtraido = Array.isArray(text) ? text.join('\n') : String(text ?? '');
    } else {
      const body = (await request.json()) as {
        texto?: string;
        mes?: string;
        ano?: number;
        fusoHorario?: string;
        inferirPernoites?: boolean;
        salvarNoFirebase?: boolean;
        modo?: 'substituir' | 'complementar';
        ativarMes?: boolean;
      };
      textoExtraido = body.texto ?? '';
      if (body.mes && /^\d{4}-\d{2}$/.test(body.mes)) mesHint = body.mes;
      if (typeof body.ano === 'number' && body.ano >= 2020 && body.ano <= 2040) {
        anoReferencia = body.ano;
      }
      if (body.fusoHorario) fusoHorarioPdf = body.fusoHorario;
      if (typeof body.inferirPernoites === 'boolean') {
        inferirPernoites = body.inferirPernoites;
      }
      if (typeof body.salvarNoFirebase === 'boolean') {
        salvarNoFirebase = body.salvarNoFirebase;
      }
      if (body.modo === 'complementar' || body.modo === 'substituir') {
        modoPublicacao = body.modo;
      }
      if (typeof body.ativarMes === 'boolean') ativarMes = body.ativarMes;
    }

    if (!textoExtraido.trim()) {
      return NextResponse.json(
        {
          error:
            'Não foi possível extrair texto do PDF. Verifique se o PDF contém texto selecionável (não apenas imagem escaneada).',
        },
        { status: 422 }
      );
    }

    const resultado = await parseRosterWithClaude(textoExtraido, mesHint, {
      anoReferencia,
      fusoHorarioPdf,
      inferirPernoites,
    });

    // Arquiva o PDF original no Firebase Storage pelo servidor (sem erro de CORS no localhost)
    let storageInfo: { salvo: boolean; caminho?: string; erro?: string } | null =
      null;
    if (pdfBuffer && !auth.demo) {
      storageInfo = await salvarPdfNoStorageServer({
        mes: resultado.mesReferencia,
        buffer: pdfBuffer,
        nomeOriginal: pdfFileName,
      });
    }

    let publicacao: { demo: boolean; totalPublicado: number } | null = null;
    if (salvarNoFirebase && resultado.eventos.length > 0) {
      publicacao = await publicarEscalaNoFirestore({
        mes: resultado.mesReferencia,
        modo: modoPublicacao,
        ativarMes,
        eventos: resultado.eventos,
        tripulante: resultado.tripulante,
        formato: resultado.formato,
      });
    }

    return NextResponse.json({
      ...resultado,
      usouClaude: resultado.formato === 'claude',
      demoAuth: auth.demo,
      salvoNoFirebase: Boolean(publicacao),
      demoPersist: publicacao?.demo ?? auth.demo,
      pdfArquivadoStorage: storageInfo,
      caracteresExtraidos: textoExtraido.length,
    });
  } catch (err) {
    const code = (err as { code?: unknown })?.code;
    const rawMsg =
      err instanceof Error ? err.message : 'Erro ao processar a escala.';
    const message =
      code === 5 || rawMsg.includes('5 NOT_FOUND')
        ? 'Banco Firestore não encontrado (5 NOT_FOUND). Crie o banco "(default)" no Firebase Console em Firestore Database ou configure FIREBASE_DATABASE_ID no .env.local.'
        : rawMsg;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
