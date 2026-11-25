import { CONFIG_DEMO, CONVITES_DEMO, gerarEscalaDemo } from './demo-data';
import type {
  ConfiguracoesApp,
  Convite,
  EventoEscala,
  ImportacaoHistorico,
} from './types';

const KEYS = {
  eventos: 'oef_demo_eventos_v1',
  config: 'oef_demo_config_v1',
  convites: 'oef_demo_convites_v1',
  importacoes: 'oef_demo_importacoes_v1',
  conviteAceito: 'oef_convite_validado_v1',
};

export function lerEventosDemo(): EventoEscala[] {
  if (typeof window === 'undefined') return gerarEscalaDemo();
  try {
    const raw = window.localStorage.getItem(KEYS.eventos);
    if (!raw) return gerarEscalaDemo();
    const parsed = JSON.parse(raw) as EventoEscala[];
    return Array.isArray(parsed) ? parsed : gerarEscalaDemo();
  } catch {
    return gerarEscalaDemo();
  }
}

export function salvarEventosDemo(eventos: EventoEscala[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEYS.eventos, JSON.stringify(eventos));
}

export function resetarEventosDemo(): EventoEscala[] {
  const novos = gerarEscalaDemo();
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(KEYS.eventos);
  }
  return novos;
}

export function lerConfigDemo(): ConfiguracoesApp {
  if (typeof window === 'undefined') return CONFIG_DEMO;
  try {
    const raw = window.localStorage.getItem(KEYS.config);
    if (!raw) return CONFIG_DEMO;
    return { ...CONFIG_DEMO, ...(JSON.parse(raw) as Partial<ConfiguracoesApp>) };
  } catch {
    return CONFIG_DEMO;
  }
}

export function salvarConfigDemo(config: ConfiguracoesApp): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEYS.config, JSON.stringify(config));
}

export function lerConvitesDemo(): Convite[] {
  if (typeof window === 'undefined') return CONVITES_DEMO;
  try {
    const raw = window.localStorage.getItem(KEYS.convites);
    if (!raw) return CONVITES_DEMO;
    const parsed = JSON.parse(raw) as Convite[];
    return Array.isArray(parsed) ? parsed : CONVITES_DEMO;
  } catch {
    return CONVITES_DEMO;
  }
}

export function salvarConvitesDemo(convites: Convite[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEYS.convites, JSON.stringify(convites));
}

export function lerConviteAceito(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(KEYS.conviteAceito);
}

export function salvarConviteAceito(codigo: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEYS.conviteAceito, codigo);
}

export function limparConviteAceito(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(KEYS.conviteAceito);
}

export function lerImportacoesDemo(): ImportacaoHistorico[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEYS.importacoes);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ImportacaoHistorico[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function salvarImportacaoDemo(item: ImportacaoHistorico): ImportacaoHistorico[] {
  const atual = lerImportacoesDemo();
  const next = [item, ...atual].slice(0, 30);
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(KEYS.importacoes, JSON.stringify(next));
  }
  return next;
}
