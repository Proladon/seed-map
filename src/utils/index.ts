import { createNoise2D } from 'simplex-noise'
import { BIOMES, BIOME_BY_KEY } from '../config/biome'
import {
  BiomeKey,
  MapData,
  BiomePercentages,
  MapOptions,
  FooterInfo,
  ProgressCallback,
  NoiseFunction,
} from '../types'

/**
 * 將種子碼轉換為數字
 * @param {string} str - 輸入的種子碼
 * @returns {number} - 轉換後的數字
 */
export function hashCode(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  return hash
}

/**
 * 生成10位數字的隨機種子碼
 * @returns {string} - 生成的隨機種子碼
 */
export function generateRandomSeed(): string {
  return String(Math.floor(1000000000 + Math.random() * 9000000000))
}

/**
 * 創建噪聲函數
 * @param {number} seedNum - 種子數字
 * @returns {Function} - 噪聲函數
 */
export function createNoiseFunction(seedNum: number): NoiseFunction {
  return createNoise2D(() => {
    // 使用種子碼初始化隨機數生成器
    let seed = seedNum
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  })
}

/**
 * 生成地圖數據
 * @param {Object} options - 地圖生成選項
 * @param {string} options.seed - 種子碼
 * @param {number} options.mapSize - 地圖大小
 * @param {number} options.scale - 地形縮放值(10-100)
 * @param {Function} progressCallback - 進度回調函數，參數為完成百分比(0-100)
 * @returns {Promise<Array<Array<string>>>} - 生成的地圖數據，二維陣列，每個元素是生物群系的key
 */
export function generateMapData(
  { seed, mapSize, scale }: MapOptions,
  progressCallback: ProgressCallback = () => {},
): Promise<MapData> {
  return new Promise((resolve) => {
    // 確保種子碼有效
    const validSeed = !/^\d{10}$/.test(seed) ? '1234567890' : seed

    // 使用種子碼初始化噪聲函數
    const seedNum = hashCode(validSeed)
    const simplex = createNoiseFunction(seedNum)

    // 創建地圖數據陣列
    const mapData: MapData = Array(mapSize)
      .fill(null)
      .map(() => Array(mapSize).fill(0))

    // 地形縮放係數
    const noiseScale = scale / 1000

    // 分批處理地圖生成
    let y = 0
    const chunkSize = 10 // 每批處理的行數

    function processChunk(): void {
      const endY = Math.min(y + chunkSize, mapSize)

      for (let currentY = y; currentY < endY; currentY++) {
        for (let x = 0; x < mapSize; x++) {
          // 生成柏林噪聲值 (-1 到 1 之間)
          const nx = x * noiseScale
          const ny = currentY * noiseScale

          // 使用多層噪聲來增加複雜度
          const noise1 = simplex(nx, ny)
          const noise2 = simplex(nx * 2, ny * 2) * 0.5
          const noise3 = simplex(nx * 4, ny * 4) * 0.25

          // 合併噪聲
          let value = (noise1 + noise2 + noise3) / 1.75
          // 將值轉換到 0-1 範圍
          value = (value + 1) / 2

          // 根據高度值設置生物群系
          let biomeKey: BiomeKey
          if (value < 0.3) {
            biomeKey = BIOMES.OCEAN.key // 深海
          } else if (value < 0.4) {
            biomeKey = BIOMES.SHALLOW_OCEAN.key // 淺海
          } else if (value < 0.45) {
            biomeKey = BIOMES.BEACH.key // 沙灘
          } else if (value < 0.6) {
            biomeKey = BIOMES.PLAINS.key // 平原
          } else if (value < 0.7) {
            biomeKey = BIOMES.FOREST.key // 森林
          } else if (value < 0.85) {
            biomeKey = BIOMES.MOUNTAIN.key // 山脈
          } else {
            biomeKey = BIOMES.SNOW.key // 雪山
          }

          // 儲存生態域類型到地圖數據
          mapData[currentY][x] = biomeKey
        }
      }

      // 更新進度
      y = endY
      progressCallback(Math.floor((y / mapSize) * 100))

      // 如果還有剩餘行數要處理，繼續處理
      if (y < mapSize) {
        setTimeout(processChunk, 0)
      } else {
        // 處理完成
        resolve(mapData)
      }
    }

    // 開始處理
    processChunk()
  })
}

/**
 * 繪製地圖到畫布
 * @param {HTMLCanvasElement} canvas - Canvas元素
 * @param {Array<Array<string>>} mapData - 地圖數據
 * @param {boolean} includeFooter - 是否包含底部信息
 * @param {Object} footerInfo - 底部信息
 * @param {string} footerInfo.seed - 種子碼
 * @param {number} footerInfo.mapSize - 地圖大小
 * @returns {void}
 */
export function drawMapToCanvas(
  canvas: HTMLCanvasElement,
  mapData: MapData,
  includeFooter = false,
  footerInfo: Partial<FooterInfo> = {},
): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const mapSize = mapData.length

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // 繪製地圖數據
  for (let y = 0; y < mapSize; y++) {
    if (!mapData[y]) continue // 確保這一行數據存在

    for (let x = 0; x < mapSize; x++) {
      const biomeKey = mapData[y][x]
      if (biomeKey === undefined) continue // 跳過未定義的數據

      // 使用 BIOME_BY_KEY 直接查詢顏色
      const biome = BIOME_BY_KEY[biomeKey]
      if (biome) {
        ctx.fillStyle = biome.color
        ctx.fillRect(x, y, 1, 1)
      } else {
        ctx.fillStyle = '#FF0000' // 錯誤顏色
        ctx.fillRect(x, y, 1, 1)
      }
    }
  }

  // 如果需要添加底部信息
  if (includeFooter && footerInfo.seed && footerInfo.mapSize) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
    ctx.fillRect(0, mapSize - 20, mapSize, 20)
    ctx.fillStyle = '#000000'
    ctx.font = '12px Arial'
    ctx.fillText(
      `種子碼: ${footerInfo.seed}, 尺寸: ${footerInfo.mapSize}x${footerInfo.mapSize}`,
      10,
      mapSize - 6,
    )
  }
}

/**
 * 計算各生態域的百分比
 * @param {Array<Array<string>>} mapData - 地圖數據
 * @returns {Object} - 各生態域的百分比信息
 */
export function calculateBiomePercentage(mapData: MapData): BiomePercentages {
  if (!mapData || !mapData.length) return {} as BiomePercentages

  const mapSize = mapData.length
  const totalCells = mapSize * mapSize
  const biomeCounts: Record<BiomeKey, number> = {} as Record<BiomeKey, number>

  // 初始化每種生態域的計數
  Object.values(BIOMES).forEach((biome) => {
    biomeCounts[biome.key] = 0
  })

  // 計算每種生態域的數量
  for (let y = 0; y < mapSize; y++) {
    if (!mapData[y]) continue // 確保這一行數據存在

    for (let x = 0; x < mapSize; x++) {
      const biomeKey = mapData[y][x]
      if (biomeKey !== undefined) {
        biomeCounts[biomeKey]++
      }
    }
  }

  // 計算每種生態域的百分比
  const biomePercentages: BiomePercentages = {} as BiomePercentages
  for (const biomeKey in biomeCounts) {
    const biome = BIOME_BY_KEY[Number(biomeKey)]
    if (biome) {
      biomePercentages[Number(biomeKey)] = {
        name: biome.name,
        percentage: ((biomeCounts[Number(biomeKey)] / totalCells) * 100).toFixed(1),
        color: biome.color,
      }
    }
  }

  return biomePercentages
}

/**
 * 保存地圖為PNG圖片
 * @param {Array<Array<string>>} mapData - 地圖數據
 * @param {Object} options - 選項
 * @param {string} options.seed - 種子碼
 * @param {number} options.mapSize - 地圖大小
 * @returns {string} - 圖片的DataURL
 */
export function saveMapAsPNG(mapData: MapData, { seed, mapSize }: FooterInfo): string {
  // 創建一個新畫布來繪製完整的地圖
  const exportCanvas = document.createElement('canvas')
  exportCanvas.width = mapSize
  exportCanvas.height = mapSize

  // 繪製地圖到Canvas
  drawMapToCanvas(exportCanvas, mapData, true, { seed, mapSize })

  // 返回DataURL
  return exportCanvas.toDataURL('image/png')
}
