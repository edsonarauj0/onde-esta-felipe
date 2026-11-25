'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { KeyRound, Plane, Settings, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface ConviteGateProps {
  nomePiloto: string;
  onValidado: (codigo: string) => void;
}

export function ConviteGate({ nomePiloto, onValidado }: ConviteGateProps) {
  const [codigo, setCodigo] = useState('');
  const [validando, setValidando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = codigo.trim().toUpperCase();
    if (!clean) return;

    setValidando(true);
    try {
      const res = await fetch(`/api/convites?code=${encodeURIComponent(clean)}`);
      const data = (await res.json()) as {
        valido?: boolean;
        rotulo?: string;
        expirado?: boolean;
      };

      if (data.valido) {
        toast.success(`Bem-vindo(a)! Convite "${data.rotulo || clean}" validado.`);
        onValidado(clean);
      } else {
        toast.error(
          data.expirado
            ? 'Este convite já expirou. Peça um novo link.'
            : 'Código de convite inválido ou desativado.'
        );
      }
    } catch {
      toast.error('Erro ao validar o convite. Tente novamente.');
    } finally {
      setValidando(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-sky-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-sky-950">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-sky-600 text-white flex items-center justify-center mx-auto shadow-md">
            <Plane className="w-6 h-6" />
          </div>
          <CardTitle className="text-xl">Onde está o {nomePiloto}?</CardTitle>
          <CardDescription>
            Este painel é privado para família e amigos. Digite o código do
            convite ou abra o link enviado pelo {nomePiloto}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <Input
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                placeholder="Ex.: FAMILIA2026"
                className="pl-9 uppercase font-mono tracking-wider"
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full" disabled={validando}>
              <ShieldCheck className="w-4 h-4" />
              {validando ? 'Validando convite...' : 'Entrar'}
            </Button>
          </form>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-center">
            <Button variant="ghost" size="sm" asChild className="text-xs text-slate-500">
              <Link href="/admin">
                <Settings className="w-3.5 h-3.5" /> Sou o administrador
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
