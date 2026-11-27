export type TipoEvento =
  | 'voo'
  | 'pernoite'
  | 'folga'
  | 'sobreaviso'
  | 'treinamento';

export type EventoEscala = {
  id: string;
  tipo: TipoEvento;
  origem?: string;          // código IATA, ex.: "GRU"
  destino?: string;         // código IATA, ex.: "LIS"
  inicioUtc: string;        // ISO 8601 UTC
  fimUtc: string;           // ISO 8601 UTC
  numeroVoo?: string;       // ex.: "LA3366"
  icao24?: string;          // endereço transponder hex OpenSky, ex.: "e48c55"
  callsign?: string;        // callsign ATC, ex.: "TAM3366"
  codigoAtividade?: string; // código Crewtopia: ASB, HSB, DO, DR, OFF, SIM...
  extra?: boolean;          // tripulante extra (deadhead)
  inferido?: boolean;       // ex.: pernoite inferido entre jornadas fora da base
  cancelado?: boolean;
  atrasoMinutos?: number;
  observacao?: string;
};

export type Aeroporto = {
  iata: string;
  icao: string;
  nome: string;
  cidade: string;
  estado?: string; // UF no Brasil (ex.: "SP", "ES", "PA") ou sigla do país no exterior (ex.: "PT", "EUA")
  pais: string;
  lat: number;
  lng: number;
  tz: string; // IANA timezone, ex.: "America/Sao_Paulo"
};

export type FontePosicao = 'ao-vivo' | 'estimada';

export type PosicaoAoVivo = {
  fonte: FontePosicao;
  provedor?: 'adsb.lol' | 'airplanes.live' | 'opensky';
  lng?: number;
  lat?: number;
  altitude?: number | null;     // metros (barométrica)
  velocidadeMs?: number | null; // m/s
  rumo?: number | null;         // graus (true track)
  noSolo?: boolean;
  icao24?: string;
  callsign?: string | null;
  matricula?: string | null;    // ex.: PR-MYP
  aeronaveTipo?: string | null; // ex.: A320
  atualizadoEm?: string;
  motivo?: string;
};

export type ConfiguracoesApp = {
  nomePiloto: string;
  baseIata: string;
  mesAtivo: string; // "YYYY-MM"
  modoPrivacidade: boolean; // apenas cidade, sem detalhes de hotel
  atrasoPrivacidadeMinutos: number; // 0, 15, 30, 60
  exigirConvite: boolean;
  atualizadoEm?: string;
};

export type Convite = {
  id: string;
  codigo: string;
  rotulo: string;
  ativo: boolean;
  criadoEm: string;
  expiraEm?: string | null;
};

export type EstadoStatus = TipoEvento | 'em-solo' | 'sem-escala';

export type RotaGeoJSON = {
  completa: GeoJSON.Feature<GeoJSON.LineString>;
  percorrida: GeoJSON.Feature<GeoJSON.LineString>;
  restante: GeoJSON.Feature<GeoJSON.LineString>;
  distanciaTotalKm: number;
};

export type StatusFelipe = {
  estado: EstadoStatus;
  eventoAtual: EventoEscala | null;
  proximoEvento: EventoEscala | null;
  proximosEventos: EventoEscala[];
  progresso: number; // 0 a 100
  coordenada: [number, number]; // [lng, lat]
  rumo: number; // graus 0..360
  rota: RotaGeoJSON | null;
  origemAeroporto: Aeroporto | null;
  destinoAeroporto: Aeroporto | null;
  aeroportoAtual: Aeroporto | null;
  inicioEfetivoUtc: string | null;
  fimEfetivoUtc: string | null;
  tempoRestanteMs: number | null;
  referenciaAgoraUtc: string;
  privacidadeAplicada: boolean;
};

export type ModoPublicacao =
  | 'atualizar-futuros'
  | 'substituir'
  | 'complementar';

export type ImportacaoHistorico = {
  id: string;
  criadoEm: string;
  mes: string; // YYYY-MM
  nomeArquivo: string;
  formato: string;
  modo: ModoPublicacao;
  tripulante?: string | null;
  totalEventos: number;
  totalVoos: number;
  passadosPreservados: number;
  futurosSubstituidos: number;
  publicadoPor?: string | null;
};

export type ResumoMes = {
  totalVoos: number;
  totalPernoites: number;
  totalFolgas: number;
  distanciaTotalKm: number;
  horasVoo: number;
  cidadesVisitadas: string[];
};
