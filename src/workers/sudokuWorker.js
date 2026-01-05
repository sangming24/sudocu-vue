import { generateByLogic } from '../sudoku/generator'

self.onmessage = (e) => {
  const { type, difficulty } = e.data
  console.log('type', type)
  console.log('difficulty', difficulty)
  if (type === 'GENERATE') {
    const result = generateByLogic(difficulty)

    self.postMessage({
      type: 'RESULT',
      result,
    })
  }
}
