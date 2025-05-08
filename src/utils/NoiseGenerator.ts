import SeededRandom from './SeededRandom'

/**
 * 生成簡單柏林噪聲值
 * @param x - x座標
 * @param y - y座標
 * @param rng - 隨機數生成器
 * @param scale - 噪聲尺度
 * @returns 0-1 之間的噪聲值
 */
export function generateSimplexNoise(
  x: number,
  y: number,
  rng: SeededRandom,
  scale: number = 1,
): number {
  const xPrime = x + rng.next() * 0.2
  const yPrime = y + rng.next() * 0.2
  const hash = Math.sin(xPrime * 12.9898 * scale + yPrime * 78.233 * scale) * 43758.5453
  return hash - Math.floor(hash)
}

/**
 * 生成多層疊加的柏林噪聲
 * @param x - x座標
 * @param y - y座標
 * @param rng - 隨機數生成器
 * @param octaves - 噪聲層數
 * @param persistence - 每層噪聲衰減係數
 * @param scale - 噪聲尺度
 * @returns 0-1 之間的噪聲值
 */
export function generateOctaveNoise(
  x: number,
  y: number,
  rng: SeededRandom,
  octaves: number = 1,
  persistence: number = 0.5,
  scale: number = 1,
): number {
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
        rng,
      ) * amplitude
    maxValue += amplitude
    amplitude *= persistence
    frequency *= 2
  }
  return total / maxValue
}

/**
 * 將高斯模糊應用於地圖數據
 * @param map - 二維地圖數據
 * @param kernelSize - 模糊核心大小
 * @returns 模糊後的地圖數據
 */
export function applyGaussianBlur(map: number[][], kernelSize: number = 3): number[][] {
  const blurredMap: number[][] = Array(map.length)
    .fill(null)
    .map(() => Array(map[0].length).fill(0))
  const halfKernel = Math.floor(kernelSize / 2)

  function generateGaussianKernel(size: number, sigma: number = 1): number[][] {
    const kernel: number[][] = []
    const center = Math.floor(size / 2)
    let sum = 0
    for (let y = 0; y < size; y++) {
      kernel[y] = []
      for (let x = 0; x < size; x++) {
        const distance = Math.sqrt(Math.pow(x - center, 2) + Math.pow(y - center, 2))
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
      blurredMap[y][x] = r / weightSum
    }
  }
  return blurredMap
}
