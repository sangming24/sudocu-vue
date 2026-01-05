import { ref, onUnmounted } from 'vue'

export function useSudokuWorker() {
  const worker = new Worker(new URL('@/workers/sudokuGenerator.worker.js', import.meta.url), {
    type: 'module',
  })

  const isGenerating = ref(false)

  function generate(difficulty) {
    return new Promise((resolve, reject) => {
      isGenerating.value = true

      worker.onmessage = (e) => {
        isGenerating.value = false
        const { ok, result, error } = e.data
        if (ok) resolve(result)
        else reject(error)
      }

      worker.postMessage({ difficulty })
    })
  }

  onUnmounted(() => {
    worker.terminate()
  })

  return {
    generate,
    isGenerating,
  }
}
