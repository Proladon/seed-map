/**
 * 基於種子的隨機數生成器
 * 用於確保相同種子產生相同的隨機序列
 */
export default class SeededRandom {
  /**
   * 構造函數
   * @param {number} seed - 隨機數種子
   */
  constructor(seed) {
    this.seed = seed % 2147483647
    if (this.seed <= 0) this.seed += 2147483646
  }

  /**
   * 生成下一個 0-1 之間的隨機數
   * @returns {number} 0-1 之間的隨機浮點數
   */
  next() {
    this.seed = (this.seed * 16807) % 2147483647
    return this.seed / 2147483647
  }

  /**
   * 生成指定範圍內的隨機整數
   * @param {number} min - 範圍最小值（包含）
   * @param {number} max - 範圍最大值（包含）
   * @returns {number} 範圍內的隨機整數
   */
  nextInt(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min
  }
}
