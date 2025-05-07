<template>
  <div class="map-preview">
    <div class="controls-bar" v-if="map && map.length">
      <div class="zoom-controls">
        <button @click="zoomIn" title="放大" class="control-btn">+</button>
        <button @click="zoomOut" title="縮小" class="control-btn">-</button>
        <button @click="resetView" title="重置視圖" class="control-btn">
          ↺
        </button>
      </div>
      <div class="export-controls">
        <button @click="exportImage" title="導出PNG圖片" class="control-btn">
          <span class="icon">📷</span> 導出圖片
        </button>
      </div>
    </div>

    <div class="canvas-container">
      <canvas ref="canvasRef" class="map-canvas"></canvas>
      <div class="loading-overlay" v-if="!map || !map.length">
        <div class="spinner"></div>
        <div>等待地圖生成...</div>
      </div>
    </div>

    <div class="stats-panel" v-if="map && map.length">
      <div class="legend">
        <span v-for="(value, name) in biomes" :key="name" class="legend-item">
          <span
            class="legend-color"
            :style="{ background: biomeColors[value] }"
          ></span>
          <span>{{ getBiomeName(name) }}</span>
        </span>
      </div>

      <div class="biome-stats" v-if="biomeStats">
        <h4>生態域分佈</h4>
        <div class="stats-grid">
          <div
            class="stat-item"
            v-for="(percent, biome) in biomeStats"
            :key="biome"
          >
            <div class="stat-bar-container">
              <div
                class="stat-bar"
                :style="{
                  width: `${percent}%`,
                  backgroundColor: biomeColors[biome],
                }"
              ></div>
            </div>
            <div class="stat-text">
              {{ getBiomeNameById(biome) }}: {{ percent }}%
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, computed } from "vue"

const props = defineProps({
  map: Array,
  size: Number,
  biomeColors: Object,
  biomes: Object,
  calculateBiomePercentage: Function,
})

const canvasRef = ref(null)
const scale = ref(1)
const offset = ref({ x: 0, y: 0 })
const isPanning = ref(false)
const lastPan = ref({ x: 0, y: 0 })
const biomeStats = ref(null)

const biomeNames = {
  PLAINS: "平原",
  DESERT: "沙漠",
  OCEAN: "海洋",
  VILLAGE: "村莊",
}

function getBiomeName(name) {
  return biomeNames[name] || name
}

function getBiomeNameById(id) {
  const biomeEntry = Object.entries(props.biomes).find(
    ([_, value]) => value === Number(id)
  )
  return biomeEntry ? getBiomeName(biomeEntry[0]) : `未知 (${id})`
}

function updateBiomeStats() {
  if (props.map && props.map.length && props.calculateBiomePercentage) {
    biomeStats.value = props.calculateBiomePercentage(props.map)
  }
}

function drawMap() {
  const mapData = props.map
  if (!mapData || !mapData.length) return

  const canvas = canvasRef.value
  if (!canvas) return

  const ctx = canvas.getContext("2d")
  const cellSize = Math.min(10, 400 / props.size)

  // 調整畫布大小以適應地圖和瀏覽器窗口
  const mapPixelSize = props.size * cellSize
  canvas.width = Math.min(window.innerWidth * 0.8, mapPixelSize)
  canvas.height = Math.min(window.innerHeight * 0.6, mapPixelSize)

  // 計算居中偏移量
  const centerOffsetX = (canvas.width - mapPixelSize) / 2
  const centerOffsetY = (canvas.height - mapPixelSize) / 2

  // 清除畫布
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // 應用變換矩陣 (縮放和偏移)
  ctx.setTransform(
    scale.value,
    0,
    0,
    scale.value,
    offset.value.x + centerOffsetX * scale.value,
    offset.value.y + centerOffsetY * scale.value
  )

  // 繪製地圖網格
  for (let y = 0; y < props.size; y++) {
    for (let x = 0; x < props.size; x++) {
      const biome = mapData[y][x]
      ctx.fillStyle = props.biomeColors[biome]
      ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize)
    }
  }

  // 更新生態域統計信息
  updateBiomeStats()
}

function redraw() {
  scale.value = 1
  offset.value = { x: 0, y: 0 }
  drawMap()
}

// 縮放功能
function zoomIn() {
  scale.value = Math.min(5, scale.value * 1.2)
  drawMap()
}

function zoomOut() {
  scale.value = Math.max(0.2, scale.value / 1.2)
  drawMap()
}

function resetView() {
  scale.value = 1
  offset.value = { x: 0, y: 0 }
  drawMap()
}

function onWheel(e) {
  e.preventDefault()
  const canvas = canvasRef.value
  if (!canvas) return

  const rect = canvas.getBoundingClientRect()
  const mouseX = (e.clientX - rect.left - offset.value.x) / scale.value
  const mouseY = (e.clientY - rect.top - offset.value.y) / scale.value
  const delta = e.deltaY < 0 ? 1.1 : 0.9

  scale.value = Math.max(0.2, Math.min(5, scale.value * delta))
  offset.value.x -= mouseX * (delta - 1) * scale.value
  offset.value.y -= mouseY * (delta - 1) * scale.value

  drawMap()
}

// 平移功能
function onMouseDown(e) {
  isPanning.value = true
  lastPan.value = { x: e.clientX, y: e.clientY }
}

function onMouseMove(e) {
  if (!isPanning.value) return

  const dx = e.clientX - lastPan.value.x
  const dy = e.clientY - lastPan.value.y
  offset.value.x += dx
  offset.value.y += dy
  lastPan.value = { x: e.clientX, y: e.clientY }

  drawMap()
}

function onMouseUp() {
  isPanning.value = false
}

// 導出圖片功能
function exportImage() {
  const canvas = canvasRef.value
  if (!canvas || !props.map || !props.map.length) return

  // 創建一個新畫布來繪製完整的地圖
  const exportCanvas = document.createElement("canvas")
  const cellSize = Math.min(5, 400 / props.size) // 調整導出尺寸
  const mapSize = props.size * cellSize

  exportCanvas.width = mapSize
  exportCanvas.height = mapSize

  const ctx = exportCanvas.getContext("2d")

  // 繪製地圖
  for (let y = 0; y < props.size; y++) {
    for (let x = 0; x < props.size; x++) {
      const biome = props.map[y][x]
      ctx.fillStyle = props.biomeColors[biome]
      ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize)
    }
  }

  // 在底部添加圖例
  ctx.fillStyle = "white"
  ctx.fillRect(0, mapSize - 30, mapSize, 30)
  ctx.fillStyle = "black"
  ctx.font = "12px Arial"

  // 添加種子與尺寸信息
  const seedInfo = document.querySelector(".info-text")
  if (seedInfo) {
    ctx.fillText(seedInfo.textContent || "", 10, mapSize - 15)
  }

  // 創建下載鏈接
  try {
    const dataUrl = exportCanvas.toDataURL("image/png")
    const link = document.createElement("a")
    link.download = `seed-map-${Date.now()}.png`
    link.href = dataUrl
    link.click()
  } catch (e) {
    console.error("導出圖片失敗:", e)
    alert("導出圖片失敗，請檢查控制台錯誤")
  }
}

// 監聽地圖和尺寸變化
watch(
  () => [props.map, props.size],
  () => {
    redraw()
  }
)

// 監聽窗口大小變化
function onResize() {
  drawMap()
}

// 元件掛載和卸載
onMounted(() => {
  drawMap()
  const canvas = canvasRef.value

  if (canvas) {
    canvas.addEventListener("wheel", onWheel, { passive: false })
    canvas.addEventListener("mousedown", onMouseDown)
    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", onMouseUp)
    window.addEventListener("resize", onResize)
  }
})

onUnmounted(() => {
  const canvas = canvasRef.value
  if (canvas) {
    canvas.removeEventListener("wheel", onWheel)
    canvas.removeEventListener("mousedown", onMouseDown)
    window.removeEventListener("mousemove", onMouseMove)
    window.removeEventListener("mouseup", onMouseUp)
    window.removeEventListener("resize", onResize)
  }
})

// 向父組件公開函數
defineExpose({
  redraw,
})
</script>

<style scoped>
.map-preview {
  display: flex;
  flex-direction: column;
  gap: 1em;
  padding: 1em;
  background-color: var(--map-container-bg);
  border-radius: 8px;
  box-shadow: 0 2px 6px var(--shadow);
  height: 100%;
}

.controls-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: var(--card-bg);
  padding: 0.6em;
  border-radius: 6px;
  border: 1px solid var(--border-color);
}

.zoom-controls,
.export-controls {
  display: flex;
  gap: 0.5em;
}

.control-btn {
  padding: 0.3em 0.7em;
  border: 1px solid var(--border-color);
  background: var(--card-bg);
  border-radius: 4px;
  cursor: pointer;
  font-size: 1em;
  display: flex;
  align-items: center;
  gap: 0.3em;
  color: var(--text-color);
}

.control-btn:hover {
  background: rgba(125, 125, 125, 0.1);
}

.control-btn .icon {
  font-size: 1.1em;
}

.canvas-container {
  position: relative;
  height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f0f0f0;
  border-radius: 6px;
  overflow: hidden;
}

.map-canvas {
  border: 1px solid var(--border-color);
  background: white;
  display: block;
  cursor: grab;
  max-width: 100%;
  max-height: 100%;
  box-shadow: 0 0 5px rgba(0, 0, 0, 0.05);
}

.map-canvas:active {
  cursor: grabbing;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.7);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1em;
}

.spinner {
  border: 4px solid rgba(0, 0, 0, 0.1);
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border-left-color: #09f;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.stats-panel {
  display: flex;
  flex-direction: column;
  gap: 1em;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 1em;
  background-color: white;
  padding: 0.8em;
  border-radius: 4px;
  border: 1px solid #eee;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.3em;
  font-size: 0.9em;
  white-space: nowrap;
}

.legend-color {
  display: inline-block;
  width: 1.2em;
  height: 0.8em;
  border-radius: 2px;
}

.biome-stats {
  background-color: white;
  padding: 0.8em;
  border-radius: 4px;
  border: 1px solid #eee;
}

.biome-stats h4 {
  margin-top: 0;
  margin-bottom: 0.8em;
  font-size: 1em;
  color: #555;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.8em;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 0.2em;
}

.stat-bar-container {
  height: 8px;
  background-color: #eee;
  border-radius: 4px;
  overflow: hidden;
}

.stat-bar {
  height: 100%;
  transition: width 0.3s ease-out;
}

.stat-text {
  font-size: 0.85em;
  color: #666;
}

@media (max-width: 600px) {
  .controls-bar {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.8em;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
