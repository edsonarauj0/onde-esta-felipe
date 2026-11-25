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

/**
 * Localização "Em casa" do Felipe (São Vicente, SP — Parque São Vicente).
 * Usada em folgas (DO/DR/OFF), intervalos na base e sobreaviso em casa (HSB).
 */
export const CASA_FELIPE: Aeroporto = {
  iata: 'CASA',
  icao: 'CASA',
  nome: 'Em casa · São Vicente',
  cidade: 'São Vicente',
  estado: 'SP',
  pais: 'Brasil',
  lat: -23.961,
  lng: -46.3946,
  tz: 'America/Sao_Paulo',
};

/**
 * Formata "Cidade/UF" (ex.: "Vitória/ES", "Guarulhos/SP", "Lisboa/PT").
 */
export function formatarCidadeEstado(aeroporto?: Aeroporto | null): string {
  if (!aeroporto) return '';
  return aeroporto.estado
    ? `${aeroporto.cidade}/${aeroporto.estado}`
    : aeroporto.cidade;
}

/**
 * Formata sigla + cidade/estado (ex.: "VIX · Vitória/ES").
 */
export function formatarSiglaLocal(codigo?: string | null): string {
  if (!codigo) return '---';
  const ap = getAeroporto(codigo);
  if (!ap) return codigo.toUpperCase();
  return `${ap.iata} (${formatarCidadeEstado(ap)})`;
}

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
