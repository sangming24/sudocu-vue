// workersPool/SudokuBoardStore.js

export class SudokuBoardStore {
  constructor(pool) {
    this.pool = pool

    // 난이도별 재고
    this.stock = {
      easy: [],
      medium: [],
      hard: [],
      veryHard: [],
    }

    // 목표 재고 수
    this.target = {
      easy: 2,
      medium: 2,
      hard: 4,
      veryHard: 5,
    }

    // refill 트리거 기준 (low-watermark)
    this.low = {
      easy: 1,
      medium: 1,
      hard: 2,
      veryHard: 4,
    }

    // 중복 refill 방지
    this.refilling = {
      easy: false,
      medium: false,
      hard: false,
      veryHard: false,
    }

    // refill 우선순위 (중요)
    this.priority = ['veryHard', 'hard', 'medium', 'easy']
  }

  /**
   * 앱 시작 시 호출
   */
  warmUp() {
    this._refillByPriority()
  }

  /**
   * Vue에서 호출하는 메인 API
   */
  async getBoard(difficulty) {
    const queue = this.stock[difficulty]

    // 재고 있으면 즉시 반환
    if (queue.length > 0) {
      const board = queue.shift()
      this._logStock()

      // low-watermark 체크 → 백그라운드 refill
      if (queue.length <= this.low[difficulty]) {
        this._refillByPriority(difficulty)
      }

      return board
    }

    // 재고 없으면 즉시 생성 (fallback)
    return this._generateOne(difficulty)
  }

  /**
   * 재고 채우기 (백그라운드)
   */
  _refillByPriority() {
    for (const difficulty of this.priority) {
      this._refill(difficulty)
    }
  }

  _refill(difficulty) {
    if (this.refilling[difficulty]) return

    const current = this.stock[difficulty].length
    const need = this.target[difficulty] - current

    if (need <= 0) return

    this.refilling[difficulty] = true

    const jobs = Array.from({ length: need }, () => this.pool.run(difficulty))

    jobs.forEach((job) => {
      job.then((board) => {
        this.stock[difficulty].push(board)
        this._logStock()
      })
    })

    Promise.allSettled(jobs).finally(() => {
      this.refilling[difficulty] = false
    })
  }

  /**
   * 재고 0일 때의 안전망
   */
  _generateOne(difficulty) {
    return this.pool.run(difficulty)
  }

  /* ------------------ debug ------------------ */

  _logStock() {
    console.log(
      `[SudokuStock] ` +
        `easy:${this.stock.easy.length} | ` +
        `medium:${this.stock.medium.length} | ` +
        `hard:${this.stock.hard.length} | ` +
        `veryHard:${this.stock.veryHard.length}`,
    )
  }
}
