'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useFieldArray, useForm } from 'react-hook-form';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  FileText,
  History,
  KeyRound,
  LogOut,
  Plus,
  Send,
  Shield,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  getFirebaseAuth,
  googleProvider,
  isFirebaseClientConfigured,
} from '@/lib/firebase';
import { TEXTO_ESCALA_EXEMPLO } from '@/lib/demo-data';
import {
  lerConfigDemo,
  lerConvitesDemo,
  lerEventosDemo,
  lerEventosMesDemo,
  lerImportacoesDemo,
  salvarConfigDemo,
  salvarConvitesDemo,
  salvarEventosMesDemo,
  salvarImportacaoDemo,
} from '@/lib/local-store';
import { formatarCidadeEstado, getAeroporto } from '@/lib/airports';
import {
  calcularMudancasImportacao,
  CONFIG_PADRAO,
  formatarDataHoraUtc,
  formatarHoraLocal,
  formatarMesAno,
  getMesReferencia,
} from '@/lib/status';
import type {
  ConfiguracoesApp,
  Convite,
  EventoEscala,
  ImportacaoHistorico,
  ModoPublicacao,
  TipoEvento,
} from '@/lib/types';

type RevisaoFormValues = {
  mes: string;
  modo: ModoPublicacao;
  ativarMes: boolean;
  eventos: EventoEscala[];
};

const MODO_LABEL: Record<ModoPublicacao, string> = {
  'atualizar-futuros': 'Preservar passados',
  substituir: 'Substituir mês',
  complementar: 'Complementar',
};

const TIPOS_EVENTO: TipoEvento[] = [
  'voo',
  'pernoite',
  'folga',
  'sobreaviso',
  'treinamento',
];

/**
 * Aplica máscara "dd/mm/aaaa HH:mm" enquanto o usuário digita.
 */
function mascararDataHoraBr(valor: string): string {
  const digitos = valor.replace(/\D/g, '').slice(0, 12);
  let out = '';
  if (digitos.length > 0) out += digitos.slice(0, 2);
  if (digitos.length > 2) out += '/' + digitos.slice(2, 4);
  if (digitos.length > 4) out += '/' + digitos.slice(4, 8);
  if (digitos.length > 8) out += ' ' + digitos.slice(8, 10);
  if (digitos.length > 10) out += ':' + digitos.slice(10, 12);
  return out;
}

/**
 * Converte "dd/mm/aaaa HH:mm" (UTC) para ISO 8601 UTC. Retorna null se inválido.
 */
function dataHoraBrParaIsoUtc(val: string): string | null {
  const m = val
    .trim()
    .match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?$/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  const hh = m[4] ? Number(m[4]) : 0;
  const min = m[5] ? Number(m[5]) : 0;
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || hh > 23 || min > 59) {
    return null;
  }
  const dt = new Date(Date.UTC(yyyy, mm - 1, dd, hh, min, 0));
  if (
    dt.getUTCFullYear() !== yyyy ||
    dt.getUTCMonth() !== mm - 1 ||
    dt.getUTCDate() !== dd
  ) {
    return null;
  }
  return dt.toISOString();
}

export function AdminDashboard() {
  const firebaseAtivo = isFirebaseClientConfigured();

  // Estado de autenticação
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(!firebaseAtivo);
  const [authLoading, setAuthLoading] = useState(firebaseAtivo);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');

  // Abas e estados de trabalho
  const [abaAtiva, setAbaAtiva] = useState('upload');
  const [textoManual, setTextoManual] = useState('');
  const [parseando, setParseando] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [avisosParser, setAvisosParser] = useState<string[]>([]);
  const [fusoPdf, setFusoPdf] = useState<'America/Sao_Paulo' | 'UTC'>(
    'America/Sao_Paulo'
  );
  const [anoOverride, setAnoOverride] = useState('');
  const [inferirPernoites, setInferirPernoites] = useState(true);
  const [salvarAutomatico, setSalvarAutomatico] = useState(false);
  const [tripulanteDetectado, setTripulanteDetectado] = useState<string | null>(
    null
  );
  const [formatoDetectado, setFormatoDetectado] = useState<string | null>(null);
  const [estatisticasParser, setEstatisticasParser] = useState<{
    voos: number;
    voosExtras: number;
    sobreavisos: number;
    folgas: number;
    treinamentos: number;
    pernoitesInferidos: number;
  } | null>(null);

  // Modal de edição rápida de evento
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<EventoEscala | null>(null);
  const [editInicioBr, setEditInicioBr] = useState('');
  const [editFimBr, setEditFimBr] = useState('');

  // Convites, histórico de importações e configurações
  const [convites, setConvites] = useState<Convite[]>([]);
  const [importacoes, setImportacoes] = useState<ImportacaoHistorico[]>([]);
  const [arquivoOrigem, setArquivoOrigem] = useState<string>('Escala manual');
  const [novoRotulo, setNovoRotulo] = useState('');
  const [novoCodigo, setNovoCodigo] = useState('');
  const [config, setConfig] = useState<ConfiguracoesApp>(CONFIG_PADRAO);
  const [statusServicos, setStatusServicos] = useState({
    firebaseConfigurado: false,
    openskyConfigurado: false,
    claudeConfigurado: false,
  });

  // React Hook Form para a tela de revisão da escala
  const form = useForm<RevisaoFormValues>({
    defaultValues: {
      mes: getMesReferencia(),
      modo: 'atualizar-futuros',
      ativarMes: true,
      eventos: [],
    },
  });

  const { fields, append, remove, replace, update } = useFieldArray({
    control: form.control,
    name: 'eventos',
  });

  // Monitora Firebase Auth + Custom Claim `admin: true`
  useEffect(() => {
    if (!firebaseAtivo) {
      setIsAdmin(true);
      setAuthLoading(false);
      replace(lerEventosDemo());
      setConfig(lerConfigDemo());
      setConvites(lerConvitesDemo());
      setImportacoes(lerImportacoesDemo());
      return;
    }

    const auth = getFirebaseAuth();
    if (!auth) {
      setAuthLoading(false);
      return;
    }

    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const tokenResult = await u.getIdTokenResult(true);
        setIsAdmin(tokenResult.claims.admin === true);
      } else {
        setIsAdmin(false);
      }
      setAuthLoading(false);
    });

    return () => unsub();
  }, [firebaseAtivo, replace]);

  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    if (!firebaseAtivo || !user) return {};
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}` };
  };

  // Carrega status das integrações, configurações, convites e histórico de importações
  useEffect(() => {
    if (!isAdmin) return;
    const carregar = async () => {
      try {
        const resCfg = await fetch('/api/configuracoes', { cache: 'no-store' });
        if (resCfg.ok) {
          const data = (await resCfg.json()) as {
            config: ConfiguracoesApp;
            firebaseConfigurado: boolean;
            openskyConfigurado: boolean;
            claudeConfigurado: boolean;
          };
          setStatusServicos({
            firebaseConfigurado: data.firebaseConfigurado,
            openskyConfigurado: data.openskyConfigurado,
            claudeConfigurado: data.claudeConfigurado,
          });
          if (firebaseAtivo) {
            setConfig(data.config);
            form.setValue('mes', data.config.mesAtivo);
          }
        }

        if (firebaseAtivo) {
          const headers = await getAuthHeaders();
          const [resConv, resImp] = await Promise.all([
            fetch('/api/convites', { headers, cache: 'no-store' }),
            fetch('/api/importacoes', { headers, cache: 'no-store' }),
          ]);
          if (resConv.ok) {
            const dataConv = (await resConv.json()) as { convites: Convite[] };
            setConvites(dataConv.convites);
          }
          if (resImp.ok) {
            const dataImp = (await resImp.json()) as {
              importacoes: ImportacaoHistorico[];
            };
            setImportacoes(dataImp.importacoes ?? []);
          }
        }
      } catch {
        // Ignora erro inicial
      }
    };
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, firebaseAtivo]);

  // Handlers de Login
  const handleLoginGoogle = async () => {
    const auth = getFirebaseAuth();
    if (!auth) return;
    try {
      await signInWithPopup(auth, googleProvider);
      toast.success('Login efetuado! Verificando permissão admin...');
    } catch {
      toast.error('Não foi possível entrar com o Google.');
    }
  };

  const handleLoginEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const auth = getFirebaseAuth();
    if (!auth) return;
    try {
      await signInWithEmailAndPassword(auth, email, senha);
      toast.success('Login efetuado!');
    } catch {
      toast.error('E-mail ou senha inválidos.');
    }
  };

  const handleLogout = async () => {
    const auth = getFirebaseAuth();
    if (auth) await signOut(auth);
  };

  // Upload e parse de PDF (Crewtopia determinístico ou Claude fallback)
  const handlePdfUpload = async (file: File) => {
    setParseando(true);
    setAvisosParser([]);
    setEstatisticasParser(null);
    setArquivoOrigem(file.name);
    try {
      const headers = await getAuthHeaders();
      const mesAtual = form.getValues('mes');

      const fd = new FormData();
      fd.append('file', file);
      fd.append('mes', mesAtual);
      fd.append('fusoHorario', fusoPdf);
      fd.append('inferirPernoites', String(inferirPernoites));
      fd.append('salvarNoFirebase', String(salvarAutomatico));
      fd.append('modo', form.getValues('modo'));
      fd.append('ativarMes', String(form.getValues('ativarMes')));
      if (anoOverride.trim()) fd.append('ano', anoOverride.trim());

      const res = await fetch('/api/parse-roster', {
        method: 'POST',
        headers,
        body: fd,
      });

      const data = (await res.json()) as {
        error?: string;
        mesReferencia?: string;
        tripulante?: string | null;
        formato?: string;
        eventos?: EventoEscala[];
        avisos?: string[];
        estatisticas?: {
          voos: number;
          voosExtras: number;
          sobreavisos: number;
          folgas: number;
          treinamentos: number;
          pernoitesInferidos: number;
        };
        salvoNoFirebase?: boolean;
        demoPersist?: boolean;
        importacao?: ImportacaoHistorico | null;
        passadosPreservados?: number;
        futurosSubstituidos?: number;
        mesAtivado?: boolean;
        mesAtivoAtual?: string | null;
      };

      if (!res.ok) {
        toast.error(data.error || 'Falha ao processar PDF.');
        return;
      }

      const eventosExtraidos = data.eventos ?? [];
      const mesHoje = getMesReferencia();
      if (data.mesReferencia) {
        form.setValue('mes', data.mesReferencia);
        form.setValue('ativarMes', data.mesReferencia <= mesHoje);
      }
      setTripulanteDetectado(data.tripulante ?? null);
      setFormatoDetectado(data.formato ?? null);
      setEstatisticasParser(data.estatisticas ?? null);
      replace(eventosExtraidos);
      setAvisosParser(data.avisos ?? []);
      setAbaAtiva('revisao');

      if (data.salvoNoFirebase) {
        if (data.demoPersist) {
          const modoAtual = form.getValues('modo');
          const mesDestino = data.mesReferencia ?? form.getValues('mes');
          const { eventosFinais, passadosPreservados, futurosSubstituidos } =
            calcularMudancasImportacao(
              lerEventosMesDemo(mesDestino),
              eventosExtraidos,
              modoAtual
            );
          salvarEventosMesDemo(mesDestino, eventosFinais);
          if (data.importacao) {
            const regDemo: ImportacaoHistorico = {
              ...data.importacao,
              passadosPreservados,
              futurosSubstituidos,
              totalEventos: eventosFinais.length,
            };
            setImportacoes(salvarImportacaoDemo(regDemo));
          }
          const deveAtivarDemo =
            mesDestino <= mesHoje || lerEventosMesDemo(mesHoje).length === 0;
          if (data.mesReferencia && deveAtivarDemo) {
            const nextCfg = { ...config, mesAtivo: data.mesReferencia };
            setConfig(nextCfg);
            salvarConfigDemo(nextCfg);
          }
        } else if (data.importacao) {
          setImportacoes((prev) => [data.importacao!, ...prev].slice(0, 30));
        }

        const resumoPassado =
          data.passadosPreservados && data.passadosPreservados > 0
            ? ` · ${data.passadosPreservados} passados preservados`
            : '';
        const avisoMesAtual =
          data.mesAtivado === false &&
          data.mesAtivoAtual &&
          data.mesReferencia &&
          data.mesAtivoAtual !== data.mesReferencia
            ? ` A escala de ${formatarMesAno(data.mesAtivoAtual)} continua ativa hoje.`
            : '';
        toast.success(
          `PDF processado e salvo (${eventosExtraidos.length} eventos em ${formatarMesAno(data.mesReferencia)}${resumoPassado})!${avisoMesAtual}`
        );
      } else {
        toast.success(
          `${eventosExtraidos.length} eventos extraídos (${
            data.formato === 'crewtopia'
              ? 'Processador Crewtopia'
              : data.formato === 'claude'
                ? 'Claude AI'
                : 'Parser local'
          }). Revise e clique em Publicar!`
        );
      }
    } catch {
      toast.error('Erro inesperado ao enviar o PDF.');
    } finally {
      setParseando(false);
    }
  };

  // Parse de texto colado
  const handleParseTexto = async () => {
    if (!textoManual.trim()) {
      toast.error('Cole o texto da escala ou carregue o exemplo.');
      return;
    }
    setParseando(true);
    setAvisosParser([]);
    setEstatisticasParser(null);
    setArquivoOrigem('Texto colado');
    try {
      const headers = {
        'Content-Type': 'application/json',
        ...(await getAuthHeaders()),
      };
      const res = await fetch('/api/parse-roster', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          texto: textoManual,
          mes: form.getValues('mes'),
          ano: anoOverride.trim() ? Number(anoOverride.trim()) : undefined,
          fusoHorario: fusoPdf,
          inferirPernoites,
          salvarNoFirebase: salvarAutomatico,
          modo: form.getValues('modo'),
          ativarMes: form.getValues('ativarMes'),
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        mesReferencia?: string;
        tripulante?: string | null;
        formato?: string;
        eventos?: EventoEscala[];
        avisos?: string[];
        estatisticas?: {
          voos: number;
          voosExtras: number;
          sobreavisos: number;
          folgas: number;
          treinamentos: number;
          pernoitesInferidos: number;
        };
        salvoNoFirebase?: boolean;
        demoPersist?: boolean;
        importacao?: ImportacaoHistorico | null;
        mesAtivado?: boolean;
        mesAtivoAtual?: string | null;
      };

      if (!res.ok) {
        toast.error(data.error || 'Erro ao interpretar texto.');
        return;
      }

      const eventosExtraidos = data.eventos ?? [];
      const mesHoje = getMesReferencia();
      if (data.mesReferencia) {
        form.setValue('mes', data.mesReferencia);
        form.setValue('ativarMes', data.mesReferencia <= mesHoje);
      }
      setTripulanteDetectado(data.tripulante ?? null);
      setFormatoDetectado(data.formato ?? null);
      setEstatisticasParser(data.estatisticas ?? null);
      replace(eventosExtraidos);
      setAvisosParser(data.avisos ?? []);
      setAbaAtiva('revisao');

      if (data.salvoNoFirebase) {
        if (data.demoPersist) {
          const modoAtual = form.getValues('modo');
          const mesDestino = data.mesReferencia ?? form.getValues('mes');
          const { eventosFinais, passadosPreservados, futurosSubstituidos } =
            calcularMudancasImportacao(
              lerEventosMesDemo(mesDestino),
              eventosExtraidos,
              modoAtual
            );
          salvarEventosMesDemo(mesDestino, eventosFinais);
          if (data.importacao) {
            setImportacoes(
              salvarImportacaoDemo({
                ...data.importacao,
                passadosPreservados,
                futurosSubstituidos,
                totalEventos: eventosFinais.length,
              })
            );
          }
          const deveAtivarDemo =
            mesDestino <= mesHoje || lerEventosMesDemo(mesHoje).length === 0;
          if (data.mesReferencia && deveAtivarDemo) {
            const nextCfg = { ...config, mesAtivo: data.mesReferencia };
            setConfig(nextCfg);
            salvarConfigDemo(nextCfg);
          }
        } else if (data.importacao) {
          setImportacoes((prev) => [data.importacao!, ...prev].slice(0, 30));
        }
        const avisoMesAtual =
          data.mesAtivado === false &&
          data.mesAtivoAtual &&
          data.mesReferencia &&
          data.mesAtivoAtual !== data.mesReferencia
            ? ` A escala de ${formatarMesAno(data.mesAtivoAtual)} continua ativa hoje.`
            : '';
        toast.success(
          `Escala processada e salva (${eventosExtraidos.length} eventos)!${avisoMesAtual}`
        );
      } else {
        toast.success(
          `${eventosExtraidos.length} eventos prontos para revisão.`
        );
      }
    } catch {
      toast.error('Erro de conexão ao processar texto.');
    } finally {
      setParseando(false);
    }
  };

  // Publicar escala revisada
  const handlePublicar = form.handleSubmit(async (values) => {
    setPublicando(true);
    try {
      const headers = {
        'Content-Type': 'application/json',
        ...(await getAuthHeaders()),
      };

      const res = await fetch('/api/escalas/publicar', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...values,
          tripulante: tripulanteDetectado,
          formato: formatoDetectado ?? 'manual',
          nomeArquivo: arquivoOrigem,
        }),
      });

      const data = (await res.json()) as {
        ok?: boolean;
        demo?: boolean;
        error?: string;
        totalPublicado?: number;
        passadosPreservados?: number;
        futurosSubstituidos?: number;
        mesAtivado?: boolean;
        mesAtivoAtual?: string | null;
        importacao?: ImportacaoHistorico;
      };

      if (!res.ok) {
        toast.error(data.error || 'Erro ao publicar escala.');
        return;
      }

      if (data.demo) {
        const mesHoje = getMesReferencia();
        const { eventosFinais, passadosPreservados, futurosSubstituidos } =
          calcularMudancasImportacao(
            lerEventosMesDemo(values.mes),
            values.eventos,
            values.modo
          );
        salvarEventosMesDemo(values.mes, eventosFinais);
        if (data.importacao) {
          setImportacoes(
            salvarImportacaoDemo({
              ...data.importacao,
              passadosPreservados,
              futurosSubstituidos,
              totalEventos: eventosFinais.length,
            })
          );
        }
        const deveAtivarDemo =
          values.ativarMes &&
          (values.mes <= mesHoje || lerEventosMesDemo(mesHoje).length === 0);
        if (deveAtivarDemo) {
          const nextCfg = { ...config, mesAtivo: values.mes };
          setConfig(nextCfg);
          salvarConfigDemo(nextCfg);
        }
      } else if (data.importacao) {
        setImportacoes((prev) => [data.importacao!, ...prev].slice(0, 30));
      }

      const detalhe =
        data.passadosPreservados && data.passadosPreservados > 0
          ? ` (${data.passadosPreservados} passados preservados)`
          : '';
      const avisoMesAtual =
        data.mesAtivado === false &&
        data.mesAtivoAtual &&
        data.mesAtivoAtual !== values.mes
          ? ` A escala de ${formatarMesAno(data.mesAtivoAtual)} continua ativa hoje e ${formatarMesAno(values.mes)} já aparece na sequência.`
          : ' A família já pode ver.';
      toast.success(
        `Escala ${formatarMesAno(values.mes)} publicada${detalhe}!${avisoMesAtual}`
      );
    } catch {
      toast.error('Falha ao publicar a escala.');
    } finally {
      setPublicando(false);
    }
  });

  // Salvar edição do modal
  const salvarEdicaoModal = () => {
    if (editIndex === null || !editDraft) return;
    const inicioIso = dataHoraBrParaIsoUtc(editInicioBr);
    const fimIso = dataHoraBrParaIsoUtc(editFimBr);
    if (!inicioIso || !fimIso) {
      toast.error('Use o formato dd/mm/aaaa HH:mm nos campos de início e fim.');
      return;
    }
    update(editIndex, {
      ...editDraft,
      inicioUtc: inicioIso,
      fimUtc: fimIso,
    });
    setEditIndex(null);
    setEditDraft(null);
    toast.success('Evento atualizado na revisão.');
  };

  // Criar novo convite
  const handleCriarConvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoRotulo.trim()) return;
    try {
      const headers = {
        'Content-Type': 'application/json',
        ...(await getAuthHeaders()),
      };
      const res = await fetch('/api/convites', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          rotulo: novoRotulo.trim(),
          codigo: novoCodigo.trim() || undefined,
        }),
      });
      const data = (await res.json()) as {
        convite?: Convite;
        demo?: boolean;
        error?: string;
      };
      if (!res.ok || !data.convite) {
        toast.error(data.error || 'Erro ao criar convite.');
        return;
      }
      const next = [data.convite, ...convites];
      setConvites(next);
      if (data.demo) salvarConvitesDemo(next);
      setNovoRotulo('');
      setNovoCodigo('');
      toast.success(`Convite "${data.convite.codigo}" criado!`);
    } catch {
      toast.error('Erro ao criar convite.');
    }
  };

  const handleToggleConvite = async (conv: Convite) => {
    const nextAtivo = !conv.ativo;
    const headers = {
      'Content-Type': 'application/json',
      ...(await getAuthHeaders()),
    };
    const res = await fetch('/api/convites', {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ id: conv.id, ativo: nextAtivo }),
    });
    if (res.ok) {
      const next = convites.map((c) =>
        c.id === conv.id ? { ...c, ativo: nextAtivo } : c
      );
      setConvites(next);
      if (!firebaseAtivo) salvarConvitesDemo(next);
    }
  };

  const handleExcluirConvite = async (id: string) => {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/convites?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers,
    });
    if (res.ok) {
      const next = convites.filter((c) => c.id !== id);
      setConvites(next);
      if (!firebaseAtivo) salvarConvitesDemo(next);
      toast.success('Convite removido.');
    }
  };

  const copiarLinkConvite = (codigo: string) => {
    const url = `${window.location.origin}/?convite=${codigo}`;
    navigator.clipboard.writeText(url);
    toast.success('Link do convite copiado!');
  };

  // Salvar configurações
  const handleSalvarConfig = async () => {
    try {
      const headers = {
        'Content-Type': 'application/json',
        ...(await getAuthHeaders()),
      };
      const res = await fetch('/api/configuracoes', {
        method: 'PUT',
        headers,
        body: JSON.stringify(config),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        demo?: boolean;
        error?: string;
      };
      if (!res.ok) {
        toast.error(data.error || 'Erro ao salvar configurações.');
        return;
      }
      if (data.demo) salvarConfigDemo(config);
      toast.success('Configurações de privacidade e acesso salvas!');
    } catch {
      toast.error('Erro ao salvar configurações.');
    }
  };

  // Tela de carregamento
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">
        Verificando autenticação...
      </div>
    );
  }

  // Tela de Login Admin (quando Firebase está configurado e usuário não é admin)
  if (firebaseAtivo && (!user || !isAdmin)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-sky-600" />
              Área do Administrador
            </CardTitle>
            <CardDescription>
              Apenas contas com a claim <code>admin: true</code> podem enviar e
              publicar a escala do Felipe.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {user && !isAdmin && (
              <Alert variant="destructive">
                <div>
                  <AlertTitle>Conta sem permissão admin</AlertTitle>
                  <AlertDescription>
                    Logado como {user.email}, mas a claim{' '}
                    <code>admin: true</code> não está ativa. Execute{' '}
                    <code>node scripts/set-admin-claim.mjs {user.email}</code>.
                  </AlertDescription>
                </div>
              </Alert>
            )}

            <Button onClick={handleLoginGoogle} className="w-full">
              Entrar com Google
            </Button>

            <form onSubmit={handleLoginEmail} className="space-y-2.5 pt-2 border-t">
              <Input
                type="email"
                placeholder="E-mail do admin"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                type="password"
                placeholder="Senha"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
              />
              <Button type="submit" variant="outline" className="w-full">
                Entrar com e-mail e senha
              </Button>
            </form>

            <div className="flex justify-between pt-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/">
                  <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao mapa
                </Link>
              </Button>
              {user && (
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  <LogOut className="w-3.5 h-3.5" /> Sair
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Button variant="ghost" size="sm" className="px-2 sm:px-3 shrink-0" asChild>
              <Link href="/">
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden xs:inline sm:inline">Mapa</span>
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs shrink-0" asChild>
              <Link href="/?simular=1">
                <Sparkles className="w-3.5 h-3.5 text-sky-500" />
                <span className="hidden sm:inline">Simular estados</span>
                <span className="sm:hidden">Simular</span>
              </Link>
            </Button>
            <div className="min-w-0">
              <h1 className="font-bold text-sm sm:text-base truncate">
                Painel Admin · Escala
              </h1>
              <p className="text-[11px] text-slate-500 hidden sm:block truncate">
                Upload do PDF, revisão, publicação e convites
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {!firebaseAtivo && (
              <Badge variant="secondary" className="hidden sm:inline-flex">
                <Sparkles className="w-3 h-3 text-sky-500" /> Admin Demo
              </Badge>
            )}
            {user && (
              <Button variant="outline" size="sm" className="h-8 px-2.5" onClick={handleLogout}>
                <LogOut className="w-3.5 h-3.5" /> Sair
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-5">
        {/* Status das integrações de servidor */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant={statusServicos.firebaseConfigurado ? 'live' : 'secondary'}>
            Firebase Admin: {statusServicos.firebaseConfigurado ? 'Conectado' : 'Modo local'}
          </Badge>
          <Badge variant={statusServicos.claudeConfigurado ? 'live' : 'secondary'}>
            Claude PDF Parser: {statusServicos.claudeConfigurado ? 'Ativo' : 'Fallback local'}
          </Badge>
          <Badge variant="live">
            ADS-B ao vivo: adsb.lol + airplanes.live (Ativo · sem chave)
          </Badge>
        </div>

        <Tabs value={abaAtiva} onValueChange={setAbaAtiva}>
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto sm:h-10 gap-1 max-w-2xl">
            <TabsTrigger value="upload" className="text-xs sm:text-sm py-2 sm:py-1.5">
              <Upload className="w-3.5 h-3.5" /> PDF
            </TabsTrigger>
            <TabsTrigger value="revisao" className="text-xs sm:text-sm py-2 sm:py-1.5">
              <FileText className="w-3.5 h-3.5" /> Revisão ({fields.length})
            </TabsTrigger>
            <TabsTrigger value="convites" className="text-xs sm:text-sm py-2 sm:py-1.5">
              <KeyRound className="w-3.5 h-3.5" /> Convites
            </TabsTrigger>
            <TabsTrigger value="config" className="text-xs sm:text-sm py-2 sm:py-1.5">
              <Shield className="w-3.5 h-3.5" /> Privacidade
            </TabsTrigger>
          </TabsList>

          {/* ABA 1: UPLOAD DO PDF */}
          <TabsContent value="upload" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle>Processador de PDF Crewtopia</CardTitle>
                    <CardDescription>
                      Extrai automaticamente voos (regulares e <code>Extra</code>
                      ), reservas/sobreavisos (<code>ASB</code>/<code>HSB</code>
                      ), folgas (<code>DO</code>/<code>DR</code>/
                      <code>OFF</code>), datas que viram o dia e pernoites fora
                      da base — sem depender de IA paga.
                    </CardDescription>
                  </div>
                  <Badge variant="live">Crewtopia Nativo</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Opções do processador */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border">
                  <div>
                    <label className="text-xs font-medium text-slate-500">
                      Fuso horário no PDF
                    </label>
                    <select
                      value={fusoPdf}
                      onChange={(e) =>
                        setFusoPdf(
                          e.target.value as 'America/Sao_Paulo' | 'UTC'
                        )
                      }
                      className="mt-1 flex h-9 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs"
                    >
                      <option value="America/Sao_Paulo">
                        Horário de Brasília (BRT · padrão Crewtopia)
                      </option>
                      <option value="UTC">UTC (Zulu)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-500">
                      Ao reimportar no mesmo mês
                    </label>
                    <select
                      value={form.watch('modo')}
                      onChange={(e) =>
                        form.setValue('modo', e.target.value as ModoPublicacao)
                      }
                      className="mt-1 flex h-9 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs"
                    >
                      <option value="atualizar-futuros">
                        Preservar passados e atualizar futuros (Recomendado)
                      </option>
                      <option value="substituir">
                        Substituir mês inteiro (apaga tudo)
                      </option>
                      <option value="complementar">
                        Complementar (mesclar por ID)
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-500">
                      Ano (opcional · vazio = automático)
                    </label>
                    <Input
                      type="number"
                      placeholder="Auto pelo calendário"
                      value={anoOverride}
                      onChange={(e) => setAnoOverride(e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div className="flex flex-col justify-center gap-2">
                    <label className="flex items-center justify-between text-xs cursor-pointer">
                      <span>Inferir pernoites fora da base</span>
                      <Switch
                        checked={inferirPernoites}
                        onCheckedChange={setInferirPernoites}
                      />
                    </label>
                    <label className="flex items-center justify-between text-xs cursor-pointer">
                      <span className="font-medium text-sky-700 dark:text-sky-300">
                        Salvar direto no Firebase
                      </span>
                      <Switch
                        checked={salvarAutomatico}
                        onCheckedChange={setSalvarAutomatico}
                      />
                    </label>
                  </div>
                </div>

                <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-8 text-center cursor-pointer hover:border-sky-500 hover:bg-sky-50/40 dark:hover:bg-sky-950/20 transition-colors">
                  <Upload className="w-8 h-8 text-sky-500 mb-2" />
                  <span className="font-medium text-sm">
                    {parseando
                      ? 'Extraindo voos e salvando dados...'
                      : salvarAutomatico
                        ? 'Clique para enviar o PDF e salvar direto no Firebase'
                        : 'Clique para enviar o PDF da escala Crewtopia'}
                  </span>
                  <span className="text-xs text-slate-500 mt-1">
                    PDF até 10 MB · processado no servidor e salvo no Firestore
                  </span>
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    disabled={parseando}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (file) handlePdfUpload(file);
                    }}
                  />
                </label>

                <div className="space-y-2 pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      Ou cole o texto do PDF Crewtopia para testar agora
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setTextoManual(TEXTO_ESCALA_EXEMPLO)}
                    >
                      Carregar exemplo Crewtopia
                    </Button>
                  </div>
                  <textarea
                    rows={7}
                    value={textoManual}
                    onChange={(e) => setTextoManual(e.target.value)}
                    placeholder="Cole aqui o texto extraído da escala Crewtopia..."
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <Button
                    type="button"
                    onClick={handleParseTexto}
                    disabled={parseando}
                  >
                    {parseando
                      ? 'Processando...'
                      : salvarAutomatico
                        ? 'Processar e salvar no Firebase'
                        : 'Processar e ir para revisão'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* HISTÓRICO DE IMPORTAÇÕES */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <History className="w-4 h-4 text-sky-500" />
                      Histórico de importações
                    </CardTitle>
                    <CardDescription>
                      Registro de todas as escalas publicadas no Firebase, com
                      quantidade de eventos passados preservados e futuros
                      atualizados.
                    </CardDescription>
                  </div>
                  <Badge variant="secondary">{importacoes.length}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data / Hora</TableHead>
                      <TableHead>Mês</TableHead>
                      <TableHead>Arquivo</TableHead>
                      <TableHead>Modo</TableHead>
                      <TableHead>Resultado</TableHead>
                      <TableHead className="hidden sm:table-cell">
                        Publicado por
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importacoes.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center text-slate-500 py-8 text-xs sm:text-sm"
                        >
                          Nenhuma importação registrada ainda. Assim que você
                          publicar uma escala, ela aparecerá aqui.
                        </TableCell>
                      </TableRow>
                    ) : (
                      importacoes.map((imp) => (
                        <TableRow key={imp.id}>
                          <TableCell className="font-mono text-xs whitespace-nowrap">
                            {formatarHoraLocal(
                              imp.criadoEm,
                              'America/Sao_Paulo',
                              'dd/MM/yyyy HH:mm'
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono text-xs">
                              {formatarMesAno(imp.mes)}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[180px]">
                            <div className="font-medium text-xs truncate">
                              {imp.nomeArquivo}
                            </div>
                            <div className="text-[11px] text-slate-500 uppercase">
                              {imp.formato}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-[11px] whitespace-nowrap">
                              {MODO_LABEL[imp.modo] ?? imp.modo}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="font-medium">
                              {imp.totalVoos} voos · {imp.totalEventos} eventos
                            </div>
                            {(imp.passadosPreservados > 0 ||
                              imp.futurosSubstituidos > 0) && (
                              <div className="text-[11px] text-slate-500">
                                {imp.passadosPreservados} passados mantidos ·{' '}
                                {imp.futurosSubstituidos} antigos trocados
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-xs text-slate-500">
                            {imp.publicadoPor || 'Admin local'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA 2: REVISÃO E PUBLICAÇÃO */}
          <TabsContent value="revisao" className="space-y-4">
            {estatisticasParser && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                <div className="rounded-xl border bg-white dark:bg-slate-900 p-3">
                  <div className="text-[11px] text-slate-500">Voos</div>
                  <div className="text-lg font-bold">
                    {estatisticasParser.voos}
                    {estatisticasParser.voosExtras > 0 && (
                      <span className="text-xs font-normal text-slate-500 ml-1">
                        ({estatisticasParser.voosExtras} extra)
                      </span>
                    )}
                  </div>
                </div>
                <div className="rounded-xl border bg-white dark:bg-slate-900 p-3">
                  <div className="text-[11px] text-slate-500">Pernoites</div>
                  <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                    {estatisticasParser.pernoitesInferidos}
                  </div>
                </div>
                <div className="rounded-xl border bg-white dark:bg-slate-900 p-3">
                  <div className="text-[11px] text-slate-500">ASB / HSB</div>
                  <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
                    {estatisticasParser.sobreavisos}
                  </div>
                </div>
                <div className="rounded-xl border bg-white dark:bg-slate-900 p-3">
                  <div className="text-[11px] text-slate-500">DO / DR / OFF</div>
                  <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    {estatisticasParser.folgas}
                  </div>
                </div>
                <div className="rounded-xl border bg-white dark:bg-slate-900 p-3 col-span-2 sm:col-span-1">
                  <div className="text-[11px] text-slate-500">Tripulante</div>
                  <div className="text-xs font-bold truncate mt-1">
                    {tripulanteDetectado || config.nomePiloto}
                  </div>
                </div>
              </div>
            )}

            {avisosParser.length > 0 && (
              <Alert variant="warning">
                <div>
                  <AlertTitle>Detalhes do processamento</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc pl-4 space-y-0.5 mt-1">
                      {avisosParser.map((aviso, i) => (
                        <li key={i}>{aviso}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </div>
              </Alert>
            )}

            <Card>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle>Revisão de eventos antes de publicar</CardTitle>
                  <CardDescription>
                    Corrija horários, informe atrasos, marque cancelamentos ou
                    adicione o código <code>icao24</code> da aeronave.
                  </CardDescription>
                </div>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const agoraIso = new Date().toISOString();
                    const mais2h = new Date(
                      Date.now() + 2 * 3_600_000
                    ).toISOString();
                    append({
                      id: `manual-${Date.now()}`,
                      tipo: 'voo',
                      origem: config.baseIata || 'GRU',
                      destino: 'LIS',
                      inicioUtc: agoraIso,
                      fimUtc: mais2h,
                      numeroVoo: 'LA8084',
                    });
                  }}
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar evento
                </Button>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border">
                  <div>
                    <label className="text-xs font-medium text-slate-500">
                      Mês da escala (YYYY-MM)
                    </label>
                    <Input
                      type="month"
                      {...form.register('mes')}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500">
                      Modo de publicação
                    </label>
                    <select
                      {...form.register('modo')}
                      className="mt-1 flex h-9 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm"
                    >
                      <option value="atualizar-futuros">
                        Preservar passados e atualizar futuros (Recomendado)
                      </option>
                      <option value="substituir">
                        Substituir mês inteiro (apaga tudo)
                      </option>
                      <option value="complementar">
                        Complementar (mesclar por ID)
                      </option>
                    </select>
                  </div>
                  <div className="flex flex-col justify-end pb-1 gap-1">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <Switch
                        checked={form.watch('ativarMes')}
                        onCheckedChange={(v) => form.setValue('ativarMes', v)}
                      />
                      Tornar mês ativo no app
                    </label>
                    {form.watch('mes') > getMesReferencia() && (
                      <span className="text-[11px] text-slate-500 leading-tight">
                        Mês futuro: a escala de {formatarMesAno(getMesReferencia())}{' '}
                        continua ativa hoje e este mês já entra em Próximos destinos.
                      </span>
                    )}
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Voo / Rota</TableHead>
                      <TableHead>Início (UTC)</TableHead>
                      <TableHead>Fim (UTC)</TableHead>
                      <TableHead>Atraso / Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fields.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center text-slate-500 py-8"
                        >
                          Nenhum evento na fila de revisão. Faça upload de um
                          PDF ou adicione eventos manualmente.
                        </TableCell>
                      </TableRow>
                    ) : (
                      fields.map((field, index) => {
                        const ev = form.watch(`eventos.${index}`);
                        return (
                          <TableRow
                            key={field.id}
                            className={ev?.cancelado ? 'opacity-50 line-through' : ''}
                          >
                            <TableCell className="capitalize font-medium">
                              <div className="flex flex-wrap items-center gap-1">
                                <Badge variant="secondary">{ev?.tipo}</Badge>
                                {ev?.codigoAtividade && (
                                  <Badge variant="outline" className="font-mono text-[10px]">
                                    {ev.codigoAtividade}
                                  </Badge>
                                )}
                                {ev?.extra && (
                                  <Badge variant="estimated" className="text-[10px]">
                                    Extra
                                  </Badge>
                                )}
                                {ev?.inferido && (
                                  <Badge variant="outline" className="text-[10px]">
                                    Auto
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="font-mono text-xs font-semibold">
                                {ev?.origem || '—'} → {ev?.destino || '—'}
                              </div>
                              {(ev?.origem || ev?.destino) && (
                                <div className="text-[11px] text-slate-500">
                                  {formatarCidadeEstado(getAeroporto(ev?.origem)) || ev?.origem || '—'}
                                  {ev?.destino && ev.destino !== ev.origem
                                    ? ` → ${formatarCidadeEstado(getAeroporto(ev?.destino)) || ev.destino}`
                                    : ''}
                                </div>
                              )}
                              {ev?.numeroVoo && (
                                <div className="text-xs text-slate-500">
                                  {ev.numeroVoo}
                                  {ev.icao24 ? ` · ${ev.icao24}` : ''}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-xs whitespace-nowrap">
                              {formatarDataHoraUtc(ev?.inicioUtc)}Z
                            </TableCell>
                            <TableCell className="font-mono text-xs whitespace-nowrap">
                              {formatarDataHoraUtc(ev?.fimUtc)}Z
                            </TableCell>
                            <TableCell>
                              {ev?.cancelado ? (
                                <Badge variant="destructive">Cancelado</Badge>
                              ) : ev?.atrasoMinutos ? (
                                <Badge variant="estimated">
                                  {ev.atrasoMinutos > 0 ? '+' : ''}
                                  {ev.atrasoMinutos} min
                                </Badge>
                              ) : (
                                <span className="text-xs text-slate-400">
                                  No horário
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right space-x-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditIndex(index);
                                  setEditDraft({ ...ev });
                                  setEditInicioBr(formatarDataHoraUtc(ev?.inicioUtc));
                                  setEditFimBr(formatarDataHoraUtc(ev?.fimUtc));
                                }}
                              >
                                Editar
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                onClick={() => remove(index)}
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>

                <div className="flex justify-end pt-2">
                  <Button
                    type="button"
                    size="lg"
                    onClick={handlePublicar}
                    disabled={publicando || fields.length === 0}
                  >
                    <Send className="w-4 h-4" />
                    {publicando
                      ? 'Publicando...'
                      : `Publicar escala (${fields.length} eventos)`}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA 3: CONVITES PARA FAMÍLIA E AMIGOS */}
          <TabsContent value="convites" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Convites para família e amigos</CardTitle>
                <CardDescription>
                  Gere links diretos (<code>/?convite=CODIGO</code>) para
                  compartilhar no WhatsApp. Ative &ldquo;Exigir convite&rdquo;
                  na aba Privacidade para fechar o acesso público.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <form
                  onSubmit={handleCriarConvite}
                  className="grid grid-cols-1 sm:grid-cols-3 gap-2.5"
                >
                  <Input
                    placeholder="Rótulo (ex.: Pais e irmãos)"
                    value={novoRotulo}
                    onChange={(e) => setNovoRotulo(e.target.value)}
                    required
                  />
                  <Input
                    placeholder="Código opcional (vazio = automático)"
                    value={novoCodigo}
                    onChange={(e) =>
                      setNovoCodigo(e.target.value.toUpperCase())
                    }
                    className="uppercase font-mono"
                  />
                  <Button type="submit">
                    <Plus className="w-4 h-4" /> Gerar convite
                  </Button>
                </form>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rótulo</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {convites.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">
                          {c.rotulo}
                        </TableCell>
                        <TableCell className="font-mono font-semibold">
                          {c.codigo}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={c.ativo}
                            onCheckedChange={() => handleToggleConvite(c)}
                          />
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copiarLinkConvite(c.codigo)}
                          >
                            <Copy className="w-3.5 h-3.5" /> Copiar link
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleExcluirConvite(c.id)}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA 4: PRIVACIDADE E CONFIGURAÇÕES */}
          <TabsContent value="config">
            <Card>
              <CardHeader>
                <CardTitle>Privacidade e preferências</CardTitle>
                <CardDescription>
                  Defina o nome exibido, base, atraso opcional na posição e a
                  trava de convites para família e amigos.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 max-w-xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-500">
                      Nome exibido
                    </label>
                    <Input
                      value={config.nomePiloto}
                      onChange={(e) =>
                        setConfig({ ...config, nomePiloto: e.target.value })
                      }
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500">
                      Aeroporto Base (IATA)
                    </label>
                    <Input
                      value={config.baseIata}
                      maxLength={3}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          baseIata: e.target.value.toUpperCase(),
                        })
                      }
                      className="mt-1 uppercase font-mono"
                    />
                  </div>
                </div>

                <div className="rounded-xl border p-3.5 space-y-2">
                  <label className="text-sm font-medium block">
                    Atraso opcional de privacidade (minutos)
                  </label>
                  <select
                    value={config.atrasoPrivacidadeMinutos}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        atrasoPrivacidadeMinutos: Number(e.target.value),
                      })
                    }
                    className="flex h-9 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm"
                  >
                    <option value={0}>Sem atraso (tempo real)</option>
                    <option value={15}>15 minutos de atraso</option>
                    <option value={30}>30 minutos de atraso</option>
                    <option value={60}>60 minutos de atraso</option>
                  </select>
                </div>

                <div className="flex items-center justify-between rounded-xl border p-3.5">
                  <div>
                    <div className="font-medium text-sm">
                      Exigir convite para visualizar o mapa
                    </div>
                    <div className="text-xs text-slate-500">
                      Visitantes precisarão de um link ou código de convite
                      ativo.
                    </div>
                  </div>
                  <Switch
                    checked={config.exigirConvite}
                    onCheckedChange={(v) =>
                      setConfig({ ...config, exigirConvite: v })
                    }
                  />
                </div>

                <Button onClick={handleSalvarConfig}>
                  <CheckCircle2 className="w-4 h-4" /> Salvar configurações
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Modal de edição de evento */}
      <Dialog
        open={editIndex !== null && editDraft !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditIndex(null);
            setEditDraft(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar evento da escala</DialogTitle>
            <DialogDescription>
              Ajuste horários UTC, atrasos operacionais, cancelamento ou
              transponder OpenSky (icao24).
            </DialogDescription>
          </DialogHeader>

          {editDraft && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-500">
                    Tipo
                  </label>
                  <select
                    value={editDraft.tipo}
                    onChange={(e) =>
                      setEditDraft({
                        ...editDraft,
                        tipo: e.target.value as TipoEvento,
                      })
                    }
                    className="mt-1 flex h-9 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm"
                  >
                    {TIPOS_EVENTO.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500">
                    Número do Voo
                  </label>
                  <Input
                    value={editDraft.numeroVoo ?? ''}
                    onChange={(e) =>
                      setEditDraft({
                        ...editDraft,
                        numeroVoo: e.target.value.toUpperCase() || undefined,
                      })
                    }
                    placeholder="Ex.: LA8084"
                    className="mt-1 uppercase font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-500">
                    Origem (IATA)
                  </label>
                  <Input
                    value={editDraft.origem ?? ''}
                    maxLength={3}
                    onChange={(e) =>
                      setEditDraft({
                        ...editDraft,
                        origem: e.target.value.toUpperCase() || undefined,
                      })
                    }
                    placeholder="GRU"
                    className="mt-1 uppercase font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500">
                    Destino (IATA)
                  </label>
                  <Input
                    value={editDraft.destino ?? ''}
                    maxLength={3}
                    onChange={(e) =>
                      setEditDraft({
                        ...editDraft,
                        destino: e.target.value.toUpperCase() || undefined,
                      })
                    }
                    placeholder="LIS"
                    className="mt-1 uppercase font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-500">
                    Início UTC (dd/mm/aaaa HH:mm)
                  </label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="25/11/2026 14:30"
                    maxLength={16}
                    value={editInicioBr}
                    onChange={(e) =>
                      setEditInicioBr(mascararDataHoraBr(e.target.value))
                    }
                    className="mt-1 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500">
                    Fim UTC (dd/mm/aaaa HH:mm)
                  </label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="25/11/2026 16:45"
                    maxLength={16}
                    value={editFimBr}
                    onChange={(e) =>
                      setEditFimBr(mascararDataHoraBr(e.target.value))
                    }
                    className="mt-1 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-500">
                    Atraso manual (min)
                  </label>
                  <Input
                    type="number"
                    value={editDraft.atrasoMinutos ?? 0}
                    onChange={(e) =>
                      setEditDraft({
                        ...editDraft,
                        atrasoMinutos: Number(e.target.value) || 0,
                      })
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500">
                    Transponder icao24 (hex 6 chars · opcional)
                  </label>
                  <Input
                    value={editDraft.icao24 ?? ''}
                    maxLength={6}
                    onChange={(e) =>
                      setEditDraft({
                        ...editDraft,
                        icao24: e.target.value.toLowerCase() || undefined,
                      })
                    }
                    placeholder="e48c55"
                    className="mt-1 lowercase font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-sm">Marcar voo como cancelado</span>
                <Switch
                  checked={Boolean(editDraft.cancelado)}
                  onCheckedChange={(v) =>
                    setEditDraft({ ...editDraft, cancelado: v })
                  }
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditIndex(null);
                setEditDraft(null);
              }}
            >
              Cancelar
            </Button>
            <Button onClick={salvarEdicaoModal}>Salvar alterações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
