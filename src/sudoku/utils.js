// src/sudoku/utils.js

// 배열 섞기
export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// 9x9 보드 복사
export function cloneBoard(board) {
  return board.map((row) => row.slice())
}

// 특정 위치에 num이 가능한지
export function isSafe(board, row, col, num) {
  for (let i = 0; i < 9; i++) {
    if (board[row][i] === num) return false
    if (board[i][col] === num) return false
  }

  const sr = Math.floor(row / 3) * 3
  const sc = Math.floor(col / 3) * 3
  for (let r = sr; r < sr + 3; r++) {
    for (let c = sc; c < sc + 3; c++) {
      if (board[r][c] === num) return false
    }
  }
  return true
}

// 현재 보드 상태가 규칙 위반인지
export function checkBoardSafety(board) {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const v = board[r][c]
      if (!v) continue
      board[r][c] = null
      if (!isSafe(board, r, c, v)) {
        board[r][c] = v
        return false
      }
      board[r][c] = v
    }
  }
  return true
}

// board 기준으로 num이 가능한지 (alias 느낌)
export function isPossibleByBoard(board, row, col, num) {
  return isSafe(board, row, col, num)
}
