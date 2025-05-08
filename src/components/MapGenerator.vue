<template>
  <div class="map-generator">
    <h2>種子地圖生成器</h2>
    <div class="generator-container">
      <div class="controls-panel">
        <div class="controls">
          <div class="input-group">
            <label for="seed-input">種子碼：</label>
            <div class="seed-input-container">
              <input
                id="seed-input"
                v-model="seedInput"
                type="text"
                pattern="\d{10}"
                minlength="10"
                maxlength="10"
                placeholder="10位數字"
              />
              <button @click="generateRandomSeed" class="random-btn" title="隨機產生種子碼">
                🎲
              </button>
            </div>
          </div>

          <div class="input-group">
            <label for="map-size">地圖尺寸：</label>
            <select id="map-size" v-model.number="mapSize">
              <option v-for="s in sizes" :key="s" :value="s">{{ s }} x {{ s }}</option>
            </select>
          </div>

          <div class="input-group">
            <label for="scale">地形縮放：</label>
            <input type="range" id="scale" v-model.number="scale" min="10" max="100" step="5" />
            <span>{{ scale / 100 }}</span>
          </div>

          <button @click="generateMap" class="generate-btn" :disabled="isGenerating">
            {{ isGenerating ? '生成中...' : '生成地圖' }}
          </button>

          <div class="info-text" v-if="mapGenerated">
            已生成 {{ mapSize }}x{{ mapSize }} 的地圖，種子碼: {{ seedInput }}
          </div>
        </div>
      </div>

      <div class="map-preview">
        <div v-if="mapGenerated" class="map-container">
          <div class="zoom-info">縮放等級: {{ Math.round(mapScale * 100) }}%</div>

          <div ref="mapContainer" class="map-wrapper" :class="{ dragging: isDragging }">
            <canvas ref="mapCanvas" :width="mapSize" :height="mapSize"></canvas>
          </div>

          <div class="controls">
            <button @click="zoomIn" title="放大">+</button>
            <button @click="zoomOut" title="縮小">-</button>
            <button @click="resetView" title="重置視圖">↺</button>
            <button @click="saveMap" title="导出PNG圖片">
              <span class="icon">📷</span> 保存地圖
            </button>
          </div>

          <div class="legend">
            <div v-for="(biome, biomeName) in BIOMES" :key="biomeName" class="legend-item">
              <div class="legend-color" :style="{ backgroundColor: biome.color }"></div>
              <span>{{ biome.name }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { BIOMES } from '../config/biome'
// 引入地圖生成器函數
import {
  generateRandomSeed,
  generateMapData,
  drawMapToCanvas,
  saveMapAsPNG,
  calculateBiomePercentage as calculateBiomePercentageService,
} from '../utils'

// 地圖控制器參數
const seedInput = ref('1234567890')
const mapSize = ref(128)
const scale = ref(50)
const sizes = [64, 128, 256, 512]
const isGenerating = ref(false)
const mapGenerated = ref(false)
const generatedMapData = ref([]) // 存儲生成的地圖數據

// Canvas 繪製參數
const mapCanvas = ref(null)
const mapContainer = ref(null)
const mapPosition = ref({ x: 0, y: 0 })
const mapScale = ref(1)
const isDragging = ref(false)
const lastMousePosition = ref({ x: 0, y: 0 })

function generateMap() {
  // 如果種子碼無效，使用預設種子
  if (!/^\d{10}$/.test(seedInput.value)) {
    seedInput.value = '1234567890'
  }

  isGenerating.value = true

  // 重置視圖
  resetView()

  // 先設置 mapGenerated 為 true，以便顯示 canvas 元素
  mapGenerated.value = true

  // 重置地圖數據
  generatedMapData.value = []

  // 使用 setTimeout 讓UI有時間更新
  setTimeout(() => {
    try {
      // 確保 canvas 元素已經存在
      const canvas = mapCanvas.value
      if (!canvas) {
        console.error('Canvas element not found')
        return
      }

      // 調整 canvas 大小以匹配地圖尺寸
      canvas.width = mapSize.value
      canvas.height = mapSize.value

      // 生成地圖數據
      generateMapData(
        {
          seed: seedInput.value,
          mapSize: mapSize.value,
          scale: scale.value,
        },
        // 可選的進度回調函數（如果需要顯示進度條）
        (progress) => {
          console.log(`地圖生成進度: ${progress}%`)
        },
      ).then((mapData) => {
        // 保存生成的地圖數據
        generatedMapData.value = mapData

        // 繪製地圖到畫布
        drawMapToCanvas(mapCanvas.value, mapData)

        // 更新 canvas 變換
        updateCanvasTransform()

        // 渲染完成
        isGenerating.value = false

        // 設置事件監聽器
        setupEventListeners()
      })
    } catch (error) {
      console.error('地圖生成錯誤:', error)
      isGenerating.value = false
    }
  }, 10)
}

// 重新繪製地圖
function redraw() {
  const canvas = mapCanvas.value
  if (!canvas) return

  // 新增檢查，確保 generatedMapData.value 已經初始化且有數據
  if (!generatedMapData.value || !generatedMapData.value.length) {
    console.log('地圖數據尚未生成')
    return
  }

  // 使用服務繪製地圖到畫布
  drawMapToCanvas(canvas, generatedMapData.value)
  updateCanvasTransform()
}

// 設置事件監聽器
function setupEventListeners() {
  const container = mapContainer.value
  if (!container) return

  // 移除舊的事件監聽器（如果有的話）
  container.removeEventListener('mousedown', handleMouseDown)
  container.removeEventListener('wheel', handleWheel)
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)

  // 添加新的事件監聽器
  container.addEventListener('mousedown', handleMouseDown)
  container.addEventListener('wheel', handleWheel)
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

// 處理滑鼠按下事件
function handleMouseDown(event) {
  isDragging.value = true
  lastMousePosition.value = {
    x: event.clientX,
    y: event.clientY,
  }
}

// 處理滑鼠移動事件
function handleMouseMove(event) {
  if (!isDragging.value) return

  const deltaX = event.clientX - lastMousePosition.value.x
  const deltaY = event.clientY - lastMousePosition.value.y

  mapPosition.value = {
    x: mapPosition.value.x + deltaX,
    y: mapPosition.value.y + deltaY,
  }

  lastMousePosition.value = {
    x: event.clientX,
    y: event.clientY,
  }

  updateCanvasTransform()
}

// 處理滑鼠釋放事件
function handleMouseUp() {
  isDragging.value = false
}

// 處理滾輪事件
function handleWheel(event) {
  event.preventDefault()

  // 獲取滑鼠在 canvas 容器中的相對位置
  const rect = event.currentTarget.getBoundingClientRect()
  const mouseX = event.clientX - rect.left
  const mouseY = event.clientY - rect.top

  // 計算滑鼠相對於縮放後 canvas 的位置
  const canvasX = (mouseX - mapPosition.value.x) / mapScale.value
  const canvasY = (mouseY - mapPosition.value.y) / mapScale.value

  // 縮放係數
  const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9

  // 限制縮放範圍
  const newScale = Math.max(0.1, Math.min(10, mapScale.value * zoomFactor))

  // 計算新的位置，使滑鼠指向的點保持不變
  const newX = mouseX - canvasX * newScale
  const newY = mouseY - canvasY * newScale

  // 更新狀態
  mapScale.value = newScale
  mapPosition.value = { x: newX, y: newY }

  updateCanvasTransform()
}

// 應用 canvas 變換 (縮放和位置)
function updateCanvasTransform() {
  const canvas = mapCanvas.value
  if (!canvas) return

  canvas.style.transform = `translate(${mapPosition.value.x}px, ${mapPosition.value.y}px) scale(${mapScale.value})`
}

// 放大
function zoomIn() {
  mapScale.value = Math.min(10, mapScale.value * 1.2)
  updateCanvasTransform()
}

// 縮小
function zoomOut() {
  mapScale.value = Math.max(0.1, mapScale.value / 1.2)
  updateCanvasTransform()
}

// 重置視圖
function resetView() {
  mapPosition.value = { x: 0, y: 0 }
  mapScale.value = 1
  updateCanvasTransform()
}

// 保存地圖為圖片
function saveMap() {
  if (!generatedMapData.value || !generatedMapData.value.length) {
    alert('沒有地圖數據可供保存')
    return
  }

  try {
    const dataURL = saveMapAsPNG(generatedMapData.value, {
      seed: seedInput.value,
      mapSize: mapSize.value,
    })

    const link = document.createElement('a')
    link.href = dataURL
    link.download = `minecraft-map-${seedInput.value}.png`
    link.click()
  } catch (error) {
    console.error('Error saving map:', error)
    alert('保存地圖時發生錯誤，請稍後再試。')
  }
}

// 計算各生態域的百分比
function calculateBiomePercentage() {
  return calculateBiomePercentageService(generatedMapData.value)
}

// 頁面載入時自動生成地圖
onMounted(() => {
  generateMap()
})
</script>

<style scoped>
.map-generator {
  margin: 0 auto;
  max-width: 1000px;
  text-align: left;
}

.generator-container {
  display: flex;
  flex-direction: column;
  gap: 1.5em;
}

@media (min-width: 768px) {
  .generator-container {
    flex-direction: row;
  }

  .controls-panel {
    flex: 1;
  }

  .map-preview {
    flex: 2;
  }
}

.controls-panel {
  background-color: var(--map-container-bg);
  border-radius: 8px;
  box-shadow: 0 2px 6px var(--shadow);
  padding: 1.2em;
}

.controls {
  margin-top: 1.5em;
  display: flex;
  flex-direction: column;
  gap: 0.8em;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 0.3em;
}

@media (min-width: 500px) {
  .input-group {
    flex-direction: row;
    align-items: center;
  }

  .input-group label {
    width: 5em;
  }
}

.seed-input-container {
  display: flex;
  flex: 1;
}

.seed-input-container input {
  flex: 1;
  margin-right: 0.5em;
  background-color: var(--card-bg);
  color: var(--text-color);
  border: 1px solid var(--border-color);
}

.random-btn {
  padding: 0.2em 0.5em;
  font-size: 1.2em;
  cursor: pointer;
  background-color: var(--card-bg);
  color: var(--text-color);
  border: 1px solid var(--border-color);
}

input,
select {
  padding: 0.5em;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--card-bg);
  color: var(--text-color);
}

.generate-btn {
  margin-top: 0.5em;
  background-color: var(--button-primary);
  color: white;
  border: none;
  padding: 0.7em 1em;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  transition: background-color 0.2s;
}

.generate-btn:hover {
  background-color: var(--button-hover);
}

.generate-btn:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.info-text {
  margin-top: 0.5em;
  font-size: 0.9em;
  color: var(--text-color);
  opacity: 0.8;
}

.error-message {
  color: red;
  font-size: 0.8em;
  margin-top: 0.3em;
}

.map-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  background-color: var(--map-container-bg);
  padding: 1em;
  border-radius: 8px;
  box-shadow: 0 2px 6px var(--shadow);
}

.map-wrapper {
  position: relative;
  border: 4px solid #555;
  margin: 10px 0;
  overflow: hidden;
  width: 500px;
  height: 500px;
  cursor: grab;
}

.map-wrapper.dragging {
  cursor: grabbing;
}

canvas {
  display: block;
  position: absolute;
  transform-origin: 0 0;
  image-rendering: pixelated; /* 讓像素圖更清晰 */
}

.zoom-info {
  font-size: 12px;
  color: var(--text-color);
  margin-top: 5px;
  text-align: center;
}

.controls {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 10px;
}

.controls button {
  margin: 0;
  background-color: var(--button-primary);
  color: white;
  border: none;
  padding: 0.5em 1em;
  border-radius: 4px;
  cursor: pointer;
}

.controls button:hover {
  background-color: var(--button-hover);
}

.legend {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  margin-top: 15px;
  gap: 15px;
}

.legend-item {
  display: flex;
  align-items: center;
  margin-right: 10px;
}

.legend-color {
  width: 20px;
  height: 20px;
  margin-right: 5px;
  border: 1px solid #333;
}
</style>
