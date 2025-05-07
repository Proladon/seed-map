import SeededRandom from "./SeededRandom"
import { generateOctaveNoise } from "./NoiseGenerator"
import { BIOMES } from "../config/biome"

/**
 * 地圖生成器類
 * 負責根據種子和參數生成地圖
 */
export default class MapGenerator {
  /**
   * 構造函數
   * @param {number} seed - 地圖種子
   * @param {number} size - 地圖尺寸
   * @param {Object} biomeRatios - 生態域比例
   */
  constructor(seed, size, biomeRatios) {
    this.seed = seed
    this.size = size
    this.biomeRatios = biomeRatios
    this.rng = new SeededRandom(seed)
  }

  /**
   * 生成地圖
   * @returns {Array<Array<number>>} 生成的二維地圖數組
   */
  generate() {
    const newMap = Array(this.size)
      .fill()
      .map(() => Array(this.size).fill(null))

    // 1. 生成地形特徵的噪聲圖
    const elevationNoise = Array(this.size)
      .fill()
      .map(() => Array(this.size).fill(0))
    const aridityNoise = Array(this.size)
      .fill()
      .map(() => Array(this.size).fill(0))

    // 為海拔生成分形噪聲（用於海洋） - 更多的八度音階以獲得自然海岸線
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        elevationNoise[y][x] = generateOctaveNoise(
          x,
          y,
          this.rng,
          6, // 更多八度音階以獲得自然海岸線
          0.5,
          this.size / 12 // 更大尺度的特徵
        )

        // 第二個噪聲圖用於沙漠分布
        aridityNoise[y][x] = generateOctaveNoise(
          x + 1000,
          y + 1000,
          this.rng,
          4,
          0.6,
          this.size / 8
        )
      }
    }

    // 2. 根據期望比例確定閾值
    const oceanRatio = this.biomeRatios[BIOMES.OCEAN] / 100
    const desertRatio = this.biomeRatios[BIOMES.DESERT] / 100

    // 平展並排序海拔值以找到閾值
    const sortedElevations = []
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
    sortedElevations.sort((a, b) => a.elevation - b.elevation)

    // 計算閾值
    const oceanThreshold =
      sortedElevations[Math.floor(sortedElevations.length * oceanRatio)]
        .elevation

    // 3. 基於海拔分配海洋
    let assignedCells = 0
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        if (elevationNoise[y][x] <= oceanThreshold) {
          newMap[y][x] = BIOMES.OCEAN
          assignedCells++
        }
      }
    }

    // 4. 過濾剩餘的陸地單元並按乾旱度排序
    const landCells = sortedElevations.filter(
      (cell) => newMap[cell.y][cell.x] === null
    )
    landCells.sort((a, b) => b.aridity - a.aridity) // 高到低乾旱度

    // 5. 將沙漠分配到最乾旱的區域
    const desertCellCount = Math.floor(this.size * this.size * desertRatio)
    for (let i = 0; i < Math.min(desertCellCount, landCells.length); i++) {
      const cell = landCells[i]
      newMap[cell.y][cell.x] = BIOMES.DESERT
      assignedCells++
    }

    // 6. 剩餘單元格成為平原
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        if (newMap[y][x] === null) {
          newMap[y][x] = BIOMES.PLAINS
        }
      }
    }

    // 7. 生成集中的村莊
    this._generateVillages(newMap)

    return newMap
  }

  /**
   * 生成村莊
   * @param {Array<Array<number>>} map - 地圖數據
   * @private
   */
  _generateVillages(map) {
    // 查找平原單元格
    const plainsCells = []
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        if (map[y][x] === BIOMES.PLAINS) {
          plainsCells.push({ x, y })
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

    for (
      let cluster = 0;
      cluster < numClusters && placedVillages < targetVillageCells;
      cluster++
    ) {
      // 選擇一個隨機平原單元格作為村莊種子
      if (plainsCells.length === 0) break

      const seedIndex = Math.floor(this.rng.next() * plainsCells.length)
      const seed = plainsCells[seedIndex]

      // 從可用平原中移除此單元格
      plainsCells.splice(seedIndex, 1)

      if (map[seed.y][seed.x] !== BIOMES.PLAINS) continue

      // 標記為村莊並從此單元格開始擴展
      map[seed.y][seed.x] = BIOMES.VILLAGE
      placedVillages++

      // 使用廣度優先增長將村莊擴展為緊密的聚落
      const queue = [seed]
      const villageCells = [seed]

      // 計算此聚落的目標大小
      const targetClusterSize = Math.ceil(targetVillageCells / numClusters)

      while (
        queue.length > 0 &&
        placedVillages < targetVillageCells &&
        villageCells.length < targetClusterSize
      ) {
        const current = queue.shift()

        // 檢查相鄰單元格（4方向連接）
        const directions = [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ]
        // 隨機打亂方向以獲得更自然的生長
        for (let i = directions.length - 1; i > 0; i--) {
          const j = Math.floor(this.rng.next() * (i + 1))
          ;[directions[i], directions[j]] = [directions[j], directions[i]]
        }

        for (const [dx, dy] of directions) {
          const nx = current.x + dx
          const ny = current.y + dy

          // 檢查這是否是有效的平原單元格
          if (
            nx >= 0 &&
            nx < this.size &&
            ny >= 0 &&
            ny < this.size &&
            map[ny][nx] === BIOMES.PLAINS
          ) {
            // 越靠近中心擴展概率越高 = 更緊密的聚落
            const distanceFromSeed = Math.sqrt(
              Math.pow(nx - seed.x, 2) + Math.pow(ny - seed.y, 2)
            )
            const growthProbability =
              0.95 - distanceFromSeed / (this.size * 0.05)

            if (this.rng.next() < growthProbability) {
              map[ny][nx] = BIOMES.VILLAGE
              placedVillages++
              villageCells.push({ x: nx, y: ny })
              queue.push({ x: nx, y: ny })

              // 同時從可用平原中移除
              const plainIndex = plainsCells.findIndex(
                (cell) => cell.x === nx && cell.y === ny
              )
              if (plainIndex !== -1) {
                plainsCells.splice(plainIndex, 1)
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

    // 如果我們沒有放置足夠的村莊，選擇一些隨機平原單元格
    // （但使用聚落方法應該很少需要這樣做）
    if (placedVillages < targetVillageCells && plainsCells.length > 0) {
      plainsCells.sort(() => this.rng.next() - 0.5) // 隨機排序

      for (
        let i = 0;
        i < plainsCells.length && placedVillages < targetVillageCells;
        i++
      ) {
        const cell = plainsCells[i]
        if (map[cell.y][cell.x] === BIOMES.PLAINS) {
          map[cell.y][cell.x] = BIOMES.VILLAGE
          placedVillages++
        }
      }
    }
  }

  /**
   * 計算地圖中各生態域的百分比
   * @param {Array<Array<number>>} mapData - 地圖數據
   * @returns {Object} 生態域百分比
   */
  static calculateBiomePercentage(mapData) {
    const totalCells = mapData.length * mapData[0].length
    const biomeCounts = {}
    Object.values(BIOMES).forEach((biomeType) => {
      biomeCounts[biomeType] = 0
    })
    for (let y = 0; y < mapData.length; y++) {
      for (let x = 0; x < mapData[0].length; x++) {
        biomeCounts[mapData[y][x]]++
      }
    }
    const biomePercentages = {}
    Object.keys(biomeCounts).forEach((biomeType) => {
      biomePercentages[biomeType] = (
        (biomeCounts[biomeType] / totalCells) *
        100
      ).toFixed(1)
    })
    return biomePercentages
  }

  /**
   * 生成隨機種子
   * @returns {string} 10位數字的種子
   */
  static generateRandomSeed() {
    return String(Math.floor(1000000000 + Math.random() * 9000000000))
  }
}
