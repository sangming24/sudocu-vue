import { ref, onUnmounted } from 'vue'

let worker
const isGenerating = ref(false)

export function useSudokuWorker() {
  if (!worker) {
    worker = new Worker(new URL('@/workers/sudokuGenerator.worker.js', import.meta.url), {
      type: 'module',
    })
  }

  function generate(difficulty) {
    if (isGenerating.value) return

    isGenerating.value = true

    return new Promise((resolve, reject) => {
      worker.onmessage = (e) => {
        isGenerating.value = false
        const { type, result, error } = e.data
        if (type === 'RESULT') resolve(result)
        else reject(error)
      }

      worker.onerror = (err) => {
        isGenerating.value = false
        reject(err)
      }

      worker.postMessage({ type: 'GENERATE', difficulty })
    })
  }

  onUnmounted(() => {
    worker?.terminate()
  })

  return {
    generate,
    isGenerating,
  }
}
