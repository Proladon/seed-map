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
    <button :disabled="total !== 100" @click="emitRatios">套用比例</button>
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

function emitRatios() {
  emit("update:ratios", { ...localRatios.value })
}
</script>

<style scoped>
.biome-ratio-editor {
  border: 1px solid #ccc;
  padding: 1em;
  border-radius: 8px;
  max-width: 350px;
  margin-bottom: 1em;
}
.biome-row {
  display: flex;
  align-items: center;
  gap: 0.5em;
  margin-bottom: 0.5em;
}
.biome-label {
  width: 3em;
}
.biome-value {
  width: 3em;
  text-align: right;
}
.total {
  margin-top: 0.5em;
  font-weight: bold;
}
button {
  margin-top: 0.5em;
  padding: 0.3em 1em;
}
</style>
