import { createNoise2D } from 'simplex-noise'

// Map Generator Types
export type BiomeKey = number
export type MapData = BiomeKey[][]
export type BiomePercentage = {
  name: string
  percentage: string
  color: string
}

export type BiomePercentages = Record<BiomeKey, BiomePercentage>

export interface MapOptions {
  seed: string
  mapSize: number
  scale: number
}

export interface FooterInfo {
  seed: string
  mapSize: number
}

export type ProgressCallback = (progress: number) => void

export type NoiseFunction = ReturnType<typeof createNoise2D>
