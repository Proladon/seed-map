<template>
  <div class="map-preview">
    <canvas ref="canvasRef" class="map-canvas"></canvas>
    <div class="legend">
      <span v-for="(value, name) in biomes" :key="name" class="legend-item">
        <span
          class="legend-color"
          :style="{ background: biomeColors[value] }"
        ></span>
        <span>{{
          name === "PLAINS"
            ? "平原"
            : name === "DESERT"
            ? "沙漠"
            : name === "OCEAN"
            ? "海洋"
            : name === "VILLAGE"
            ? "村莊"
            : name
        }}</span>
      </span>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from "vue"

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

function drawMap() {
  const mapData = props.map
  if (!mapData || !mapData.length) return
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext("2d")
  const cellSize = Math.min(10, 400 / props.size)
  canvas.width = props.size * cellSize
  canvas.height = props.size * cellSize
  ctx.setTransform(
    scale.value,
    0,
    0,
    scale.value,
    offset.value.x,
    offset.value.y
  )
  ctx.clearRect(
    -offset.value.x / scale.value,
    -offset.value.y / scale.value,
    canvas.width / scale.value,
    canvas.height / scale.value
  )
  for (let y = 0; y < props.size; y++) {
    for (let x = 0; x < props.size; x++) {
      const biome = mapData[y][x]
      ctx.fillStyle = props.biomeColors[biome]
      ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize)
    }
  }
  // draw legend text
  const biomePercentages = props.calculateBiomePercentage(mapData)
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = "black"
  ctx.font = "12px Arial"
  ctx.fillText(
    `海洋: ${biomePercentages[props.biomes.OCEAN]}%, 平原: ${
      biomePercentages[props.biomes.PLAINS]
    }%, 沙漠: ${biomePercentages[props.biomes.DESERT]}%, 村莊: ${
      biomePercentages[props.biomes.VILLAGE]
    }%`,
    10,
    canvas.height - 5
  )
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

watch(
  () => [props.map, props.size],
  () => {
    scale.value = 1
    offset.value = { x: 0, y: 0 }
    drawMap()
  }
)

onMounted(() => {
  drawMap()
  const canvas = canvasRef.value
  if (canvas) {
    canvas.addEventListener("wheel", onWheel, { passive: false })
    canvas.addEventListener("mousedown", onMouseDown)
    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", onMouseUp)
  }
})
</script>

<style scoped>
.map-preview {
  overflow-x: auto;
  margin-top: 1em;
}
.map-canvas {
  border: 1px solid #2222;
  margin-top: 0.5em;
  background: #fff;
  display: block;
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
</style>
