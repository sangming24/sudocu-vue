// src/sudoku/generator.js

import { shuffle, cloneBoard, isSafe } from './utils'
import { logicalSolve } from './solver'

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

function quickEvaluate(board, difficulty) {
  const result = logicalSolve(cloneBoard(board))

  // 논리 실패
  if (!result.solved && result.stalled) return 'fail'

  const singles = result.techniquesUsed.NakedSingle + result.techniquesUsed.HiddenSingle

  // 고급 기법 감지
  const hasAdvanced =
    result.techniquesUsed.XWing +
      result.techniquesUsed.TwoStringKite +
      result.techniquesUsed.Skyscraper +
      result.techniquesUsed.WWing >
    0

  if (difficulty === 'easy') {
    const hasAdvanced =
      result.techniquesUsed.NakedPair +
        result.techniquesUsed.NakedTriple +
        result.techniquesUsed.Pointing +
        result.techniquesUsed.Claiming +
        result.techniquesUsed.XWing +
        result.techniquesUsed.TwoStringKite +
        result.techniquesUsed.Skyscraper +
        result.techniquesUsed.WWing >
      0

    if (hasAdvanced) return 'tooHard'
  }

  if (difficulty === 'medium') {
    if (singles > 30) return 'tooEasy'
  }

  if (difficulty === 'hard') {
    if (singles > 20) return 'tooEasy'
  }

  if (difficulty === 'veryHard') {
    // veryHard 핵심
    if (singles > 15) return 'tooEasy'
    if (!hasAdvanced && singles > 10) return 'tooEasy'
  }

  return 'ok'
}

function hasAdvancedTechnique(result) {
  return (
    result.techniquesUsed.XWing +
      result.techniquesUsed.TwoStringKite +
      result.techniquesUsed.Skyscraper +
      result.techniquesUsed.WWing >
    0
  )
}

function evaluatePuzzleDifficulty(puzzle) {
  const test = cloneBoard(puzzle)
  return logicalSolve(test)
}

function generateByLogic(difficulty) {
  let tries = 0
  const MAX_TRIES = difficulty === 'veryHard' ? 300 : 200

  const tm0 = performance.now()
  while (tries < MAX_TRIES) {
    tries++

    // 1. 보드 초기화
    const board = Array.from({ length: 9 }, () => Array(9).fill(null))
    const solution = Array.from({ length: 9 }, () => Array(9).fill(null))

    // 2. 기존 퍼즐 생성
    const removed = generatePuzzleWithRollback({ board, solution, difficulty })

    // 3. Solver로 난이도 평가
    const result = evaluatePuzzleDifficulty(board)

    // 4. 난이도 조건 검사
    if (matchDifficulty(result, difficulty)) {
      if (difficulty === 'veryHard') {
        const nonSingle =
          result.techniquesUsed.NakedPair +
          result.techniquesUsed.NakedTriple +
          result.techniquesUsed.Pointing +
          result.techniquesUsed.Claiming +
          result.techniquesUsed.XWing +
          result.techniquesUsed.TwoStringKite +
          result.techniquesUsed.Skyscraper +
          result.techniquesUsed.WWing

        if (nonSingle < 2) continue
      }

      const tm1 = performance.now()
      console.log(
        '생성 시간 : ',
        ((tm1 - tm0) / 1000).toFixed(3),
        's, 시도 횟수 : ',
        tries,
        ' 빈칸 수 : ',
        removed,
      )
      console.log('퍼즐 생성 성공', result)
      return { puzzle: board, solution }
    }
  }

  if (tries >= 200) {
    const tm1 = performance.now()
    console.log('생성 시간 : ', ((tm1 - tm0) / 1000).toFixed(3), 's')
    console.log('퍼즐 생성 실패 → fallback')
    return null
  }
}

function generatePuzzleWithRollback({ board, solution, difficulty }) {
  solveRandom(board)

  // solution 저장
  for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) solution[i][j] = board[i][j]

  const cells = shuffle([...Array(81).keys()])
  let removed = 0
  let fails = 0

  for (let idx of cells) {
    const r = Math.floor(idx / 9)
    const c = idx % 9
    if (board[r][c] === null) continue

    const backup = board[r][c]
    board[r][c] = null

    // (1) 유일해 유지
    if (countSolutions(board) !== 1) {
      board[r][c] = backup
      continue
    }

    // (2) 논리 간이 평가
    const status = quickEvaluate(board, difficulty)

    if (status === 'fail') {
      board[r][c] = backup
      fails++
      continue
    }

    // easy에서 고급 기법 발생 → rollback
    if (status === 'tooHard') {
      board[r][c] = backup
      fails++
      continue
    }

    removed++

    if (difficulty === 'veryHard' && removed >= 45) {
      const evalResult = logicalSolve(cloneBoard(board))
      if (hasAdvancedTechnique(evalResult)) {
        break
      }
    }

    // 시간 폭주 방지
    if (fails > 30) break
  }

  return removed
}

function matchDifficulty(result, difficulty) {
  // 논리로 안 풀리면 재생성
  if (!result.solved) return false

  const s = result.score

  switch (difficulty) {
    case 'easy':
      return s < 1.5
    case 'medium':
      return s >= 1.5 && s < 3.5
    case 'hard':
      return s >= 3.5 && s < 6
    case 'veryHard':
      return s >= 6
    default:
      return false
  }
}

export { generateByLogic, evaluatePuzzleDifficulty }
