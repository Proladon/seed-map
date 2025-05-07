<template>
  <div class="map-generator">
    <h2>種子地圖生成器</h2>
    <BiomeRatioEditor :ratios="biomeRatios" @update:ratios="updateRatios" />
    <div class="controls">
      <label
        >種子碼：
        <input v-model="seedInput" maxlength="10" pattern="\\d{10}" />
      </label>
      <button @click="generateRandomSeed">隨機產生</button>
      <label
        >地圖尺寸：
        <select v-model.number="pendingSize">
          <option v-for="s in sizes" :key="s" :value="s">
            {{ s }} x {{ s }}
          </option>
        </select>
      </label>
      <button @click="generateMap" :disabled="isGenerating">
        {{ isGenerating ? "生成中..." : "生成地圖" }}
      </button>
    </div>
    <MapPreview
      :map="map"
      :size="size"
      :biomeColors="BIOME_COLORS"
      :biomes="BIOMES"
      :calculateBiomePercentage="calculateBiomePercentage"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue"
import MapPreview from "./MapPreview.vue"
import BiomeRatioEditor from "./BiomeRatioEditor.vue"
import { BIOMES, BIOME_COLORS } from "../config/biome"

const seedInput = ref("1234567890")
const size = ref(50)
const pendingSize = ref(size.value)
const sizes = [20, 50, 100, 200]
const map = ref([])
const isGenerating = ref(false)
const biomeRatios = ref({
  [BIOMES.OCEAN]: 30,
  [BIOMES.PLAINS]: 40,
  [BIOMES.DESERT]: 25,
  [BIOMES.VILLAGE]: 5,
})

function updateRatios(newRatios) {
  biomeRatios.value = { ...newRatios }
}

class SeededRandom {
  constructor(seed) {
    this.seed = seed % 2147483647
    if (this.seed <= 0) this.seed += 2147483646
  }
  next() {
    this.seed = (this.seed * 16807) % 2147483647
    return this.seed / 2147483647
  }
  nextInt(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min
  }
}

function generateSimplexNoise(x, y, rng, scale = 1) {
  const xPrime = x + rng.next() * 0.2
  const yPrime = y + rng.next() * 0.2
  const hash =
    Math.sin(xPrime * 12.9898 * scale + yPrime * 78.233 * scale) * 43758.5453
  return hash - Math.floor(hash)
}

function generateOctaveNoise(
  x,
  y,
  rng,
  octaves = 1,
  persistence = 0.5,
  scale = 1
) {
  let total = 0
  let frequency = 1
  let amplitude = 1
  let maxValue = 0
  for (let i = 0; i < octaves; i++) {
    const offsetX = rng.next() * 1000
    const offsetY = rng.next() * 1000
    total +=
      generateSimplexNoise(
        ((x + offsetX) * frequency) / scale,
        ((y + offsetY) * frequency) / scale,
        rng
      ) * amplitude
    maxValue += amplitude
    amplitude *= persistence
    frequency *= 2
  }
  return total / maxValue
}

function applyGaussianBlur(map, kernelSize = 3) {
  const blurredMap = Array(map.length)
    .fill()
    .map(() => Array(map[0].length).fill(0))
  const halfKernel = Math.floor(kernelSize / 2)
  function generateGaussianKernel(size, sigma = 1) {
    const kernel = []
    const center = Math.floor(size / 2)
    let sum = 0
    for (let y = 0; y < size; y++) {
      kernel[y] = []
      for (let x = 0; x < size; x++) {
        const distance = Math.sqrt(
          Math.pow(x - center, 2) + Math.pow(y - center, 2)
        )
        const value = Math.exp(-(distance * distance) / (2 * sigma * sigma))
        kernel[y][x] = value
        sum += value
      }
    }
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        kernel[y][x] /= sum
      }
    }
    return kernel
  }
  const kernel = generateGaussianKernel(kernelSize)
  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[0].length; x++) {
      let r = 0,
        weightSum = 0
      for (let ky = -halfKernel; ky <= halfKernel; ky++) {
        for (let kx = -halfKernel; kx <= halfKernel; kx++) {
          const nx = x + kx
          const ny = y + ky
          if (nx >= 0 && nx < map[0].length && ny >= 0 && ny < map.length) {
            const weight = kernel[ky + halfKernel][kx + halfKernel]
            weightSum += weight
            r += map[ny][nx] * weight
          }
        }
      }
      blurredMap[y][x] = Math.round(r / weightSum)
    }
  }
  return blurredMap
}

function generateRandomSeed() {
  seedInput.value = String(Math.floor(1000000000 + Math.random() * 9000000000))
}

function calculateBiomePercentage(mapData) {
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

function minDistanceToOcean(map, x, y) {
  let minDist = Number.MAX_VALUE
  for (let ny = 0; ny < map.length; ny++) {
    for (let nx = 0; nx < map[0].length; nx++) {
      if (map[ny][nx] === BIOMES.OCEAN) {
        const dist = Math.sqrt(Math.pow(x - nx, 2) + Math.pow(y - ny, 2))
        minDist = Math.min(minDist, dist)
      }
    }
  }
  return minDist
}

function isContinentEdge(map, x, y) {
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

function ensureOceanPercentage(mapData, targetPercentage = 30) {
  const mapCopy = JSON.parse(JSON.stringify(mapData))
  const biomePercentages = calculateBiomePercentage(mapCopy)
  let currentOceanPercentage = parseFloat(biomePercentages[BIOMES.OCEAN])
  if (currentOceanPercentage >= targetPercentage) return mapCopy
  const totalCells = mapData.length * mapData[0].length
  const targetOceanCells = Math.ceil((totalCells * targetPercentage) / 100)
  const currentOceanCells = Math.ceil(
    (totalCells * currentOceanPercentage) / 100
  )
  const cellsToConvert = targetOceanCells - currentOceanCells
  const edgeCells = []
  const inlandCells = []
  for (let y = 0; y < mapData.length; y++) {
    for (let x = 0; x < mapData[0].length; x++) {
      if (mapCopy[y][x] !== BIOMES.OCEAN && mapCopy[y][x] !== BIOMES.VILLAGE) {
        if (isContinentEdge(mapCopy, x, y)) edgeCells.push({ x, y })
        else inlandCells.push({ x, y })
      }
    }
  }
  edgeCells.sort(() => Math.random() - 0.5)
  let converted = 0
  for (let i = 0; i < edgeCells.length && converted < cellsToConvert; i++) {
    const { x, y } = edgeCells[i]
    mapCopy[y][x] = BIOMES.OCEAN
    converted++
  }
  if (converted < cellsToConvert) {
    inlandCells.sort((a, b) => {
      const distA = minDistanceToOcean(mapCopy, a.x, a.y)
      const distB = minDistanceToOcean(mapCopy, b.x, b.y)
      return distA - distB
    })
    for (let i = 0; i < inlandCells.length && converted < cellsToConvert; i++) {
      const { x, y } = inlandCells[i]
      mapCopy[y][x] = BIOMES.OCEAN
      converted++
    }
  }
  return mapCopy
}

function generateMap() {
  size.value = pendingSize.value
  if (!seedInput.value || isNaN(parseInt(seedInput.value))) {
    alert("請輸入有效的數字種子")
    return
  }
  isGenerating.value = true
  const seedNumber = parseInt(seedInput.value) || 0
  const rng = new SeededRandom(seedNumber)
  const ratios = biomeRatios.value
  // 計算各生態域的累積分布
  const total = Object.values(ratios).reduce((a, b) => a + Number(b), 0)
  const thresholds = [
    { type: BIOMES.OCEAN, max: ratios[BIOMES.OCEAN] / total },
    {
      type: BIOMES.DESERT,
      max: (ratios[BIOMES.OCEAN] + ratios[BIOMES.DESERT]) / total,
    },
    {
      type: BIOMES.PLAINS,
      max:
        (ratios[BIOMES.OCEAN] + ratios[BIOMES.DESERT] + ratios[BIOMES.PLAINS]) /
        total,
    },
    { type: BIOMES.VILLAGE, max: 1 },
  ]
  const newMap = Array(size.value)
    .fill()
    .map(() => Array(size.value).fill(0))
  for (let y = 0; y < size.value; y++) {
    for (let x = 0; x < size.value; x++) {
      const noise = generateOctaveNoise(x, y, rng, 4, 0.5, 25)
      let biome = BIOMES.PLAINS
      for (const t of thresholds) {
        if (noise <= t.max) {
          biome = t.type
          break
        }
      }
      newMap[y][x] = biome
    }
  }
  // 村莊分布（只在非海洋格子）
  for (let y = 0; y < size.value; y++) {
    for (let x = 0; x < size.value; x++) {
      if (newMap[y][x] !== BIOMES.OCEAN) {
        const villageNoise = generateSimplexNoise(
          x / 10 + 2000,
          y / 10 + 2000,
          rng
        )
        if (villageNoise > 0.97 && ratios[BIOMES.VILLAGE] > 0) {
          newMap[y][x] = BIOMES.VILLAGE
        }
      }
    }
  }
  map.value = newMap
  isGenerating.value = false
  if (mapPreviewRef.value && mapPreviewRef.value.redraw) {
    mapPreviewRef.value.redraw()
  }
}
</script>

<style scoped>
.map-generator {
  margin: 2em auto;
  max-width: 700px;
  text-align: left;
}
.controls {
  margin-bottom: 1em;
  display: flex;
  flex-direction: column;
  gap: 1em;
  flex-wrap: wrap;
}
input[type="text"],
select {
  margin-left: 0.5em;
}
</style>
