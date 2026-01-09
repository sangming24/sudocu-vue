export function createSudokuWorker() {
  const worker = new Worker(new URL('@/workers/sudokuGenerator.worker.js', import.meta.url), {
    type: 'module',
  })

  return {
    run(difficulty) {
      return new Promise((resolve, reject) => {
        worker.onmessage = (e) => {
          const { type, result, error } = e.data
          if (type === 'RESULT') resolve(result)
          else reject(error)
        }

        worker.onerror = reject

        worker.postMessage({ type: 'GENERATE', difficulty })
      })
    },
    terminate() {
      worker.terminate()
    },
  }
}
