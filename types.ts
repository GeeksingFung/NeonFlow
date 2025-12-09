export interface AudioData {
  frequencyData: Uint8Array;
  timeDomainData: Uint8Array;
}

export enum VisualizerMode {
  CIRCULAR = 'CIRCULAR',
  BARS = 'BARS',
  WAVE = 'WAVE',
  NEURAL = 'NEURAL',
  WATERCOLOR = 'WATERCOLOR',
  NEBULA = 'NEBULA',
  WATER_CIRCLE = 'WATER_CIRCLE'
}

export interface VisualizerConfig {
  mode: VisualizerMode;
  sensitivity: number;
  colorSpeed: number;
}