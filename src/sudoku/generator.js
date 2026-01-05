// src/sudoku/generator.js

import { shuffle, cloneBoard, isSafe } from './utils'
import { logicalSolve } from './solver'

function getEmptyCountByDifficulty(difficulty) {
  switch (difficulty) {
    case 'easy':
      return 30
    case 'medium':
      return 40
    case 'hard':
      return 50
    case 'expert':
      return 60
    default:
      return 40
  }
}

function solveRandom(board) {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] === null) {
        const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])
        for (let n of nums) {
          if (isSafe(board, r, c, n)) {
            board[r][c] = n
            if (solveRandom(board)) return true
            board[r][c] = null
          }
        }
        return false
      }
    }
  }
  return true
}

function countSolutions(board, limit = 2) {
  let count = 0
  let nodes = 0
  const MAX_NODES = 20_000 // ⭐ 핵심

  function backtrack(b) {
    if (++nodes > MAX_NODES) {
      count = limit
      return
    }

    if (count >= limit) return

    for (let r = 0; r < 9; r++)
      for (let c = 0; c < 9; c++)
        if (b[r][c] === null) {
          for (let n = 1; n <= 9; n++) {
            if (isSafe(b, r, c, n)) {
              b[r][c] = n
              backtrack(b)
              b[r][c] = null
            }
          }
          return
        }
    count++
  }

  backtrack(cloneBoard(board))
  return count
}

function generatePuzzle({ board, solution, empty }) {
  solveRandom(board)
  console.log('generatePuzzle')
  // solution 저장
  for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) solution[i][j] = board[i][j]

  const cells = shuffle([...Array(81).keys()])
  let attempts = 0

  for (let idx of cells) {
    console.log('generatePuzzle for', attempts, empty)
    if (empty <= 0 || attempts > 100) break
    attempts++

    const r = Math.floor(idx / 9)
    const c = idx % 9

    const backup = board[r][c]
    board[r][c] = null

    if (countSolutions(board) !== 1) {
      board[r][c] = backup
    } else {
      empty--
    }
  }
}

function evaluatePuzzleDifficulty(puzzle) {
  const test = cloneBoard(puzzle)
  return logicalSolve(test)
}

function matchDifficulty(result, difficulty) {
  if (!result.solved) return false

  const max = result.maxTechnique

  switch (difficulty) {
    case 'easy':
      // NakedSingle만으로 해결
      return max === 'NakedSingle'

    case 'medium':
      // HiddenSingle까지 허용
      return max === 'HiddenSingle'

    case 'hard':
      return max === 'NakedPair' || max === 'Pointing'

    case 'expert':
      return max === 'Claiming'

    default:
      return false
  }
}

function generateByLogic(difficulty) {
  let tries = 0

  console.log('generateByLogic', tries)
  while (tries < 200) {
    console.log('while', tries)
    tries++

    // 1. 보드 초기화
    const board = Array.from({ length: 9 }, () => Array(9).fill(null))
    const solution = Array.from({ length: 9 }, () => Array(9).fill(null))

    // 2. 기존 퍼즐 생성
    const emptyCount = getEmptyCountByDifficulty(difficulty)
    generatePuzzle({ board, solution, empty: emptyCount })

    // 2. Solver로 난이도 평가
    const result = evaluatePuzzleDifficulty(board)

    // 3. 난이도 조건 검사
    if (matchDifficulty(result, difficulty)) {
      console.log('퍼즐 생성 성공', result)
      return { puzzle: board, solution }
    }

    console.log('tries', tries)
  }

  if (tries >= 200) {
    console.warn('퍼즐 생성 실패 → fallback')
    return null
  }
}

export { generateByLogic, evaluatePuzzleDifficulty }
