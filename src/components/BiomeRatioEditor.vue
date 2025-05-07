<template>
  <div class="biome-ratio-editor">
    <h3>生態域生成比例調整</h3>
    <div v-for="(label, key) in labels" :key="key" class="biome-row">
      <span class="biome-label">{{ label }}</span>
      <input
        type="range"
        min="0"
        max="100"
        v-model.number="localRatios[key]"
        @input="onInput"
      />
      <span class="biome-value">{{ localRatios[key] }}%</span>
    </div>
    <div class="total">總和：{{ total }}%</div>
    <div class="button-group">
      <button :disabled="total !== 100" @click="emitRatios">套用比例</button>
      <button @click="generateRandomRatios">隨機比例</button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed } from "vue"
import { BIOMES } from "../config/biome"

const props = defineProps({
  ratios: {
    type: Object,
    required: true,
  },
})
const emit = defineEmits(["update:ratios"])

const labels = {
  [BIOMES.OCEAN]: "海洋",
  [BIOMES.PLAINS]: "平原",
  [BIOMES.DESERT]: "沙漠",
  [BIOMES.VILLAGE]: "村莊",
}

const localRatios = ref({ ...props.ratios })

watch(
  () => props.ratios,
  (val) => {
    localRatios.value = { ...val }
  }
)

const total = computed(() =>
  Object.values(localRatios.value).reduce((a, b) => a + Number(b), 0)
)

function onInput() {
  // 若總和超過100，自動調整其他項目
  let sum = total.value
  if (sum > 100) {
    // 找到最後調整的key
    // 這裡簡單處理，讓其他項目等比例縮減
    const keys = Object.keys(localRatios.value)
    const over = sum - 100
    const lastKey = keys[keys.length - 1]
    for (const key of keys) {
      if (key !== lastKey) {
        localRatios.value[key] = Math.max(
          0,
          Math.round(localRatios.value[key] - over / (keys.length - 1))
        )
      }
    }
  }
}

/**
 * 生成隨機的生態比例，確保總和為100%，並自動套用
 */
function generateRandomRatios() {
  // 生成隨機比例，但保留一些合理的約束
  const keys = Object.keys(localRatios.value)

  // 為每個生態域設定最小值和最大值
  const minValues = {
    [BIOMES.OCEAN]: 25, // 海洋至少占25%
    [BIOMES.PLAINS]: 20, // 平原至少占20%
    [BIOMES.DESERT]: 10, // 沙漠至少占10%
    [BIOMES.VILLAGE]: 1, // 村莊至少占1%
  }

  const maxValues = {
    [BIOMES.OCEAN]: 60, // 海洋最多60%
    [BIOMES.PLAINS]: 50, // 平原最多50%
    [BIOMES.DESERT]: 30, // 沙漠最多30%
    [BIOMES.VILLAGE]: 5, // 村莊最多5%
  }

  // 先分配最小值
  let remaining = 100
  for (const key of keys) {
    localRatios.value[key] = minValues[key]
    remaining -= minValues[key]
  }

  // 剩餘部分隨機分配，但尊重最大值限制
  while (remaining > 0) {
    // 選擇一個隨機生態域
    const randomIndex = Math.floor(Math.random() * keys.length)
    const key = keys[randomIndex]

    // 檢查是否已達到最大值
    if (localRatios.value[key] < maxValues[key]) {
      // 增加1-3之間的隨機值，或剩餘值（取較小者）
      const increment = Math.min(Math.floor(Math.random() * 3) + 1, remaining)

      // 確保不超過最大值
      const newValue = Math.min(
        localRatios.value[key] + increment,
        maxValues[key]
      )
      const actualIncrement = newValue - localRatios.value[key]

      localRatios.value[key] = newValue
      remaining -= actualIncrement
    }
  }

  // 四捨五入並確保總和為100
  let sum = 0
  for (const key of keys.slice(0, -1)) {
    localRatios.value[key] = Math.round(localRatios.value[key])
    sum += localRatios.value[key]
  }

  // 最後一個值確保總和為100
  localRatios.value[keys[keys.length - 1]] = 100 - sum

  // 自動套用新的比例
  emitRatios()
}

function emitRatios() {
  emit("update:ratios", { ...localRatios.value })
}
</script>

<style scoped>
.biome-ratio-editor {
  border: 1px solid var(--border-color);
  padding: 1em;
  border-radius: 8px;
  margin-bottom: 1em;
  background-color: var(--card-bg);
}

h3 {
  margin-top: 0;
  color: var(--text-color);
  font-size: 1.1em;
  margin-bottom: 0.8em;
}

.biome-row {
  display: flex;
  align-items: center;
  gap: 0.5em;
  margin-bottom: 0.8em;
}

.biome-label {
  width: 3em;
  color: var(--text-color);
}

.biome-value {
  width: 3em;
  text-align: right;
  color: var(--text-color);
}

/* 自定義滑動條的樣式 */
input[type="range"] {
  flex: 1;
  -webkit-appearance: none;
  height: 6px;
  border-radius: 3px;
  background: #e0e0e0;
  outline: none;
}

input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--button-primary);
  cursor: pointer;
  transition: background 0.15s ease-in-out;
}

input[type="range"]::-webkit-slider-thumb:hover {
  background: var(--button-hover);
}

input[type="range"]::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--button-primary);
  cursor: pointer;
  transition: background 0.15s ease-in-out;
  border: 0;
}

input[type="range"]::-moz-range-thumb:hover {
  background: var(--button-hover);
}

.total {
  margin-top: 0.8em;
  font-weight: bold;
  color: var(--text-color);
}

.button-group {
  display: flex;
  gap: 0.5em;
  margin-top: 1em;
}

button {
  padding: 0.4em 1em;
  background-color: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-color);
  transition: all 0.2s ease;
}

button:hover:not(:disabled) {
  background-color: rgba(125, 125, 125, 0.1);
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

button:last-child {
  background-color: var(--button-primary);
  color: white;
  border-color: var(--button-primary);
}

button:last-child:hover {
  background-color: var(--button-hover);
}
</style>
