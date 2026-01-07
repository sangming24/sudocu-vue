import { generateByLogic } from '@/sudoku/generator'

self.onmessage = (e) => {
  const { type, difficulty } = e.data

  try {
    if (type === 'GENERATE') {
      const result = generateByLogic(difficulty)

      self.postMessage({
        type: 'RESULT',
        result,
      })
    }
  } catch (err) {
    self.postMessage({
      type: 'ERROR',
      error: err?.message ?? 'generator error',
    })
  }
}
