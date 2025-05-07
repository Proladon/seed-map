<template>
  <div class="map-preview">
    <table>
      <tbody>
        <tr v-for="(row, y) in map" :key="y">
          <td v-for="(cell, x) in row" :key="x" :class="cell"></td>
        </tr>
      </tbody>
    </table>
    <div class="legend">
      <span class="ocean">海洋</span>
      <span class="plain">平原</span>
      <span class="desert">沙漠</span>
      <span class="village">村莊</span>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  map: Array,
  size: Number
})
</script>

<style scoped>
.map-preview {
  overflow-x: auto;
  margin-top: 1em;
}
table {
  border-collapse: collapse;
  margin: 0 auto;
}
td {
  width: 12px;
  height: 12px;
  border: 1px solid #2222;
  padding: 0;
}
.ocean {
  background: #3498db;
}
.plain {
  background: #27ae60;
}
.desert {
  background: #f4d03f;
}
.village {
  background: #e67e22;
}
.legend {
  margin-top: 0.5em;
  display: flex;
  gap: 1em;
}
.legend span {
  display: inline-block;
  width: 2em;
  height: 1em;
  border-radius: 2px;
  text-align: center;
  color: #222;
  font-size: 0.9em;
  padding: 0 0.5em;
}
.legend .ocean { background: #3498db; }
.legend .plain { background: #27ae60; }
.legend .desert { background: #f4d03f; }
.legend .village { background: #e67e22; }
</style>
