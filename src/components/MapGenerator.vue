<template>
  <div class="map-generator">
    <h2>種子地圖生成器</h2>
    <div class="generator-container">
      <div class="controls-panel">
        <BiomeRatioEditor :ratios="biomeRatios" @update:ratios="updateRatios" />
        <div class="controls">
          <div class="input-group">
            <label for="seed-input">種子碼：</label>
            <div class="seed-input-container">
              <input
                id="seed-input"
                v-model="seedInput"
                maxlength="10"
                pattern="\\d{10}"
                placeholder="10位數字"
              />
              <button
                @click="generateRandomSeed"
                class="random-btn"
                title="隨機產生種子碼"
              >
                🎲
              </button>
            </div>
          </div>

          <div class="input-group">
            <label for="map-size">地圖尺寸：</label>
            <select id="map-size" v-model.number="pendingSize">
              <option v-for="s in sizes" :key="s" :value="s">
                {{ s }} x {{ s }}
              </option>
            </select>
          </div>

          <button
            @click="generateMap"
            :disabled="isGenerating"
            class="generate-btn"
          >
            {{ isGenerating ? "生成中..." : "生成地圖" }}
          </button>

          <div class="info-text" v-if="map.length > 0">
            已生成 {{ size }}x{{ size }} 的地圖，種子碼: {{ seedInput }}
          </div>
        </div>
      </div>

      <MapPreview
        ref="mapPreviewRef"
        :map="map"
        :size="size"
        :biomeColors="BIOME_COLORS"
        :biomes="BIOMES"
        :calculateBiomePercentage="calculateBiomePercentage"
        class="map-preview"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue"
import MapPreview from "./MapPreview.vue"
import BiomeRatioEditor from "./BiomeRatioEditor.vue"
import { BIOMES, BIOME_COLORS } from "../config/biome"
import MapGeneratorTool from "../utils/MapGenerator"

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
const mapPreviewRef = ref(null)

function updateRatios(newRatios) {
  biomeRatios.value = { ...newRatios }
  if (map.value.length > 0) {
    // 自動重新生成地圖來反映新的比例
    generateMap()
  }
}

function calculateBiomePercentage(mapData) {
  return MapGeneratorTool.calculateBiomePercentage(mapData)
}

function generateRandomSeed() {
  seedInput.value = MapGeneratorTool.generateRandomSeed()
}

function generateMap() {
  size.value = pendingSize.value
  if (!seedInput.value || isNaN(parseInt(seedInput.value))) {
    alert("請輸入有效的數字種子")
    return
  }

  isGenerating.value = true
  const seedNumber = parseInt(seedInput.value) || 0

  // 使用Web Worker來進行地圖生成，避免阻塞UI
  setTimeout(() => {
    try {
      // 使用外部的地圖生成工具
      const mapGenerator = new MapGeneratorTool(
        seedNumber,
        size.value,
        biomeRatios.value
      )

      // 生成地圖
      map.value = mapGenerator.generate()

      // 確保地圖被更新後重繪
      if (mapPreviewRef.value && mapPreviewRef.value.redraw) {
        mapPreviewRef.value.redraw()
      }
    } catch (error) {
      console.error("地圖生成錯誤:", error)
      alert("地圖生成失敗，請檢查控制台錯誤")
    } finally {
      isGenerating.value = false
    }
  }, 50) // 給UI更新的時間，顯示"生成中..."
}

// 頁面載入時自動生成一個地圖
onMounted(() => {
  generateMap()
})
</script>

<style scoped>
.map-generator {
  margin: 2em auto;
  max-width: 900px;
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
}

.random-btn {
  padding: 0.2em 0.5em;
  font-size: 1.2em;
  cursor: pointer;
}

input,
select {
  padding: 0.5em;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.generate-btn {
  margin-top: 0.5em;
  background-color: #4caf50;
  color: white;
  border: none;
  padding: 0.7em 1em;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  transition: background-color 0.2s;
}

.generate-btn:hover {
  background-color: #45a049;
}

.generate-btn:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.info-text {
  margin-top: 0.5em;
  font-size: 0.9em;
  color: #666;
}
</style>
