'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Map, {
  Layer,
  Marker,
  NavigationControl,
  Source,
  type MapRef,
} from 'react-map-gl/maplibre';
import greatCircle from '@turf/great-circle';
import { lineString, point } from '@turf/helpers';
import length from '@turf/length';
import { Crosshair, LocateFixed, Maximize2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { PosicaoAoVivo, StatusFelipe } from '@/lib/types';
import { Caricatura } from './Caricatura';

interface MapaProps {
  status: StatusFelipe;
  posicaoAoVivo: PosicaoAoVivo | null;
  nomePiloto?: string;
  darkMode?: boolean;
}

function getMapStyleUrl(darkMode: boolean): string {
  const maptilerKey = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  if (maptilerKey) {
    return darkMode
      ? `https://api.maptiler.com/maps/streets-v2-dark/style.json?key=${maptilerKey}`
      : `https://api.maptiler.com/maps/streets-v2/style.json?key=${maptilerKey}`;
  }
  // OpenFreeMap (100% gratuito, sem necessidade de API key)
  return darkMode
    ? 'https://tiles.openfreemap.org/styles/dark'
    : 'https://tiles.openfreemap.org/styles/liberty';
}

function calcularLigacaoUsuarioFelipe(
  eu: [number, number],
  felipe: [number, number]
): {
  linha: GeoJSON.Feature<GeoJSON.LineString>;
  distanciaKm: number;
} {
  const mesmoLugar =
    Math.abs(eu[0] - felipe[0]) < 0.0005 &&
    Math.abs(eu[1] - felipe[1]) < 0.0005;

  if (mesmoLugar) {
    return {
      linha: lineString([eu, felipe]),
      distanciaKm: 0,
    };
  }

  const gc = greatCircle(point(eu), point(felipe), { npoints: 60 });
  const linha: GeoJSON.Feature<GeoJSON.LineString> =
    gc.geometry.type === 'LineString'
      ? (gc as GeoJSON.Feature<GeoJSON.LineString>)
      : lineString(gc.geometry.coordinates.flat());

  const distanciaKm = length(linha, { units: 'kilometers' });
  return { linha, distanciaKm };
}

export default function Mapa({
  status,
  posicaoAoVivo,
  nomePiloto = 'Felipe',
  darkMode = false,
}: MapaProps) {
  const mapRef = useRef<MapRef | null>(null);
  const [minhaPosicao, setMinhaPosicao] = useState<[number, number] | null>(
    null
  );
  const [buscandoLocal, setBuscandoLocal] = useState(false);

  const coordenadaAtiva: [number, number] = useMemo(() => {
    if (
      status.estado === 'voo' &&
      posicaoAoVivo?.fonte === 'ao-vivo' &&
      typeof posicaoAoVivo.lng === 'number' &&
      typeof posicaoAoVivo.lat === 'number'
    ) {
      return [posicaoAoVivo.lng, posicaoAoVivo.lat];
    }
    return status.coordenada;
  }, [status.estado, status.coordenada, posicaoAoVivo]);

  const rumoAtivo = useMemo(() => {
    if (
      status.estado === 'voo' &&
      posicaoAoVivo?.fonte === 'ao-vivo' &&
      typeof posicaoAoVivo.rumo === 'number'
    ) {
      return posicaoAoVivo.rumo;
    }
    return status.rumo;
  }, [status.estado, status.rumo, posicaoAoVivo]);

  const ligacaoComigo = useMemo(() => {
    if (!minhaPosicao) return null;
    return calcularLigacaoUsuarioFelipe(minhaPosicao, coordenadaAtiva);
  }, [minhaPosicao, coordenadaAtiva]);

  const enquadrarPontos = useCallback(
    (pontos: Array<[number, number]>, maxZoom = 11) => {
      const map = mapRef.current;
      if (!map || pontos.length === 0) return;

      const lngs = pontos.map((p) => p[0]);
      const lats = pontos.map((p) => p[1]);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);

      // Se os dois pontos estão quase no mesmo lugar, faz flyTo suave
      if (maxLng - minLng < 0.01 && maxLat - minLat < 0.01) {
        map.flyTo({
          center: pontos[0]!,
          zoom: Math.min(13, maxZoom),
          duration: 900,
        });
        return;
      }

      map.fitBounds(
        [
          [minLng, minLat],
          [maxLng, maxLat],
        ],
        { padding: 76, duration: 900, maxZoom }
      );
    },
    []
  );

  const verNosDois = useCallback(
    (origemUsuario?: [number, number]) => {
      const posUsuario = origemUsuario ?? minhaPosicao;
      if (!posUsuario) return;
      const pontos: Array<[number, number]> = [posUsuario, coordenadaAtiva];
      if (
        status.estado === 'voo' &&
        status.origemAeroporto &&
        status.destinoAeroporto
      ) {
        pontos.push([status.origemAeroporto.lng, status.origemAeroporto.lat]);
        pontos.push([status.destinoAeroporto.lng, status.destinoAeroporto.lat]);
      }
      enquadrarPontos(pontos, 12);
    },
    [
      minhaPosicao,
      coordenadaAtiva,
      status.estado,
      status.origemAeroporto,
      status.destinoAeroporto,
      enquadrarPontos,
    ]
  );

  const centralizar = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    if (
      status.estado === 'voo' &&
      status.origemAeroporto &&
      status.destinoAeroporto
    ) {
      enquadrarPontos(
        [
          [status.origemAeroporto.lng, status.origemAeroporto.lat],
          [status.destinoAeroporto.lng, status.destinoAeroporto.lat],
          coordenadaAtiva,
        ],
        6
      );
      return;
    }

    map.flyTo({
      center: coordenadaAtiva,
      zoom: status.aeroportoAtual?.iata === 'CASA' ? 12 : 9,
      duration: 900,
    });
  }, [
    status.estado,
    status.origemAeroporto,
    status.destinoAeroporto,
    status.aeroportoAtual?.iata,
    coordenadaAtiva,
    enquadrarPontos,
  ]);

  const solicitarMinhaLocalizacao = useCallback(
    (silencioso = false) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        if (!silencioso) {
          toast.error('Seu navegador não suporta geolocalização.');
        }
        return;
      }

      setBuscandoLocal(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coord: [number, number] = [
            pos.coords.longitude,
            pos.coords.latitude,
          ];
          setMinhaPosicao(coord);
          setBuscandoLocal(false);
          verNosDois(coord);
        },
        (err) => {
          setBuscandoLocal(false);
          if (!silencioso) {
            if (err.code === err.PERMISSION_DENIED) {
              toast.error(
                'Permissão de localização negada. Ative no cadeado do navegador para ver onde você está.'
              );
            } else {
              toast.error('Não foi possível obter sua localização agora.');
            }
          }
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 120_000 }
      );
    },
    [verNosDois]
  );

  // Tenta obter a localização automaticamente ao abrir o mapa
  useEffect(() => {
    solicitarMinhaLocalizacao(true);
    // Executa apenas na montagem inicial
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (minhaPosicao) {
        verNosDois(minhaPosicao);
      } else {
        centralizar();
      }
    }, 350);
    return () => clearTimeout(timer);
    // Re-enquadra quando muda o evento ativo ou o estado
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.eventoAtual?.id, status.estado]);

  const mapStyle = useMemo(() => getMapStyleUrl(darkMode), [darkMode]);

  return (
    <div className="relative w-full h-[340px] sm:h-[440px] md:h-[580px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm bg-slate-100 dark:bg-slate-900">
      <Map
        ref={mapRef}
        initialViewState={{
          longitude: coordenadaAtiva[0],
          latitude: coordenadaAtiva[1],
          zoom: status.estado === 'voo' ? 3 : 8,
        }}
        mapStyle={mapStyle}
        attributionControl={{ compact: true }}
        style={{ width: '100%', height: '100%' }}
      >
        <NavigationControl position="top-right" showCompass={false} />

        {/* Arco de grande círculo do voo ativo */}
        {status.rota && (
          <>
            <Source
              id="rota-completa"
              type="geojson"
              data={status.rota.completa}
            >
              <Layer
                id="rota-completa-line"
                type="line"
                paint={{
                  'line-color': darkMode ? '#38bdf8' : '#0284c7',
                  'line-width': 2.5,
                  'line-dasharray': [3, 3],
                  'line-opacity': 0.5,
                }}
              />
            </Source>

            <Source
              id="rota-percorrida"
              type="geojson"
              data={status.rota.percorrida}
            >
              <Layer
                id="rota-percorrida-line"
                type="line"
                paint={{
                  'line-color':
                    posicaoAoVivo?.fonte === 'ao-vivo' ? '#10b981' : '#0284c7',
                  'line-width': 3.5,
                  'line-opacity': 0.95,
                }}
              />
            </Source>
          </>
        )}

        {/* Linha pontilhada ligando Você ↔ Felipe para dar noção real de distância */}
        {ligacaoComigo && ligacaoComigo.distanciaKm >= 0.3 && (
          <Source
            id="linha-usuario-felipe"
            type="geojson"
            data={ligacaoComigo.linha}
          >
            <Layer
              id="linha-usuario-felipe-layer"
              type="line"
              paint={{
                'line-color': darkMode ? '#f472b6' : '#ec4899',
                'line-width': 2,
                'line-dasharray': [2, 3],
                'line-opacity': 0.75,
              }}
            />
          </Source>
        )}

        {/* Marcador do aeroporto de origem */}
        {status.origemAeroporto && status.estado === 'voo' && (
          <Marker
            longitude={status.origemAeroporto.lng}
            latitude={status.origemAeroporto.lat}
            anchor="center"
          >
            <div className="flex flex-col items-center">
              <span className="w-3 h-3 rounded-full bg-sky-600 ring-4 ring-sky-500/30" />
              <span className="mt-1 px-1.5 py-0.5 rounded bg-white/90 dark:bg-slate-900/90 text-[10px] font-bold tracking-wider text-slate-800 dark:text-slate-100 shadow border border-slate-200 dark:border-slate-700">
                {status.origemAeroporto.iata}
              </span>
            </div>
          </Marker>
        )}

        {/* Marcador do aeroporto de destino */}
        {status.destinoAeroporto && status.estado === 'voo' && (
          <Marker
            longitude={status.destinoAeroporto.lng}
            latitude={status.destinoAeroporto.lat}
            anchor="center"
          >
            <div className="flex flex-col items-center">
              <span className="w-3 h-3 rounded-full bg-emerald-600 ring-4 ring-emerald-500/30" />
              <span className="mt-1 px-1.5 py-0.5 rounded bg-white/90 dark:bg-slate-900/90 text-[10px] font-bold tracking-wider text-slate-800 dark:text-slate-100 shadow border border-slate-200 dark:border-slate-700">
                {status.destinoAeroporto.iata}
              </span>
            </div>
          </Marker>
        )}

        {/* Marcador da posição de quem abriu o navegador ("Você") */}
        {minhaPosicao && (
          <Marker
            longitude={minhaPosicao[0]}
            latitude={minhaPosicao[1]}
            anchor="center"
          >
            <div className="flex flex-col items-center select-none">
              <div className="relative flex items-center justify-center">
                <span className="absolute w-7 h-7 rounded-full bg-blue-500/30 animate-ping" />
                <span className="relative w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow-md" />
              </div>
              <span className="mt-1 px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-semibold shadow">
                Você
              </span>
            </div>
          </Marker>
        )}

        {/* Caricatura do Felipe na posição atual (ao vivo ou estimada) */}
        <Marker
          longitude={coordenadaAtiva[0]}
          latitude={coordenadaAtiva[1]}
          anchor="center"
        >
          <Caricatura
            estado={status.estado}
            nome={nomePiloto}
            rumo={rumoAtivo}
            fonte={posicaoAoVivo?.fonte ?? 'estimada'}
            numeroVoo={status.eventoAtual?.numeroVoo}
          />
        </Marker>
      </Map>

      {/* Botões flutuantes inferiores: achar Felipe + mostrar minha posição / ver nós dois */}
      <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 z-10 flex flex-wrap items-center gap-1.5 sm:gap-2 max-w-[calc(100%-1.5rem)]">
        <Button
          size="sm"
          variant="outline"
          onClick={centralizar}
          className="h-8 px-2.5 sm:px-3 text-xs bg-white/95 dark:bg-slate-900/95 backdrop-blur shadow-md"
        >
          <Crosshair className="w-3.5 h-3.5" />
          <span className="sm:hidden">Achar {nomePiloto} 🎯</span>
          <span className="hidden sm:inline">Achar o {nomePiloto} no mapa 🎯</span>
        </Button>

        {minhaPosicao ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => verNosDois()}
            className="h-8 px-2.5 sm:px-3 text-xs bg-white/95 dark:bg-slate-900/95 backdrop-blur shadow-md border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Ver nós dois</span>
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            disabled={buscandoLocal}
            onClick={() => solicitarMinhaLocalizacao(false)}
            className="h-8 px-2.5 sm:px-3 text-xs bg-white/95 dark:bg-slate-900/95 backdrop-blur shadow-md"
          >
            <LocateFixed className="w-3.5 h-3.5 text-blue-600" />
            <span>{buscandoLocal ? 'Localizando...' : 'Onde estou'}</span>
          </Button>
        )}
      </div>

      {/* Legendas no topo esquerdo: fonte ADS-B + distância Você ↔ Felipe */}
      <div className="absolute top-2.5 left-2.5 sm:top-3 sm:left-3 z-10 flex flex-col items-start gap-1.5 max-w-[calc(100%-3.5rem)]">
        {status.estado === 'voo' && (
          <div className="truncate max-w-full rounded-full px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-medium bg-white/92 dark:bg-slate-900/92 backdrop-blur border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-1.5 sm:gap-2">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                posicaoAoVivo?.fonte === 'ao-vivo'
                  ? 'bg-emerald-500 animate-pulse'
                  : 'bg-amber-500'
              }`}
            />
            <span className="truncate">
              {posicaoAoVivo?.fonte === 'ao-vivo'
                ? `No radar ao vivo! · ${posicaoAoVivo.provedor || 'adsb.lol'} 📡`
                : 'No chute da escala (sem sinal ADS-B) 🌊'}
            </span>
          </div>
        )}

        {ligacaoComigo && (
          <div className="truncate max-w-full rounded-full px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-medium bg-white/92 dark:bg-slate-900/92 backdrop-blur border border-pink-200 dark:border-pink-900/70 text-slate-800 dark:text-slate-100 shadow-sm flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
            <span className="truncate">
              {ligacaoComigo.distanciaKm < 1
                ? `Você e o ${nomePiloto} estão juntinhos! (< 1 km)`
                : `Você ↔ ${nomePiloto}: ${Math.round(
                    ligacaoComigo.distanciaKm
                  ).toLocaleString('pt-BR')} km`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
