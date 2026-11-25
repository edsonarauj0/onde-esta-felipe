# Onde está o Felipe?

Aplicação web em **Next.js (App Router) + React + TypeScript** para família e amigos acompanharem em tempo real onde o Felipe está voando, pernoitando ou de folga — combinando a escala mensal publicada em PDF com rastreamento ao vivo via **OpenSky Network**.

## Funcionalidades implementadas

### MVP
- **Mapa interativo (`MapLibre GL` + `react-map-gl`)** carregado com `ssr: false`, usando **OpenFreeMap** gratuitamente por padrão (ou **MapTiler** se `NEXT_PUBLIC_MAPTILER_KEY` for informada).
- **Motor de status (`lib/status.ts`)**: `getStatus(eventos, agora, config)` calcula estado atual (`voo`, `pernoite`, `folga`, `sobreaviso`, `treinamento`, `sem-escala`), arco geodésico (`@turf/great-circle`, `@turf/along`, `@turf/bearing`, `@turf/length`), progresso e horários locais (`date-fns-tz`).
- **Atualização automática** a cada 30 segundos (arco estimado) e 60 segundos (telemetria ao vivo via OpenSky).
- **Card de status** com rota, distância, barra de progresso, horários locais de decolagem/chegada e lista de **próximos dias**.
- **Rastreamento ao vivo com OpenSky Network (`/api/posicao/[id]`)**:
  - `export const revalidate = 60` + cache em memória de 60s por evento (1 chamada/min independente do número de familiares conectados).
  - Consulta apenas dentro da janela do voo (`partida - 1h` até `chegada + 1h`).
  - Resolve `numeroVoo` para `icao24` via `/api/flights/departure` quando necessário e salva no Firestore.
  - Suporta autenticação OAuth2 Client Credentials atual da OpenSky (`OPENSKY_CLIENT_ID` / `OPENSKY_CLIENT_SECRET`) e fallback para Basic Auth legado.
  - Sem cobertura ADS-B (ex.: travessia do Atlântico), faz fallback automático para o arco calculado e exibe **"Posição estimada"**.
- **Painel Admin (`/admin`)**:
  - Login via Firebase Auth (Google ou e-mail/senha) exigindo custom claim `admin: true` no cliente e nas rotas de API (Firebase Admin SDK).
  - Upload do PDF da escala (`unpdf` no servidor + API do Claude `@anthropic-ai/sdk` + validação com `zod`) e armazenamento privado no Firebase Storage.
  - Tela de revisão com `react-hook-form` para corrigir horários, atrasos manuais, cancelamentos e `icao24` antes de publicar.
  - Publicação no Firestore (`escalas/{YYYY-MM}/eventos/{id}`) com sincronização em tempo real (`onSnapshot`).

### Fase 2 e 3
- **Poses distintas na caricatura** (`Caricatura.tsx`) para voo, pernoite, folga, sobreaviso e treinamento.
- **Convites por link ou código** (`/?convite=CODIGO`) com criação, ativação e revogação no painel admin.
- **Troca de mês** com opção de substituir ou complementar a escala existente.
- **Modo de privacidade**: exibe apenas cidade/aeroporto (nunca hotel) e suporta atraso opcional de 15, 30 ou 60 minutos.
- **Estado vazio**, **resumo/histórico do mês**, **tema escuro** e **manifesto PWA** (`app/manifest.ts`).

---

## Como rodar localmente

```bash
npm install
npm run dev
```

Sem `.env.local`, o app inicia automaticamente em **Modo Demonstração** com escala dinâmica, simulador de cenários (voo estimado, voo ao vivo, pernoite, folga, simulador e estado vazio) e painel admin local em `/admin`.

## Configuração de produção (Firebase, Claude, OpenSky e Vercel)

1. Copie `.env.example` para `.env.local` e preencha suas chaves (na Vercel, configure todas no painel de Environment Variables — **nunca** comite chaves reais).
2. Aplique as regras de segurança no console ou via Firebase CLI:
   - `firestore.rules`
   - `storage.rules`
3. Conceda a claim `admin: true` à conta do Felipe:
   ```bash
   node --env-file=.env.local scripts/set-admin-claim.mjs felipe@seudominio.com
   ```
4. Crie suas credenciais OAuth2 na conta registrada da [OpenSky Network](https://opensky-network.org) (4.000 créditos/dia gratuitos) e preencha `OPENSKY_CLIENT_ID` e `OPENSKY_CLIENT_SECRET`.

## Testes e build

```bash
npm test
npm run build
```
