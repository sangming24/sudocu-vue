import { isPossibleByBoard } from '@/sudoku/utils'

export function useSudoku() {
  function mergedBoard(board, userBoard) {
    return board.map((r, i) => r.map((c, j) => c ?? userBoard[i][j].value))
  }

  function getCandidatesByBoard(b, r, c) {
    if (b[r][c] !== null) return []
    const res = []
    for (let n = 1; n <= 9; n++) {
      if (isPossibleByBoard(b, r, c, n)) res.push(n)
    }
    return res
  }

  function removeCandidates(userBoard, solution, r, c, num) {
    // solution 기준으로 체크
    if (solution[r][c] !== num) return

    // 같은 행 / 열
    for (let i = 0; i < 9; i++) {
      if (i !== c) userBoard[r][i].candidates = userBoard[r][i].candidates.filter((n) => n !== num)
      if (i !== r) userBoard[i][c].candidates = userBoard[i][c].candidates.filter((n) => n !== num)
    }

    // 같은 3x3 박스
    const sr = Math.floor(r / 3) * 3
    const sc = Math.floor(c / 3) * 3
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) {
        const rr = sr + i
        const cc = sc + j
        if (rr !== r || cc !== c) {
          userBoard[rr][cc].candidates = userBoard[rr][cc].candidates.filter((n) => n !== num)
        }
      }
  }

  return {
    mergedBoard,
    getCandidatesByBoard,
    removeCandidates,
  }
}
