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

  // 使用外部的地圖生成工具
  const mapGenerator = new MapGeneratorTool(
    seedNumber,
    size.value,
    biomeRatios.value
  )

  // 生成地圖
  map.value = mapGenerator.generate()

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
