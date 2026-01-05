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
  // solution 저장
  for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) solution[i][j] = board[i][j]

  const cells = shuffle([...Array(81).keys()])
  let attempts = 0

  for (let idx of cells) {
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
  const t = result.techniquesUsed

  if (difficulty === 'expert') {
    // C단계 퍼즐 허용
    return result.stalled && result.stallReason === 'noMoreLogicalMoves'
  }

  if (!result.solved || result.stalled) return false

  switch (difficulty) {
    case 'easy':
      return t.NakedSingle && !t.HiddenSingle && !t.NakedPair && !t.Pointing && !t.Claiming

    case 'medium':
      return t.HiddenSingle && !t.NakedPair && !t.Pointing && !t.Claiming

    case 'hard':
      return t.NakedPair || t.Pointing

    case 'expert':
      return t.Claiming || (result.stalled && !result.solved)

    default:
      return false
  }
}

function generateByLogic(difficulty) {
  let tries = 0

  while (tries < 200) {
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
    if (difficulty === 'expert') {
      if (result.stalled && !result.solved) {
        const analysis = analyzeOneGuess(board)

        if (analysis.solved) {
          console.log('C단계 퍼즐 확정', analysis)
          return { puzzle: board, solution }
        }
      }
    } else {
      if (matchDifficulty(result, difficulty)) {
        console.log('퍼즐 생성 성공', result)
        return { puzzle: board, solution }
      }
    }
    console.log('퍼즐 생성 실패', result)
  }

  if (tries >= 200) {
    console.warn('퍼즐 생성 실패 → fallback')
    return null
  }
}

function analyzeOneGuess(board) {
  let guessCount = 0
  let maxCandidates = 0

  function tryGuess(b) {
    const result = logicalSolve(b)

    if (result.solved) return true
    if (!result.stalled) return false

    // 후보가 가장 적은 셀 찾기
    let target = null
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (b[r][c] === null) {
          const candidates = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((n) => isSafe(b, r, c, n))
          if (!target || candidates.length < target.candidates.length) {
            target = { r, c, candidates }
          }
        }
      }
    }

    if (!target) return false

    maxCandidates = Math.max(maxCandidates, target.candidates.length)

    for (let n of target.candidates) {
      guessCount++
      const copy = cloneBoard(b)
      copy[target.r][target.c] = n
      if (logicalSolve(copy).solved) {
        return true
      }
    }

    return false
  }

  const solved = tryGuess(cloneBoard(board))

  return {
    solved,
    guessCount,
    maxCandidates,
  }
}

export { generateByLogic, evaluatePuzzleDifficulty }
