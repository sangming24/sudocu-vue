import { generateByLogic } from '@/sudoku/generator'

self.onmessage = (e) => {
  const { difficulty } = e.data

  try {
    const result = generateByLogic(difficulty)

    self.postMessage({
      ok: true,
      result,
    })
  } catch (err) {
    self.postMessage({
      ok: false,
      error: err?.message ?? 'generator error',
    })
  }
}
