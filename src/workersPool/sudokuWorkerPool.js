import { createSudokuWorker } from './createSudokuWorker'

export class SudokuWorkerPool {
  constructor(size = 2) {
    this.workers = Array.from({ length: size }, () => ({
      api: createSudokuWorker(),
      busy: false,
    }))
    this.queue = []
  }

  run(difficulty) {
    return new Promise((resolve, reject) => {
      this.queue.push({ difficulty, resolve, reject })
      this._next()
    })
  }

  _next() {
    const idle = this.workers.find((w) => !w.busy)
    if (!idle) return
    const job = this.queue.shift()
    if (!job) return

    idle.busy = true
    idle.api
      .run(job.difficulty)
      .then(job.resolve)
      .catch(job.reject)
      .finally(() => {
        idle.busy = false
        this._next()
      })
  }

  terminate() {
    this.workers.forEach((w) => w.api.terminate())
  }
}
