/**
 * 基於種子的隨機數生成器
 * 用於確保相同種子產生相同的隨機序列
 */
export default class SeededRandom {
  private seed: number

  /**
   * 構造函數
   * @param seed - 隨機數種子
   */
  constructor(seed: number) {
    this.seed = seed % 2147483647
    if (this.seed <= 0) this.seed += 2147483646
  }

  /**
   * 生成下一個 0-1 之間的隨機數
   * @returns 0-1 之間的隨機浮點數
   */
  next(): number {
    this.seed = (this.seed * 16807) % 2147483647
    return this.seed / 2147483647
  }

  /**
   * 生成指定範圍內的隨機整數
   * @param min - 範圍最小值（包含）
   * @param max - 範圍最大值（包含）
   * @returns 範圍內的隨機整數
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min
  }
}
