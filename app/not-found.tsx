import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center gap-4">
      <h1 className="text-2xl font-bold">Página não encontrada</h1>
      <p className="text-sm text-slate-500 max-w-sm">
        Não encontramos o endereço solicitado. Volte para o radar para acompanhar
        onde o Felipe está.
      </p>
      <Button asChild>
        <Link href="/">Voltar para o mapa</Link>
      </Button>
    </div>
  );
}
