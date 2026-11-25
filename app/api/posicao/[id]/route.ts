import { NextResponse } from 'next/server';
import {
  atualizarIcao24NoFirestore,
  getEventoServer,
  isFirebaseAdminConfigured,
} from '@/lib/firebase-admin';
import { buscarPosicaoAoVivo } from '@/lib/opensky';
import type { EventoEscala } from '@/lib/types';

export const revalidate = 60;
export const runtime = 'nodejs';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const mes = searchParams.get('mes');

  let evento: EventoEscala | null = null;
  let mesResolvido: string | null = mes;

  if (isFirebaseAdminConfigured()) {
    const found = await getEventoServer(id, mes);
    if (found) {
      evento = found.evento;
      mesResolvido = found.mes;
    }
  } else {
    // Modo local/demo: permite testar a integração OpenSky passando metadados do voo atual
    const inicioUtc = searchParams.get('inicioUtc');
    const fimUtc = searchParams.get('fimUtc');
    if (inicioUtc && fimUtc) {
      evento = {
        id,
        tipo: 'voo',
        origem: searchParams.get('origem') ?? undefined,
        destino: searchParams.get('destino') ?? undefined,
        inicioUtc,
        fimUtc,
        numeroVoo: searchParams.get('numeroVoo') ?? undefined,
        icao24: searchParams.get('icao24') ?? undefined,
        callsign: searchParams.get('callsign') ?? undefined,
      };
    }
  }

  if (!evento) {
    return NextResponse.json(
      { fonte: 'estimada', motivo: 'evento-nao-encontrado' },
      {
        status: 200,
        headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' },
      }
    );
  }

  const posicao = await buscarPosicaoAoVivo(
    evento,
    new Date(),
    async (icao24, callsign) => {
      if (mesResolvido && isFirebaseAdminConfigured()) {
        await atualizarIcao24NoFirestore(mesResolvido, evento!.id, icao24, callsign);
      }
    }
  );

  return NextResponse.json(posicao, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
    },
  });
}
