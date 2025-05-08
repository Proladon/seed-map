// 生態域常數定義 - 包含鍵值、名稱和顏色
export const BIOMES = {
  OCEAN: { key: 0, name: '深海', color: '#0066BB' },
  SHALLOW_OCEAN: { key: 1, name: '淺海', color: '#3399CC' },
  BEACH: { key: 2, name: '沙灘', color: '#DDCC88' },
  PLAINS: { key: 3, name: '平原', color: '#669944' },
  FOREST: { key: 4, name: '森林', color: '#22AA22' },
  MOUNTAIN: { key: 5, name: '山脈', color: '#777777' },
  SNOW: { key: 6, name: '雪山', color: '#FFFFFF' },
  VILLAGE: { key: 7, name: '村莊', color: '#FF6347' },
}

// 方便根據鍵值查找生態域
export const BIOME_BY_KEY = Object.values(BIOMES).reduce(
  (acc, biome) => {
    acc[biome.key] = biome
    return acc
  },
  {} as Record<number, (typeof BIOMES)[keyof typeof BIOMES]>,
)
