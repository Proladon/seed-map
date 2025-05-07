import SeededRandom from "./SeededRandom"

/**
 * 生成簡單柏林噪聲值
 * @param {number} x - x座標
 * @param {number} y - y座標
 * @param {SeededRandom} rng - 隨機數生成器
 * @param {number} scale - 噪聲尺度
 * @returns {number} 0-1 之間的噪聲值
 */
export function generateSimplexNoise(x, y, rng, scale = 1) {
  const xPrime = x + rng.next() * 0.2
  const yPrime = y + rng.next() * 0.2
  const hash =
    Math.sin(xPrime * 12.9898 * scale + yPrime * 78.233 * scale) * 43758.5453
  return hash - Math.floor(hash)
}

/**
 * 生成多層疊加的柏林噪聲
 * @param {number} x - x座標
 * @param {number} y - y座標
 * @param {SeededRandom} rng - 隨機數生成器
 * @param {number} octaves - 噪聲層數
 * @param {number} persistence - 每層噪聲衰減係數
 * @param {number} scale - 噪聲尺度
 * @returns {number} 0-1 之間的噪聲值
 */
export function generateOctaveNoise(
  x,
  y,
  rng,
  octaves = 1,
  persistence = 0.5,
  scale = 1
) {
  let total = 0
  let frequency = 1
  let amplitude = 1
  let maxValue = 0
  for (let i = 0; i < octaves; i++) {
    const offsetX = rng.next() * 1000
    const offsetY = rng.next() * 1000
    total +=
      generateSimplexNoise(
        ((x + offsetX) * frequency) / scale,
        ((y + offsetY) * frequency) / scale,
        rng
      ) * amplitude
    maxValue += amplitude
    amplitude *= persistence
    frequency *= 2
  }
  return total / maxValue
}

/**
 * 將高斯模糊應用於地圖數據
 * @param {Array<Array<number>>} map - 二維地圖數據
 * @param {number} kernelSize - 模糊核心大小
 * @returns {Array<Array<number>>} 模糊後的地圖數據
 */
export function applyGaussianBlur(map, kernelSize = 3) {
  const blurredMap = Array(map.length)
    .fill()
    .map(() => Array(map[0].length).fill(0))
  const halfKernel = Math.floor(kernelSize / 2)

  function generateGaussianKernel(size, sigma = 1) {
    const kernel = []
    const center = Math.floor(size / 2)
    let sum = 0
    for (let y = 0; y < size; y++) {
      kernel[y] = []
      for (let x = 0; x < size; x++) {
        const distance = Math.sqrt(
          Math.pow(x - center, 2) + Math.pow(y - center, 2)
        )
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
      let r = 0,
        weightSum = 0
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
