'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import Map, {
  Layer,
  Marker,
  NavigationControl,
  Source,
  type MapRef,
} from 'react-map-gl/maplibre';
import { Crosshair } from 'lucide-react';
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

export default function Mapa({
  status,
  posicaoAoVivo,
  nomePiloto = 'Felipe',
  darkMode = false,
}: MapaProps) {
  const mapRef = useRef<MapRef | null>(null);

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

  const centralizar = () => {
    const map = mapRef.current;
    if (!map) return;

    if (
      status.estado === 'voo' &&
      status.origemAeroporto &&
      status.destinoAeroporto
    ) {
      const lngs = [
        status.origemAeroporto.lng,
        status.destinoAeroporto.lng,
        coordenadaAtiva[0],
      ];
      const lats = [
        status.origemAeroporto.lat,
        status.destinoAeroporto.lat,
        coordenadaAtiva[1],
      ];
      map.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { padding: 72, duration: 900, maxZoom: 6 }
      );
      return;
    }

    map.flyTo({
      center: coordenadaAtiva,
      zoom: 9,
      duration: 900,
    });
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      centralizar();
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

      {/* Botão flutuante para centralizar no Felipe */}
      <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 z-10 flex items-center gap-2">
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
      </div>

      {/* Legenda da fonte de posição */}
      {status.estado === 'voo' && (
        <div className="absolute top-2.5 left-2.5 sm:top-3 sm:left-3 z-10 max-w-[calc(100%-3.5rem)] truncate rounded-full px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-medium bg-white/92 dark:bg-slate-900/92 backdrop-blur border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-1.5 sm:gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              posicaoAoVivo?.fonte === 'ao-vivo'
                ? 'bg-emerald-500 animate-pulse'
                : 'bg-amber-500'
            }`}
          />
          {posicaoAoVivo?.fonte === 'ao-vivo'
            ? `No radar ao vivo! · ${posicaoAoVivo.provedor || 'adsb.lol'} 📡`
            : 'No chute da escala (sem sinal ADS-B) 🌊'}
        </div>
      )}
    </div>
  );
}
