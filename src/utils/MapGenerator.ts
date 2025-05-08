import SeededRandom from './SeededRandom'
import { generateOctaveNoise, applyGaussianBlur } from './NoiseGenerator'
import { BIOMES } from '../config/biome'

// Define interfaces for better type safety
interface OceanCenter {
  x: number
  y: number
  radius: number
}

interface Cell {
  x: number
  y: number
  elevation?: number
  aridity?: number
  biome?: number
  dist?: number
}

interface BiomePercentages {
  [key: number]: string
}

/**
 * 地圖生成器類
 * 負責根據種子和參數生成地圖
 */
export default class MapGenerator {
  private seed: number
  private size: number
  private biomeRatios: { [key: number]: number }
  private rng: SeededRandom

  /**
   * 構造函數
   * @param seed - 地圖種子
   * @param size - 地圖尺寸
   * @param biomeRatios - 生態域比例
   */
  constructor(seed: number, size: number, biomeRatios: { [key: number]: number }) {
    this.seed = seed
    this.size = size
    this.biomeRatios = biomeRatios
    this.rng = new SeededRandom(seed)
  }

  /**
   * 生成地圖
   * @returns 生成的二維地圖數組
   */
  generate(): number[][] {
    const newMap: number[][] = Array(this.size)
      .fill(null)
      .map(() => Array(this.size).fill(null))

    // 1. 生成地形特徵的噪聲圖 - 使用更大的比例尺使生態系更聚集
    const elevationNoise: number[][] = Array(this.size)
      .fill(null)
      .map(() => Array(this.size).fill(0))
    const aridityNoise: number[][] = Array(this.size)
      .fill(null)
      .map(() => Array(this.size).fill(0))

    // 2. 創建海洋中心 - 更自然的集中海洋區域
    const oceanCenters: OceanCenter[] = []
    const numOceanCenters: number = Math.max(1, Math.min(3, Math.floor(this.rng.next() * 3) + 1))

    for (let i = 0; i < numOceanCenters; i++) {
      oceanCenters.push({
        x: this.rng.next() * this.size,
        y: this.rng.next() * this.size,
        radius: (0.3 + this.rng.next() * 0.3) * this.size, // 較大半徑
      })
    }

    // 3. 為海拔和乾旱度生成分形噪聲 - 使用更大的比例尺
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        // 檢查是否在海洋中心區域
        let isInOceanZone = false
        for (const center of oceanCenters) {
          const distToCenter = Math.sqrt(Math.pow(x - center.x, 2) + Math.pow(y - center.y, 2))
          if (distToCenter < center.radius) {
            // 在海洋中心區域內的概率隨著距離變化
            const oceanProbability = 0.95 - (distToCenter / center.radius) * 0.7
            if (this.rng.next() < oceanProbability) {
              isInOceanZone = true
              break
            }
          }
        }

        // 生成地形噪音值
        elevationNoise[y][x] = isInOceanZone
          ? this.rng.next() * 0.4 // 海洋區域的海拔較低
          : generateOctaveNoise(
              x,
              y,
              this.rng,
              6, // 更多八度音階以獲得自然海岸線
              0.5,
              this.size / 8, // 更大尺度的特徵 - 從 this.size/12 增加到 this.size/8
            )

        // 第二個噪聲圖用於沙漠分布 - 使用更大尺度
        aridityNoise[y][x] = generateOctaveNoise(
          x + 1000,
          y + 1000,
          this.rng,
          4,
          0.6,
          this.size / 6, // 更大的尺度，從 this.size/8 增加到 this.size/6
        )
      }
    }

    // 4. 根據期望比例確定閾值
    const oceanRatio = this.biomeRatios[BIOMES.OCEAN] / 100
    const desertRatio = this.biomeRatios[BIOMES.DESERT] / 100

    // 5. 平展並排序海拔值以找到閾值
    const sortedElevations: Cell[] = []
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        sortedElevations.push({
          x,
          y,
          elevation: elevationNoise[y][x],
          aridity: aridityNoise[y][x],
        })
      }
    }

    // 按海拔排序（低到高）
    sortedElevations.sort((a, b) => (a.elevation || 0) - (b.elevation || 0))

    // 計算閾值
    const oceanThreshold =
      sortedElevations[Math.floor(sortedElevations.length * oceanRatio)].elevation || 0

    // 6. 基於海拔分配海洋
    let assignedCells = 0
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        if (elevationNoise[y][x] <= oceanThreshold) {
          newMap[y][x] = BIOMES.OCEAN
          assignedCells++
        }
      }
    }

    // 7. 過濾剩餘的陸地單元並按乾旱度排序
    const landCells = sortedElevations.filter((cell) => newMap[cell.y][cell.x] === null)
    landCells.sort((a, b) => (b.aridity || 0) - (a.aridity || 0)) // 高到低乾旱度

    // 8. 將沙漠分配到最乾旱的區域
    const desertCellCount = Math.floor(this.size * this.size * desertRatio)
    for (let i = 0; i < Math.min(desertCellCount, landCells.length); i++) {
      const cell = landCells[i]
      newMap[cell.y][cell.x] = BIOMES.DESERT
      assignedCells++
    }

    // 9. 剩餘單元格成為平原
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        if (newMap[y][x] === null) {
          newMap[y][x] = BIOMES.PLAINS
        }
      }
    }

    // 10. 應用高斯模糊來使生態系統更加聚集
    let smoothedMap = this._applyGaussianBlur(newMap, 3)

    // 11. 連接分散的海洋區域，使海岸線更自然
    smoothedMap = this._connectOceanAreas(smoothedMap)

    // 12. 確保海洋比例達到目標值
    smoothedMap = this._ensureOceanPercentage(smoothedMap, oceanRatio * 100)

    // 13. 生成集中的村莊
    this._generateVillages(smoothedMap)

    return smoothedMap
  }

  /**
   * 應用高斯模糊使生態系更加聚集
   * @param map - 地圖數據
   * @param kernelSize - 模糊核心大小
   * @returns 模糊後的地圖
   * @private
   */
  private _applyGaussianBlur(map: number[][], kernelSize: number = 3): number[][] {
    // 為了保持生物群落的整數標識，我們需要將其轉換為可模糊的格式
    const width = map.length
    const height = map[0].length

    // 建立三個二維陣列，每個對應一個生物群落（不包括村莊）
    const oceanMap: number[][] = Array(width)
      .fill(null)
      .map(() => Array(height).fill(0))
    const desertMap: number[][] = Array(width)
      .fill(null)
      .map(() => Array(height).fill(0))
    const plainsMap: number[][] = Array(width)
      .fill(null)
      .map(() => Array(height).fill(0))
    const villageMap: number[][] = Array(width)
      .fill(null)
      .map(() => Array(height).fill(0))

    // 分離生物群落到各自的陣列
    for (let y = 0; y < width; y++) {
      for (let x = 0; x < height; x++) {
        switch (map[y][x]) {
          case BIOMES.OCEAN:
            oceanMap[y][x] = 1
            break
          case BIOMES.DESERT:
            desertMap[y][x] = 1
            break
          case BIOMES.PLAINS:
            plainsMap[y][x] = 1
            break
          case BIOMES.VILLAGE:
            villageMap[y][x] = 1
            break
        }
      }
    }

    // 對各生物群落分別應用模糊（除了村莊）
    const blurredOcean = applyGaussianBlur(oceanMap, kernelSize)
    const blurredDesert = applyGaussianBlur(desertMap, kernelSize)
    const blurredPlains = applyGaussianBlur(plainsMap, kernelSize)

    // 建立新的地圖，根據最高值決定每個格子的生物群落
    const newMap: number[][] = Array(width)
      .fill(null)
      .map(() => Array(height).fill(0))

    for (let y = 0; y < width; y++) {
      for (let x = 0; x < height; x++) {
        // 保留村莊不變
        if (villageMap[y][x] === 1) {
          newMap[y][x] = BIOMES.VILLAGE
          continue
        }

        // 比較三個生物群落的值，選擇最高的
        const values = [
          { biome: BIOMES.PLAINS, value: blurredPlains[y][x] },
          { biome: BIOMES.DESERT, value: blurredDesert[y][x] },
          { biome: BIOMES.OCEAN, value: blurredOcean[y][x] },
        ]

        values.sort((a, b) => b.value - a.value)
        newMap[y][x] = values[0].biome
      }
    }

    return newMap
  }

  /**
   * 連接分散的海洋區域，使海岸線更自然
   * @param map - 地圖數據
   * @returns 連接後的地圖
   * @private
   */
  private _connectOceanAreas(map: number[][]): number[][] {
    const mapCopy: number[][] = JSON.parse(JSON.stringify(map))
    const width = map[0].length
    const height = map.length

    // 找出所有海洋區塊
    const oceanCells: Cell[] = []
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (mapCopy[y][x] === BIOMES.OCEAN) {
          oceanCells.push({ x, y })
        }
      }
    }

    // 如果海洋區塊太少，不需要連接
    if (oceanCells.length < 5) return mapCopy

    // 隨機選擇幾個海洋區塊作為連接點
    const connectPoints: Cell[] = []
    const numConnectPoints = Math.min(oceanCells.length, 10)

    // 確保選擇分散的點
    for (let i = 0; i < numConnectPoints; i++) {
      const randomIndex = Math.floor(this.rng.next() * oceanCells.length)
      connectPoints.push(oceanCells[randomIndex])
      oceanCells.splice(randomIndex, 1)
    }

    // 連接點
    for (let i = 0; i < connectPoints.length - 1; i++) {
      const start = connectPoints[i]
      const end = connectPoints[i + 1]

      // 使用簡單的線段連接
      const dx = end.x - start.x
      const dy = end.y - start.y
      const steps = Math.max(Math.abs(dx), Math.abs(dy))

      for (let step = 0; step <= steps; step++) {
        const t = steps === 0 ? 0 : step / steps
        const x = Math.round(start.x + dx * t)
        const y = Math.round(start.y + dy * t)

        if (x >= 0 && x < width && y >= 0 && y < height) {
          // 連接線略微擴散，使連接看起來更自然
          const spreadRadius = 1 + Math.floor(this.rng.next() * 2)
          for (let sy = -spreadRadius; sy <= spreadRadius; sy++) {
            for (let sx = -spreadRadius; sx <= spreadRadius; sx++) {
              const nx = x + sx
              const ny = y + sy
              if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                // 有80%機率變成海洋
                if (this.rng.next() < 0.8 && mapCopy[ny][nx] !== BIOMES.VILLAGE) {
                  mapCopy[ny][nx] = BIOMES.OCEAN
                }
              }
            }
          }
        }
      }
    }

    return mapCopy
  }

  /**
   * 確保海洋比例達到目標值
   * @param map - 地圖數據
   * @param targetPercentage - 目標海洋百分比
   * @returns 調整後的地圖
   * @private
   */
  private _ensureOceanPercentage(map: number[][], targetPercentage: number = 30): number[][] {
    const mapCopy: number[][] = JSON.parse(JSON.stringify(map))

    // 計算當前海洋比例
    const biomePercentages = MapGenerator.calculateBiomePercentage(mapCopy)
    let currentOceanPercentage = parseFloat(biomePercentages[BIOMES.OCEAN])

    // 如果海洋比例已經達到目標，直接返回
    if (currentOceanPercentage >= targetPercentage) {
      return mapCopy
    }

    // 計算需要轉換的陸地格子數量
    const totalCells = map.length * map[0].length
    const targetOceanCells = Math.ceil((totalCells * targetPercentage) / 100)
    const currentOceanCells = Math.ceil((totalCells * currentOceanPercentage) / 100)
    const cellsToConvert = targetOceanCells - currentOceanCells

    // 檢查是否是大陸邊緣（靠近海洋的陸地）
    const isContinentEdge = (map: number[][], x: number, y: number): boolean => {
      const dirs = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ]
      if (map[y][x] === BIOMES.OCEAN) return false

      for (const [dx, dy] of dirs) {
        const nx = x + dx
        const ny = y + dy
        if (nx >= 0 && nx < map[0].length && ny >= 0 && ny < map.length) {
          if (map[ny][nx] === BIOMES.OCEAN) return true
        }
      }
      return false
    }

    // 優先轉換大陸邊緣區域，保持海洋的連續性
    const edgeCells: Cell[] = []
    const inlandCells: Cell[] = []

    for (let y = 0; y < map.length; y++) {
      for (let x = 0; x < map[0].length; x++) {
        if (mapCopy[y][x] !== BIOMES.OCEAN && mapCopy[y][x] !== BIOMES.VILLAGE) {
          if (isContinentEdge(mapCopy, x, y)) {
            edgeCells.push({ x, y })
          } else {
            inlandCells.push({ x, y })
          }
        }
      }
    }

    // 隨機打亂邊緣格子，使轉換更自然
    edgeCells.sort(() => this.rng.next() - 0.5)

    // 先轉換邊緣格子
    let converted = 0
    for (let i = 0; i < edgeCells.length && converted < cellsToConvert; i++) {
      const { x, y } = edgeCells[i]
      mapCopy[y][x] = BIOMES.OCEAN
      converted++
    }

    // 如果邊緣格子不夠，轉換內陸格子
    if (converted < cellsToConvert) {
      // 基於距離邊緣的遠近排序內陸格子
      const minDistanceToOcean = (map: number[][], x: number, y: number): number => {
        let minDist = Number.MAX_VALUE

        // 使用曼哈頓距離來優化計算
        let found = false
        let radius = 1
        const maxRadius = Math.max(map.length, map[0].length)

        while (!found && radius < maxRadius) {
          for (let dy = -radius; dy <= radius && !found; dy++) {
            for (let dx = -radius; dx <= radius && !found; dx++) {
              if (Math.abs(dx) + Math.abs(dy) === radius) {
                // 只檢查當前半徑的邊緣
                const nx = x + dx
                const ny = y + dy
                if (nx >= 0 && nx < map[0].length && ny >= 0 && ny < map.length) {
                  if (map[ny][nx] === BIOMES.OCEAN) {
                    minDist = radius
                    found = true
                    break
                  }
                }
              }
            }
          }
          radius++
        }

        return minDist
      }

      // 計算所有內陸格子到海洋的距離
      for (let i = 0; i < inlandCells.length; i++) {
        inlandCells[i].dist = minDistanceToOcean(mapCopy, inlandCells[i].x, inlandCells[i].y)
      }

      // 按照到海洋的距離排序
      inlandCells.sort((a, b) => (a.dist || 0) - (b.dist || 0))

      for (let i = 0; i < inlandCells.length && converted < cellsToConvert; i++) {
        const { x, y } = inlandCells[i]
        mapCopy[y][x] = BIOMES.OCEAN
        converted++
      }
    }

    return mapCopy
  }

  /**
   * 生成村莊
   * @param map - 地圖數據
   * @private
   */
  private _generateVillages(map: number[][]): void {
    // 查找平原和沙漠單元格作為可能的村莊位置
    const possibleVillageCells: Cell[] = []
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        if (map[y][x] === BIOMES.PLAINS || map[y][x] === BIOMES.DESERT) {
          possibleVillageCells.push({ x, y, biome: map[y][x] })
        }
      }
    }

    // 計算要創建的村莊數量（基於比例）
    const villageRatio = this.biomeRatios[BIOMES.VILLAGE] / 100
    const targetVillageCells = Math.floor(this.size * this.size * villageRatio)

    // 創建少量高度集中的村莊聚落而非分散的村莊
    // 聚落數量取決於地圖大小和村莊比例
    const numClusters = Math.max(1, Math.min(3, Math.ceil(villageRatio * 20)))
    let placedVillages = 0

    for (let cluster = 0; cluster < numClusters && placedVillages < targetVillageCells; cluster++) {
      // 選擇一個隨機平原或沙漠單元格作為村莊種子
      if (possibleVillageCells.length === 0) break

      const seedIndex = Math.floor(this.rng.next() * possibleVillageCells.length)
      const seed = possibleVillageCells[seedIndex]

      // 從可用的潛在村莊單元格中移除此單元格
      possibleVillageCells.splice(seedIndex, 1)

      // 檢查此位置是否有足夠的平地（不靠近海洋）
      let hasEnoughSpace = true
      const villageSize = 3

      for (let dy = -villageSize; dy <= villageSize && hasEnoughSpace; dy++) {
        for (let dx = -villageSize; dx <= villageSize && hasEnoughSpace; dx++) {
          const nx = seed.x + dx
          const ny = seed.y + dy

          if (nx >= 0 && nx < this.size && ny >= 0 && ny < this.size) {
            if (map[ny][nx] === BIOMES.OCEAN) {
              hasEnoughSpace = false
            }
          }
        }
      }

      if (!hasEnoughSpace) continue

      // 標記為村莊並從此單元格開始擴展
      map[seed.y][seed.x] = BIOMES.VILLAGE
      placedVillages++

      // 使用廣度優先增長將村莊擴展為緊密的聚落
      const queue: Cell[] = [seed]
      const villageCells: Cell[] = [seed]

      // 計算此聚落的目標大小
      const targetClusterSize = Math.ceil(targetVillageCells / numClusters)

      while (
        queue.length > 0 &&
        placedVillages < targetVillageCells &&
        villageCells.length < targetClusterSize
      ) {
        const current = queue.shift() as Cell

        // 檢查相鄰單元格（8方向連接，包括對角線）
        const directions = [
          [-1, -1],
          [-1, 0],
          [-1, 1],
          [0, -1],
          [0, 1],
          [1, -1],
          [1, 0],
          [1, 1],
        ]
        // 隨機打亂方向以獲得更自然的生長
        for (let i = directions.length - 1; i > 0; i--) {
          const j = Math.floor(this.rng.next() * (i + 1))
          ;[directions[i], directions[j]] = [directions[j], directions[i]]
        }

        for (const [dx, dy] of directions) {
          const nx = current.x + dx
          const ny = current.y + dy

          // 檢查這是否是有效的平原或沙漠單元格
          if (
            nx >= 0 &&
            nx < this.size &&
            ny >= 0 &&
            ny < this.size &&
            (map[ny][nx] === BIOMES.PLAINS || map[ny][nx] === BIOMES.DESERT)
          ) {
            // 越靠近中心擴展概率越高 = 更緊密的聚落
            const distanceFromSeed = Math.sqrt(Math.pow(nx - seed.x, 2) + Math.pow(ny - seed.y, 2))
            const growthProbability = 0.9 - distanceFromSeed / (this.size * 0.1)

            if (this.rng.next() < growthProbability) {
              map[ny][nx] = BIOMES.VILLAGE
              placedVillages++
              villageCells.push({ x: nx, y: ny })
              queue.push({ x: nx, y: ny })

              // 同時從可用潛在村莊單元格中移除
              const cellIndex = possibleVillageCells.findIndex(
                (cell) => cell.x === nx && cell.y === ny,
              )
              if (cellIndex !== -1) {
                possibleVillageCells.splice(cellIndex, 1)
              }

              if (
                placedVillages >= targetVillageCells ||
                villageCells.length >= targetClusterSize
              ) {
                break
              }
            }
          }
        }
      }
    }

    // 如果我們沒有放置足夠的村莊，選擇一些隨機潛在村莊單元格
    if (placedVillages < targetVillageCells && possibleVillageCells.length > 0) {
      possibleVillageCells.sort(() => this.rng.next() - 0.5) // 隨機排序

      for (let i = 0; i < possibleVillageCells.length && placedVillages < targetVillageCells; i++) {
        const cell = possibleVillageCells[i]
        map[cell.y][cell.x] = BIOMES.VILLAGE
        placedVillages++
      }
    }
  }

  /**
   * 計算地圖中各生態域的百分比
   * @param mapData - 地圖數據
   * @returns 生態域百分比
   */
  static calculateBiomePercentage(mapData: number[][]): BiomePercentages {
    const totalCells = mapData.length * mapData[0].length
    const biomeCounts: { [key: number]: number } = {}
    Object.values(BIOMES).forEach((biomeType) => {
      biomeCounts[biomeType] = 0
    })
    for (let y = 0; y < mapData.length; y++) {
      for (let x = 0; x < mapData[0].length; x++) {
        biomeCounts[mapData[y][x]]++
      }
    }
    const biomePercentages: BiomePercentages = {}
    Object.keys(biomeCounts).forEach((biomeType) => {
      biomePercentages[Number(biomeType)] = (
        (biomeCounts[Number(biomeType)] / totalCells) *
        100
      ).toFixed(1)
    })
    return biomePercentages
  }

  /**
   * 生成隨機種子
   * @returns 10位數字的種子
   */
  static generateRandomSeed(): string {
    return String(Math.floor(1000000000 + Math.random() * 9000000000))
  }
}
