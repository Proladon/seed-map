<script setup>
import { ref, watch } from "vue"
import MapGenerator from "./components/MapGenerator.vue"

const darkMode = ref(false)

// Check for system preference on dark mode
const prefersDarkMode =
  window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches

// Initialize dark mode based on localStorage or system preference
darkMode.value =
  localStorage.getItem("darkMode") === "true" ||
  (localStorage.getItem("darkMode") === null && prefersDarkMode)

// Apply theme to document
function applyTheme(isDark) {
  if (isDark) {
    document.documentElement.classList.add("dark-theme")
  } else {
    document.documentElement.classList.remove("dark-theme")
  }
}

// Watch for changes and update localStorage
watch(darkMode, (newValue) => {
  localStorage.setItem("darkMode", newValue)
  applyTheme(newValue)
})

// Apply theme on initial load
applyTheme(darkMode.value)

function toggleDarkMode() {
  darkMode.value = !darkMode.value
}
</script>

<template>
  <div class="app-container" :class="{ 'dark-theme': darkMode }">
    <header class="app-header">
      <div class="header-content">
        <h1>種子地圖生成器</h1>
        <div class="theme-toggle">
          <button
            @click="toggleDarkMode"
            class="theme-button"
            :title="darkMode ? '切換到亮色模式' : '切換到暗色模式'"
          >
            <span v-if="darkMode">🌞</span>
            <span v-else>🌙</span>
          </button>
        </div>
      </div>
    </header>

    <main class="app-content">
      <MapGenerator />
    </main>

    <footer class="app-footer">
      <p>
        © {{ new Date().getFullYear() }} 種子地圖生成器 | 使用連續生態系算法
      </p>
      <p class="version-info">版本 1.0.0</p>
    </footer>
  </div>
</template>

<style>
:root {
  --bg-color: #f8f9fa;
  --text-color: #333;
  --card-bg: #fff;
  --border-color: #e0e0e0;
  --header-bg: #ffffff;
  --header-text: #333;
  --footer-bg: #f0f0f0;
  --button-primary: #4caf50;
  --button-hover: #45a049;
  --shadow: rgba(0, 0, 0, 0.1);
  --map-container-bg: #ffffff;
}

.dark-theme {
  --bg-color: #121212;
  --text-color: #e0e0e0;
  --card-bg: #1e1e1e;
  --border-color: #444;
  --header-bg: #1a1a1a;
  --header-text: #f0f0f0;
  --footer-bg: #1a1a1a;
  --button-primary: #5bc75f;
  --button-hover: #4db351;
  --shadow: rgba(0, 0, 0, 0.3);
  --map-container-bg: #2d2d2d;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
  line-height: 1.6;
  background-color: var(--bg-color);
  color: var(--text-color);
  transition: background-color 0.3s ease, color 0.3s ease;
}

.app-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  background-color: var(--header-bg);
  color: var(--header-text);
  padding: 1rem 2rem;
  box-shadow: 0 2px 5px var(--shadow);
  position: sticky;
  top: 0;
  z-index: 100;
  transition: background-color 0.3s ease, color 0.3s ease;
}

.header-content {
  max-width: 1280px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.theme-button {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0.3rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
}

.theme-button:hover {
  background-color: rgba(125, 125, 125, 0.1);
}

.app-content {
  flex: 1;
  padding: 2rem 1rem;
  max-width: 1280px;
  margin: 0 auto;
  width: 100%;
}

.app-footer {
  background-color: var(--footer-bg);
  color: var(--text-color);
  text-align: center;
  padding: 1.5rem;
  margin-top: 2rem;
  transition: background-color 0.3s ease;
}

.version-info {
  font-size: 0.8rem;
  margin-top: 0.5rem;
  opacity: 0.7;
}

@media (max-width: 768px) {
  .app-header {
    padding: 0.8rem 1rem;
  }

  .header-content h1 {
    font-size: 1.3rem;
  }

  .app-content {
    padding: 1rem 0.5rem;
  }
}
</style>
