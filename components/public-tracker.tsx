'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { fromZonedTime } from 'date-fns-tz';
import {
  Clock,
  Moon,
  Plane,
  RefreshCw,
  Settings,
  Sparkles,
  Sun,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { StatusCard } from '@/components/status-card';
import { ProximosDias } from '@/components/proximos-dias';
import { ResumoMesCard } from '@/components/resumo-mes';
import { ConviteGate } from '@/components/convite-gate';
import { ConfettiCasa } from '@/components/confetti-casa';
import {
  getFirebaseAuth,
  getFirebaseDb,
  isFirebaseClientConfigured,
} from '@/lib/firebase';
import {
  lerConfigDemo,
  lerConviteAceito,
  lerEventosDemo,
  limparConviteAceito,
  salvarConviteAceito,
} from '@/lib/local-store';
import {
  CONFIG_PADRAO,
  calcularResumoMes,
  estaNaJanelaOpenSky,
  getStatus,
} from '@/lib/status';
import type {
  ConfiguracoesApp,
  EventoEscala,
  PosicaoAoVivo,
} from '@/lib/types';

// Carrega MapLibre exclusivamente no cliente (ssr: false)
const Mapa = dynamic(() => import('@/components/mapa/Mapa'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[340px] sm:h-[440px] md:h-[580px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-sm text-slate-500">
      Carregando mapa interativo...
    </div>
  ),
});

type CenarioDemo =
  | 'tempo-real'
  | 'voo-estimado'
  | 'ao-vivo-sim'
  | 'pernoite'
  | 'folga'
  | 'sobreaviso'
  | 'treinamento'
  | 'vazio'
  | 'data-manual';

function mascararDataHoraSim(valor: string): string {
  const digitos = valor.replace(/\D/g, '').slice(0, 12);
  let out = '';
  if (digitos.length > 0) out += digitos.slice(0, 2);
  if (digitos.length > 2) out += '/' + digitos.slice(2, 4);
  if (digitos.length > 4) out += '/' + digitos.slice(4, 8);
  if (digitos.length > 8) out += ' ' + digitos.slice(8, 10);
  if (digitos.length > 10) out += ':' + digitos.slice(10, 12);
  return out;
}

function parseDataHoraBrt(val: string): Date | null {
  const m = val
    .trim()
    .match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, dd, mm, yyyy, hh, min] = m;
  const isoLocal = `${yyyy}-${mm}-${dd}T${hh}:${min}:00`;
  const dt = fromZonedTime(isoLocal, 'America/Sao_Paulo');
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function PublicTracker() {
  const firebaseAtivo = isFirebaseClientConfigured();

  const [eventos, setEventos] = useState<EventoEscala[]>([]);
  const [config, setConfig] = useState<ConfiguracoesApp>(CONFIG_PADRAO);
  const [configCarregada, setConfigCarregada] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [agora, setAgora] = useState<Date>(() => new Date());
  const [posicaoAoVivo, setPosicaoAoVivo] = useState<PosicaoAoVivo | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [conviteAutorizado, setConviteAutorizado] = useState(false);
  const [validandoConvite, setValidandoConvite] = useState(true);
  const [isAdminLogado, setIsAdminLogado] = useState(false);
  const [authVerificado, setAuthVerificado] = useState(!firebaseAtivo);
  const [modoSimulador, setModoSimulador] = useState(false);
  const [cenarioDemo, setCenarioDemo] = useState<CenarioDemo>('tempo-real');
  const [dataSimInput, setDataSimInput] = useState('07/11/2026 14:00');

  // Verifica se já há um administrador logado no Firebase Auth (dispensa tela de convite)
  useEffect(() => {
    if (!firebaseAtivo) {
      setAuthVerificado(true);
      return;
    }
    const auth = getFirebaseAuth();
    if (!auth) {
      setAuthVerificado(true);
      return;
    }
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        try {
          const token = await u.getIdTokenResult();
          setIsAdminLogado(token.claims.admin === true);
        } catch {
          setIsAdminLogado(false);
        }
      } else {
        setIsAdminLogado(false);
      }
      setAuthVerificado(true);
    });
    return () => unsub();
  }, [firebaseAtivo]);

  // Tema escuro + detecção de ?simular=1 na URL
  useEffect(() => {
    const saved = window.localStorage.getItem('oef_theme');
    const prefersDark =
      saved === 'dark' ||
      (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
    setDarkMode(prefersDark);
    document.documentElement.classList.toggle('dark', prefersDark);

    const params = new URLSearchParams(window.location.search);
    if (params.get('simular') === '1' || params.get('simular') === 'true') {
      setModoSimulador(true);
    }
  }, []);

  const alternarTema = () => {
    setDarkMode((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle('dark', next);
      window.localStorage.setItem('oef_theme', next ? 'dark' : 'light');
      return next;
    });
  };

  // Verifica e REVALIDA convite via query string (?convite=CODIGO) ou localStorage no servidor
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get('convite')?.trim().toUpperCase();
    const saved = lerConviteAceito()?.trim().toUpperCase() || null;
    const codigoParaValidar = codeParam || saved;

    if (!codigoParaValidar) {
      setConviteAutorizado(false);
      setValidandoConvite(false);
      return;
    }

    let cancelado = false;
    const validar = async (codigo: string) => {
      try {
        const res = await fetch(
          `/api/convites?code=${encodeURIComponent(codigo)}`,
          { cache: 'no-store' }
        );
        const data = (await res.json()) as { valido?: boolean };
        if (cancelado) return;
        if (data.valido) {
          salvarConviteAceito(codigo);
          setConviteAutorizado(true);
        } else {
          limparConviteAceito();
          setConviteAutorizado(false);
        }
      } catch {
        if (!cancelado) setConviteAutorizado(false);
      } finally {
        if (!cancelado) setValidandoConvite(false);
      }
    };

    void validar(codigoParaValidar);
    return () => {
      cancelado = true;
    };
  }, []);

  // Leitura em tempo real das configurações (API + Firestore onSnapshot) ou modo demo local
  useEffect(() => {
    if (!firebaseAtivo) {
      setConfig(lerConfigDemo());
      setEventos(lerEventosDemo());
      setConfigCarregada(true);
      setCarregando(false);
      return;
    }

    let cancelado = false;

    // 1. Busca inicial via servidor (/api/configuracoes) — garante leitura mesmo se o snapshot demorar
    fetch('/api/configuracoes', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { config?: Partial<ConfiguracoesApp> } | null) => {
        if (cancelado) return;
        if (data?.config) {
          setConfig({ ...CONFIG_PADRAO, ...data.config });
        }
        setConfigCarregada(true);
      })
      .catch(() => {
        if (!cancelado) setConfigCarregada(true);
      });

    // 2. Assinatura em tempo real no Firestore
    const db = getFirebaseDb();
    if (!db) {
      setConfigCarregada(true);
      setCarregando(false);
      return;
    }

    const unsubConfig = onSnapshot(
      doc(db, 'configuracoes', 'app'),
      (snap) => {
        if (snap.exists()) {
          setConfig({
            ...CONFIG_PADRAO,
            ...(snap.data() as Partial<ConfiguracoesApp>),
          });
        }
        setConfigCarregada(true);
      },
      () => {
        setConfigCarregada(true);
        setCarregando(false);
      }
    );

    return () => {
      cancelado = true;
      unsubConfig();
    };
  }, [firebaseAtivo]);

  const acessoLiberado =
    !config.exigirConvite || conviteAutorizado || isAdminLogado;

  useEffect(() => {
    if (!firebaseAtivo || !configCarregada || !authVerificado) return;
    if (!acessoLiberado) return;
    const db = getFirebaseDb();
    if (!db) return;

    const q = query(
      collection(db, 'escalas', config.mesAtivo, 'eventos'),
      orderBy('inicioUtc', 'asc')
    );

    const unsubEventos = onSnapshot(
      q,
      (snap) => {
        const lista: EventoEscala[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<EventoEscala, 'id'>),
        }));
        setEventos(lista);
        setCarregando(false);
      },
      () => {
        setCarregando(false);
      }
    );

    return () => unsubEventos();
  }, [firebaseAtivo, configCarregada, authVerificado, acessoLiberado, config.mesAtivo]);

  // Atualiza posição estimada no arco a cada 30 segundos
  useEffect(() => {
    const id = setInterval(() => {
      setAgora(new Date());
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  // Simulador de estados e viagem no tempo (funciona em Modo Demo ou via /?simular=1 com escala real!)
  const { eventosAtivos, agoraSimulado } = useMemo(() => {
    const simuladorAtivo = !firebaseAtivo || modoSimulador;
    if (!simuladorAtivo || cenarioDemo === 'tempo-real') {
      return { eventosAtivos: eventos, agoraSimulado: agora };
    }

    if (cenarioDemo === 'vazio') {
      return { eventosAtivos: [], agoraSimulado: agora };
    }

    if (cenarioDemo === 'data-manual') {
      const parsed = parseDataHoraBrt(dataSimInput);
      return { eventosAtivos: eventos, agoraSimulado: parsed ?? agora };
    }

    const tipoAlvo: EventoEscala['tipo'] =
      cenarioDemo === 'voo-estimado' || cenarioDemo === 'ao-vivo-sim'
        ? 'voo'
        : cenarioDemo;

    // 1. Se a escala real já tem um evento desse tipo, pula direto para o meio dele!
    const eventoReal = eventos.find((e) => !e.cancelado && e.tipo === tipoAlvo);
    if (eventoReal) {
      const ini = new Date(eventoReal.inicioUtc).getTime();
      const fim = new Date(eventoReal.fimUtc).getTime();
      const meio = new Date(ini + Math.round((fim - ini) * 0.45));
      return { eventosAtivos: eventos, agoraSimulado: meio };
    }

    // 2. Se não houver na escala real, cria um evento sintético só para pré-visualizar a pose
    const inicioSim = new Date(agora.getTime() - 2 * 3_600_000).toISOString();
    const fimSim = new Date(agora.getTime() + 3 * 3_600_000).toISOString();
    const sintetico: EventoEscala =
      tipoAlvo === 'voo'
        ? {
            id: 'sim-voo',
            tipo: 'voo',
            origem: 'GRU',
            destino: 'BEL',
            inicioUtc: inicioSim,
            fimUtc: fimSim,
            numeroVoo: 'LA3576',
            callsign: 'TAM3576',
          }
        : tipoAlvo === 'pernoite'
          ? {
              id: 'sim-pernoite',
              tipo: 'pernoite',
              origem: 'BEL',
              destino: 'BEL',
              inicioUtc: inicioSim,
              fimUtc: fimSim,
            }
          : {
              id: `sim-${tipoAlvo}`,
              tipo: tipoAlvo,
              origem: config.baseIata || 'GRU',
              destino: config.baseIata || 'GRU',
              inicioUtc: inicioSim,
              fimUtc: fimSim,
            };

    return { eventosAtivos: [sintetico, ...eventos], agoraSimulado: agora };
  }, [firebaseAtivo, modoSimulador, cenarioDemo, dataSimInput, eventos, agora, config.baseIata]);

  const status = useMemo(
    () => getStatus(eventosAtivos, agoraSimulado, config),
    [eventosAtivos, agoraSimulado, config]
  );

  const resumoMes = useMemo(
    () => calcularResumoMes(eventosAtivos),
    [eventosAtivos]
  );

  // Consulta /api/posicao/[id] a cada 60 segundos apenas quando há voo dentro da janela
  const consultarPosicaoAoVivo = useCallback(async () => {
    if (
      (!firebaseAtivo || modoSimulador) &&
      cenarioDemo === 'ao-vivo-sim' &&
      status.estado === 'voo'
    ) {
      setPosicaoAoVivo({
        fonte: 'ao-vivo',
        provedor: 'adsb.lol',
        lng: status.coordenada[0],
        lat: status.coordenada[1],
        altitude: 11277, // FL370 (~37.000 ft)
        velocidadeMs: 245, // ~882 km/h
        rumo: status.rumo,
        noSolo: false,
        icao24: 'e48c55',
        callsign: status.eventoAtual?.callsign || 'TAM3576',
        aeronaveTipo: 'A320',
        matricula: 'PR-MYP',
        atualizadoEm: new Date().toISOString(),
      });
      return;
    }

    if (modoSimulador && cenarioDemo !== 'tempo-real') {
      setPosicaoAoVivo({ fonte: 'estimada', motivo: 'simulacao' });
      return;
    }

    const ev = status.eventoAtual;
    if (!ev || ev.tipo !== 'voo' || !estaNaJanelaOpenSky(ev, agoraSimulado)) {
      setPosicaoAoVivo(null);
      return;
    }

    try {
      const qs = new URLSearchParams({ mes: config.mesAtivo });
      if (!firebaseAtivo) {
        qs.set('inicioUtc', ev.inicioUtc);
        qs.set('fimUtc', ev.fimUtc);
        if (ev.origem) qs.set('origem', ev.origem);
        if (ev.destino) qs.set('destino', ev.destino);
        if (ev.numeroVoo) qs.set('numeroVoo', ev.numeroVoo);
        if (ev.icao24) qs.set('icao24', ev.icao24);
        if (ev.callsign) qs.set('callsign', ev.callsign);
      }

      const res = await fetch(
        `/api/posicao/${encodeURIComponent(ev.id)}?${qs.toString()}`
      );
      if (!res.ok) return;
      const data = (await res.json()) as PosicaoAoVivo;
      setPosicaoAoVivo(data);
    } catch {
      setPosicaoAoVivo({ fonte: 'estimada', motivo: 'erro-cliente' });
    }
  }, [
    firebaseAtivo,
    modoSimulador,
    cenarioDemo,
    status.estado,
    status.eventoAtual,
    status.coordenada,
    status.rumo,
    agoraSimulado,
    config.mesAtivo,
  ]);

  useEffect(() => {
    consultarPosicaoAoVivo();
    const timer = setInterval(consultarPosicaoAoVivo, 60_000);
    return () => clearInterval(timer);
  }, [consultarPosicaoAoVivo]);

  // Aguarda carregar configurações, verificar sessão admin e validar convite antes de mostrar qualquer dado
  if (!configCarregada || validandoConvite || !authVerificado) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">
        Verificando acesso...
      </div>
    );
  }

  // Portão de convite quando ativado nas configurações (admin logado passa direto)
  if (!acessoLiberado) {
    return (
      <ConviteGate
        nomePiloto={config.nomePiloto}
        onValidado={(codigo) => {
          salvarConviteAceito(codigo);
          setConviteAutorizado(true);
        }}
      />
    );
  }

  const estaEmCasaDeFolga =
    !carregando &&
    status.estado === 'folga' &&
    status.aeroportoAtual?.iata === 'CASA';

  return (
    <div className="min-h-screen flex flex-col">
      <ConfettiCasa ativo={estaEmCasaDeFolga} />

      {/* Cabeçalho */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <Plane className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-sm sm:text-lg leading-tight truncate">
                Onde está o {config.nomePiloto}? ✈️
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block truncate">
                Radar oficial da família · Porque no Zap ele só visualiza quando pousa
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {!firebaseAtivo && (
              <Badge variant="secondary" className="hidden md:inline-flex">
                <Sparkles className="w-3 h-3 text-sky-500" />
                Modo Demo
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 sm:h-9 sm:w-9"
              onClick={() => {
                setAgora(new Date());
                consultarPosicaoAoVivo();
              }}
              title="Atualizar posição agora"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 sm:h-9 sm:w-9"
              onClick={alternarTema}
              title={darkMode ? 'Tema claro' : 'Tema escuro'}
            >
              {darkMode ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </Button>
            <Button variant="outline" size="sm" className="h-8 px-2.5 sm:px-3" asChild>
              <Link href="/admin">
                <Settings className="w-3.5 h-3.5" />
                <span className="hidden xs:inline sm:inline">Admin</span>
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Conteúdo principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-3.5 sm:py-5 space-y-3.5 sm:space-y-5 pb-8">
        {/* Barra do Simulador (em Modo Demo ou quando acessado por /?simular=1) */}
        {(!firebaseAtivo || modoSimulador) && (
          <Alert>
            <Sparkles className="w-4 h-4 mt-0.5 shrink-0 text-sky-600" />
            <div className="flex-1 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <AlertTitle className="text-xs sm:text-sm">
                    {firebaseAtivo
                      ? 'Modo Simulador (somente visível com ?simular=1)'
                      : 'Visualizando em modo demonstração local'}
                  </AlertTitle>
                  <AlertDescription>
                    Clique em um estado para pré-visualizar a caricatura e o
                    card ou digite qualquer data/hora (BRT) da escala real.
                  </AlertDescription>
                </div>
                {modoSimulador && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs self-start sm:self-center"
                    onClick={() => {
                      setModoSimulador(false);
                      setCenarioDemo('tempo-real');
                      window.history.replaceState({}, '', '/');
                    }}
                  >
                    Sair do simulador
                  </Button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    ['tempo-real', 'Tempo real'],
                    ['folga', 'Em casa (Folga)'],
                    ['sobreaviso', 'Sobreaviso'],
                    ['voo-estimado', 'Voo (Estimado)'],
                    ['ao-vivo-sim', 'Voo (Ao vivo)'],
                    ['pernoite', 'Pernoite'],
                    ['treinamento', 'Simulador'],
                    ['vazio', 'Sem escala'],
                  ] as const
                ).map(([key, label]) => (
                  <Button
                    key={key}
                    size="sm"
                    variant={cenarioDemo === key ? 'default' : 'outline'}
                    onClick={() => setCenarioDemo(key)}
                    className="h-7 px-2.5 text-xs"
                  >
                    {label}
                  </Button>
                ))}

                <div className="flex items-center gap-1.5 ml-auto">
                  <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={dataSimInput}
                    maxLength={16}
                    placeholder="dd/mm/aaaa HH:mm"
                    onChange={(e) => {
                      setDataSimInput(mascararDataHoraSim(e.target.value));
                      setCenarioDemo('data-manual');
                    }}
                    className="h-7 w-36 text-xs font-mono px-2"
                  />
                  <Button
                    size="sm"
                    variant={cenarioDemo === 'data-manual' ? 'default' : 'outline'}
                    onClick={() => setCenarioDemo('data-manual')}
                    className="h-7 px-2.5 text-xs"
                  >
                    Ir
                  </Button>
                </div>
              </div>
            </div>
          </Alert>
        )}

        {carregando ? (
          <div className="h-96 flex items-center justify-center text-sm text-slate-500">
            Sincronizando escala...
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-5 items-start">
            {/* Mapa principal */}
            <div className="lg:col-span-8 space-y-3.5 sm:space-y-5">
              <Mapa
                status={status}
                posicaoAoVivo={posicaoAoVivo}
                nomePiloto={config.nomePiloto}
                darkMode={darkMode}
              />

              <div className="hidden lg:block">
                <ResumoMesCard
                  resumo={resumoMes}
                  mesAtivo={config.mesAtivo}
                />
              </div>
            </div>

            {/* Coluna lateral: status atual + próximos dias */}
            <div className="lg:col-span-4 space-y-3.5 sm:space-y-5">
              <StatusCard
                status={status}
                posicaoAoVivo={posicaoAoVivo}
                config={config}
              />
              <ProximosDias
                eventos={eventosAtivos}
                agora={agoraSimulado}
                baseIata={config.baseIata}
              />
              <div className="lg:hidden">
                <ResumoMesCard
                  resumo={resumoMes}
                  mesAtivo={config.mesAtivo}
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
