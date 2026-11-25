import airportsData from '@/data/airports.json';
import type { Aeroporto } from './types';

const airportsList = airportsData as Aeroporto[];

const byIata = new Map<string, Aeroporto>();
const byIcao = new Map<string, Aeroporto>();

for (const airport of airportsList) {
  byIata.set(airport.iata.toUpperCase(), airport);
  byIcao.set(airport.icao.toUpperCase(), airport);
}

export const AEROPORTO_PADRAO: Aeroporto = byIata.get('GRU')!;

export function getAeroporto(codigo?: string | null): Aeroporto | null {
  if (!codigo) return null;
  const clean = codigo.trim().toUpperCase();
  return byIata.get(clean) ?? byIcao.get(clean) ?? null;
}

export function listarAeroportos(): Aeroporto[] {
  return airportsList;
}

export function buscarAeroportos(termo: string, limite = 10): Aeroporto[] {
  const q = termo.trim().toLowerCase();
  if (!q) return airportsList.slice(0, limite);
  return airportsList
    .filter(
      (a) =>
        a.iata.toLowerCase().includes(q) ||
        a.icao.toLowerCase().includes(q) ||
        a.cidade.toLowerCase().includes(q) ||
        a.nome.toLowerCase().includes(q) ||
        a.pais.toLowerCase().includes(q)
    )
    .slice(0, limite);
}
