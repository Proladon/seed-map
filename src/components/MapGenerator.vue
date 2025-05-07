<template>
  <div class="map-generator">
    <h2>Minecraft 風格種子地圖生成器</h2>
    <div class="controls">
      <label>種子碼：
        <input v-model="seedInput" maxlength="10" pattern="\\d{10}" />
      </label>
      <button @click="generateRandomSeed">隨機產生</button>
      <label>地圖尺寸：
        <select v-model.number="size">
          <option v-for="s in sizes" :key="s" :value="s">{{ s }} x {{ s }}</option>
        </select>
      </label>
      <button @click="generateMap" :disabled="isGenerating">{{ isGenerating ? '生成中...' : '生成地圖' }}</button>
    </div>
    <div class="legend">
      <span v-for="(value, name) in BIOMES" :key="name" class="legend-item">
        <span class="legend-color" :style="{ background: BIOME_COLORS[value] }"></span>
        <span>{{ name === 'PLAINS' ? '平原' : name === 'DESERT' ? '沙漠' : name === 'OCEAN' ? '海洋' : name === 'VILLAGE' ? '村莊' : name }}</span>
      </span>
    </div>
    <canvas ref="canvasRef" class="map-canvas"></canvas>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

// 生態域常數
const BIOMES = {
  PLAINS: 0,
  DESERT: 1,
  OCEAN: 2,
  VILLAGE: 3,
}

const BIOME_COLORS = {
  [BIOMES.PLAINS]: '#7CFC00',
  [BIOMES.DESERT]: '#F4A460',
  [BIOMES.OCEAN]: '#1E90FF',
  [BIOMES.VILLAGE]: '#FF6347',
}

const seedInput = ref('1234567890')
const size = ref(50)
const sizes = [20, 50, 100, 200]
const map = ref([])
const isGenerating = ref(false)
const canvasRef = ref(null)

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
  const hash = Math.sin(xPrime * 12.9898 * scale + yPrime * 78.233 * scale) * 43758.5453
  return hash - Math.floor(hash)
}

function generateOctaveNoise(x, y, rng, octaves = 1, persistence = 0.5, scale = 1) {
  let total = 0
  let frequency = 1
  let amplitude = 1
  let maxValue = 0
  for (let i = 0; i < octaves; i++) {
    const offsetX = rng.next() * 1000
    const offsetY = rng.next() * 1000
    total += generateSimplexNoise((x + offsetX) * frequency / scale, (y + offsetY) * frequency / scale, rng) * amplitude
    maxValue += amplitude
    amplitude *= persistence
    frequency *= 2
  }
  return total / maxValue
}

function applyGaussianBlur(map, kernelSize = 3) {
  const blurredMap = Array(map.length).fill().map(() => Array(map[0].length).fill(0))
  const halfKernel = Math.floor(kernelSize / 2)
  function generateGaussianKernel(size, sigma = 1) {
    const kernel = []
    const center = Math.floor(size / 2)
    let sum = 0
    for (let y = 0; y < size; y++) {
      kernel[y] = []
      for (let x = 0; x < size; x++) {
        const distance = Math.sqrt(Math.pow(x - center, 2) + Math.pow(y - center, 2))
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
      let r = 0, weightSum = 0
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
  Object.values(BIOMES).forEach(biomeType => { biomeCounts[biomeType] = 0 })
  for (let y = 0; y < mapData.length; y++) {
    for (let x = 0; x < mapData[0].length; x++) {
      biomeCounts[mapData[y][x]]++
    }
  }
  const biomePercentages = {}
  Object.keys(biomeCounts).forEach(biomeType => {
    biomePercentages[biomeType] = (biomeCounts[biomeType] / totalCells * 100).toFixed(1)
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
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]]
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
  const targetOceanCells = Math.ceil(totalCells * targetPercentage / 100)
  const currentOceanCells = Math.ceil(totalCells * currentOceanPercentage / 100)
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

function drawMap(mapData) {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  const cellSize = Math.min(10, 400 / size.value)
  canvas.width = size.value * cellSize
  canvas.height = size.value * cellSize
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  for (let y = 0; y < size.value; y++) {
    for (let x = 0; x < size.value; x++) {
      const biome = mapData[y][x]
      ctx.fillStyle = BIOME_COLORS[biome]
      ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize)
    }
  }
}

function generateMap() {
  if (!seedInput.value || isNaN(parseInt(seedInput.value))) {
    alert('請輸入有效的數字種子')
    return
  }
  isGenerating.value = true
  const seedNumber = parseInt(seedInput.value) || 0
  const rng = new SeededRandom(seedNumber)
  const newMap = Array(size.value).fill().map(() => Array(size.value).fill(0))
  const oceanCenters = []
  const numOceanCenters = rng.nextInt(1, 3)
  for (let i = 0; i < numOceanCenters; i++) {
    oceanCenters.push({
      x: rng.next() * size.value,
      y: rng.next() * size.value,
      radius: (0.3 + rng.next() * 0.3) * size.value
    })
  }
  for (let y = 0; y < size.value; y++) {
    for (let x = 0; x < size.value; x++) {
      const elevation = generateOctaveNoise(x, y, rng, 4, 0.5, 25)
      const moisture = generateOctaveNoise(x, y, rng, 3, 0.5, 40)
      let isInOceanZone = false
      for (const center of oceanCenters) {
        const distToCenter = Math.sqrt(Math.pow(x - center.x, 2) + Math.pow(y - center.y, 2))
        if (distToCenter < center.radius) {
          const oceanProbability = 0.95 - (distToCenter / center.radius) * 0.7
          if (rng.next() < oceanProbability) {
            isInOceanZone = true
            break
          }
        }
      }
      if (isInOceanZone || elevation < 0.4) {
        newMap[y][x] = BIOMES.OCEAN
      } else if (moisture < 0.45) {
        newMap[y][x] = BIOMES.DESERT
      } else {
        newMap[y][x] = BIOMES.PLAINS
      }
    }
  }
  const smoothedMap = applyGaussianBlur(newMap, 5)
  for (let y = 0; y < size.value; y++) {
    for (let x = 0; x < size.value; x++) {
      if ((smoothedMap[y][x] === BIOMES.PLAINS || smoothedMap[y][x] === BIOMES.DESERT)) {
        const villageNoise = generateSimplexNoise(x / 10 + 2000, y / 10 + 2000, rng)
        if (villageNoise > 0.95) {
          let hasEnoughSpace = true
          const villageSize = 3
          for (let dy = -villageSize; dy <= villageSize && hasEnoughSpace; dy++) {
            for (let dx = -villageSize; dx <= villageSize && hasEnoughSpace; dx++) {
              const nx = x + dx
              const ny = y + dy
              if (nx >= 0 && nx < size.value && ny >= 0 && ny < size.value) {
                if (smoothedMap[ny][nx] === BIOMES.OCEAN) {
                  hasEnoughSpace = false
                }
              }
            }
          }
          if (hasEnoughSpace) {
            smoothedMap[y][x] = BIOMES.VILLAGE
            const villageRadius = rng.nextInt(1, 2)
            for (let dy = -villageRadius; dy <= villageRadius; dy++) {
              for (let dx = -villageRadius; dx <= villageRadius; dx++) {
                if (dx === 0 && dy === 0) continue
                const nx = x + dx
                const ny = y + dy
                if (nx >= 0 && nx < size.value && ny >= 0 && ny < size.value && smoothedMap[ny][nx] !== BIOMES.OCEAN) {
                  if (rng.next() < 0.5) {
                    smoothedMap[ny][nx] = BIOMES.VILLAGE
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  let finalMap = ensureOceanPercentage(smoothedMap, 30)
  map.value = finalMap
  isGenerating.value = false
  setTimeout(() => {
    drawMap(finalMap)
    const canvas = canvasRef.value
    if (canvas) {
      const ctx = canvas.getContext('2d')
      const biomePercentages = calculateBiomePercentage(finalMap)
      ctx.fillStyle = 'black'
      ctx.font = '12px Arial'
      ctx.fillText(`海洋: ${biomePercentages[BIOMES.OCEAN]}%, 平原: ${biomePercentages[BIOMES.PLAINS]}%, 沙漠: ${biomePercentages[BIOMES.DESERT]}%, 村莊: ${biomePercentages[BIOMES.VILLAGE]}%`, 10, canvas.height - 5)
    }
  }, 100)
}

onMounted(() => {
  generateMap()
})
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
  gap: 1em;
  flex-wrap: wrap;
  align-items: center;
}
input[type="text"], select {
  margin-left: 0.5em;
}
.legend {
  margin: 1em 0 0.5em 0;
  display: flex;
  gap: 1.5em;
  flex-wrap: wrap;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 0.3em;
  font-size: 0.95em;
}
.legend-color {
  display: inline-block;
  width: 1.5em;
  height: 1em;
  border-radius: 2px;
  border: 1px solid #8882;
}
.map-canvas {
  border: 1px solid #2222;
  margin-top: 0.5em;
  background: #fff;
  display: block;
}
</style>
