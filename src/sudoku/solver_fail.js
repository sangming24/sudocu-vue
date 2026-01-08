// src/sudoku/solver.js
/* ------------------------------------------------------------------
 * Solver Board
 * ------------------------------------------------------------------ */

import { cloneBoard } from './utils'

const TECHNIQUE_WEIGHT = {
  NakedSingle: 0.1,
  HiddenSingle: 0.2,

  NakedPair: 1.0,
  NakedTriple: 1.4,

  Pointing: 1.2,
  Claiming: 1.3,

  XWing: 2.5,
  TwoStringKite: 2.8,
  Skyscraper: 3.0,
  WWing: 3.2,
}

function makeSolverCell(value, r, c) {
  return {
    value,
    candidates: value ? [] : [1, 2, 3, 4, 5, 6, 7, 8, 9],
    r,
    c,
  }
}

function buildSolverBoard(board) {
  const sb = board.map((row, r) => row.map((v, c) => makeSolverCell(v, r, c)))

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (sb[r][c].value) {
        eliminateFromPeers(sb, r, c, sb[r][c].value)
      }
    }
  }
  return sb
}

function removeCandidate(cell, num) {
  const idx = cell.candidates.indexOf(num)
  if (idx !== -1) {
    cell.candidates.splice(idx, 1)
    return true
  }
  return false
}

function eliminateFromPeers(sb, row, col, num) {
  for (let i = 0; i < 9; i++) {
    if (i !== col) removeCandidate(sb[row][i], num)
    if (i !== row) removeCandidate(sb[i][col], num)
  }

  const sr = Math.floor(row / 3) * 3
  const sc = Math.floor(col / 3) * 3
  for (let r = sr; r < sr + 3; r++) {
    for (let c = sc; c < sc + 3; c++) {
      if (r !== row || c !== col) {
        removeCandidate(sb[r][c], num)
      }
    }
  }
}

/* ------------------------------------------------------------------
 * Techniques
 * ------------------------------------------------------------------ */

function applyNakedSinglesSB(sb) {
  let filled = 0
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const cell = sb[r][c]
      if (!cell.value && cell.candidates.length === 1) {
        cell.value = cell.candidates[0]
        cell.candidates = []
        eliminateFromPeers(sb, r, c, cell.value)
        filled++
      }
    }
  }
  return filled
}

function applyHiddenSinglesSB(sb) {
  let filled = 0

  const checkUnit = (cells) => {
    for (let num = 1; num <= 9; num++) {
      const spots = cells.filter((c) => !c.value && c.candidates.includes(num))
      if (spots.length === 1) {
        spots[0].value = num
        spots[0].candidates = []
        eliminateFromPeers(sb, spots[0].r, spots[0].c, num)
        filled++
      }
    }
  }

  for (let i = 0; i < 9; i++) {
    checkUnit(sb[i]) // row
    checkUnit(sb.map((r) => r[i])) // col
  }

  for (let sr = 0; sr < 9; sr += 3) {
    for (let sc = 0; sc < 9; sc += 3) {
      const cells = []
      for (let r = sr; r < sr + 3; r++) {
        for (let c = sc; c < sc + 3; c++) {
          cells.push(sb[r][c])
        }
      }
      checkUnit(cells)
    }
  }

  return filled
}

function applyNakedPairsSB(sb) {
  let eliminated = 0

  const processUnit = (cells) => {
    const pairs = {}
    cells.forEach((cell) => {
      if (!cell.value && cell.candidates.length === 2) {
        const key = cell.candidates.join(',')
        pairs[key] = (pairs[key] || 0) + 1
      }
    })

    for (const key in pairs) {
      if (pairs[key] === 2) {
        const nums = key.split(',').map(Number)
        cells.forEach((cell) => {
          if (!cell.value && cell.candidates.join(',') !== key) {
            nums.forEach((n) => {
              if (cell.candidates.includes(n)) {
                if (removeCandidate(cell, n)) {
                  eliminated++
                }
              }
            })
          }
        })
      }
    }
  }

  for (let i = 0; i < 9; i++) {
    processUnit(sb[i])
    processUnit(sb.map((r) => r[i]))
  }

  for (let sr = 0; sr < 9; sr += 3) {
    for (let sc = 0; sc < 9; sc += 3) {
      const cells = []
      for (let r = sr; r < sr + 3; r++) {
        for (let c = sc; c < sc + 3; c++) {
          cells.push(sb[r][c])
        }
      }
      processUnit(cells)
    }
  }

  return eliminated
}

function applyNakedTriplesSB(sb) {
  let eliminated = 0

  const processUnit = (cells) => {
    const candidatesMap = []

    cells.forEach((cell) => {
      if (!cell.value && cell.candidates.length >= 2 && cell.candidates.length <= 3) {
        candidatesMap.push(cell)
      }
    })

    for (let i = 0; i < candidatesMap.length; i++) {
      for (let j = i + 1; j < candidatesMap.length; j++) {
        for (let k = j + 1; k < candidatesMap.length; k++) {
          const union = new Set([
            ...candidatesMap[i].candidates,
            ...candidatesMap[j].candidates,
            ...candidatesMap[k].candidates,
          ])

          if (union.size === 3) {
            const nums = [...union]

            cells.forEach((cell) => {
              if (
                cell !== candidatesMap[i] &&
                cell !== candidatesMap[j] &&
                cell !== candidatesMap[k] &&
                !cell.value
              ) {
                nums.forEach((n) => {
                  if (removeCandidate(cell, n)) {
                    eliminated++
                  }
                })
              }
            })
          }
        }
      }
    }
  }

  for (let i = 0; i < 9; i++) {
    processUnit(sb[i]) // row
    processUnit(sb.map((r) => r[i])) // col
  }

  for (let sr = 0; sr < 9; sr += 3) {
    for (let sc = 0; sc < 9; sc += 3) {
      const cells = []
      for (let r = sr; r < sr + 3; r++) for (let c = sc; c < sc + 3; c++) cells.push(sb[r][c])

      processUnit(cells)
    }
  }

  return eliminated
}

function applyPointingPairSB(sb) {
  let eliminated = 0

  for (let sr = 0; sr < 9; sr += 3) {
    for (let sc = 0; sc < 9; sc += 3) {
      for (let num = 1; num <= 9; num++) {
        const positions = []
        for (let r = sr; r < sr + 3; r++) {
          for (let c = sc; c < sc + 3; c++) {
            if (!sb[r][c].value && sb[r][c].candidates.includes(num)) {
              positions.push({ r, c })
            }
          }
        }

        if (positions.length === 2 || positions.length === 3) {
          const sameRow = positions.every((p) => p.r === positions[0].r)
          const sameCol = positions.every((p) => p.c === positions[0].c)

          if (sameRow) {
            const row = positions[0].r
            for (let c = 0; c < 9; c++) {
              if (c < sc || c >= sc + 3) {
                if (removeCandidate(sb[row][c], num)) {
                  eliminated++
                }
              }
            }
          }

          if (sameCol) {
            const col = positions[0].c
            for (let r = 0; r < 9; r++) {
              if (r < sr || r >= sr + 3) {
                if (removeCandidate(sb[r][col], num)) {
                  eliminated++
                }
              }
            }
          }
        }
      }
    }
  }

  return eliminated
}
function applyClaimingPairSB(sb) {
  let eliminated = 0

  // ===== Row → Box Claiming =====
  for (let r = 0; r < 9; r++) {
    for (let num = 1; num <= 9; num++) {
      const cells = []

      for (let c = 0; c < 9; c++) {
        const cell = sb[r][c]
        if (!cell.value && cell.candidates.includes(num)) {
          cells.push(cell)
        }
      }

      if (cells.length < 2) continue

      const boxes = new Set(cells.map((cell) => Math.floor(cell.c / 3)))
      if (boxes.size !== 1) continue

      const box = [...boxes][0]
      const sr = Math.floor(r / 3) * 3
      const sc = box * 3

      for (let rr = sr; rr < sr + 3; rr++) {
        if (rr === r) continue
        for (let cc = sc; cc < sc + 3; cc++) {
          if (removeCandidate(sb[rr][cc], num)) {
            eliminated++
          }
        }
      }
    }
  }

  // ===== Column → Box Claiming =====
  for (let c = 0; c < 9; c++) {
    for (let num = 1; num <= 9; num++) {
      const cells = []

      for (let r = 0; r < 9; r++) {
        const cell = sb[r][c]
        if (!cell.value && cell.candidates.includes(num)) {
          cells.push(cell)
        }
      }

      if (cells.length < 2) continue

      const boxes = new Set(cells.map((cell) => Math.floor(cell.r / 3)))
      if (boxes.size !== 1) continue

      const box = [...boxes][0]
      const sr = box * 3
      const sc = Math.floor(c / 3) * 3

      for (let rr = sr; rr < sr + 3; rr++) {
        for (let cc = sc; cc < sc + 3; cc++) {
          if (cc === c) continue
          if (removeCandidate(sb[rr][cc], num)) {
            eliminated++
          }
        }
      }
    }
  }

  return eliminated
}
function applyXWingSB(sb) {
  let eliminated = 0

  for (let num = 1; num <= 9; num++) {
    // ===== Row-based X-Wing =====
    const rows = []

    for (let r = 0; r < 9; r++) {
      const cols = []
      for (let c = 0; c < 9; c++) {
        const cell = sb[r][c]
        if (!cell.value && cell.candidates.includes(num)) {
          cols.push(c)
        }
      }
      if (cols.length === 2) {
        rows.push({ r, cols })
      }
    }

    for (let i = 0; i < rows.length; i++) {
      for (let j = i + 1; j < rows.length; j++) {
        const a = rows[i]
        const b = rows[j]

        if (a.cols[0] === b.cols[0] && a.cols[1] === b.cols[1]) {
          const c1 = a.cols[0]
          const c2 = a.cols[1]

          for (let rr = 0; rr < 9; rr++) {
            if (rr !== a.r && rr !== b.r) {
              if (removeCandidate(sb[rr][c1], num)) eliminated++
              if (removeCandidate(sb[rr][c2], num)) eliminated++
            }
          }
        }
      }
    }

    // ===== Column-based X-Wing =====
    const cols = []

    for (let c = 0; c < 9; c++) {
      const rowsInCol = []
      for (let r = 0; r < 9; r++) {
        const cell = sb[r][c]
        if (!cell.value && cell.candidates.includes(num)) {
          rowsInCol.push(r)
        }
      }
      if (rowsInCol.length === 2) {
        cols.push({ c, rows: rowsInCol })
      }
    }

    for (let i = 0; i < cols.length; i++) {
      for (let j = i + 1; j < cols.length; j++) {
        const a = cols[i]
        const b = cols[j]

        if (a.rows[0] === b.rows[0] && a.rows[1] === b.rows[1]) {
          const r1 = a.rows[0]
          const r2 = a.rows[1]

          for (let cc = 0; cc < 9; cc++) {
            if (cc !== a.c && cc !== b.c) {
              if (removeCandidate(sb[r1][cc], num)) eliminated++
              if (removeCandidate(sb[r2][cc], num)) eliminated++
            }
          }
        }
      }
    }
  }

  return eliminated
}

function applyTwoStringKiteSB(sb) {
  let eliminated = 0

  for (let num = 1; num <= 9; num++) {
    // ===== Row strong links =====
    const rowLinks = []

    for (let r = 0; r < 9; r++) {
      const cells = []
      for (let c = 0; c < 9; c++) {
        const cell = sb[r][c]
        if (!cell.value && cell.candidates.includes(num)) {
          cells.push({ r, c })
        }
      }
      if (cells.length === 2) {
        rowLinks.push(cells)
      }
    }

    // ===== Column strong links =====
    const colLinks = []

    for (let c = 0; c < 9; c++) {
      const cells = []
      for (let r = 0; r < 9; r++) {
        const cell = sb[r][c]
        if (!cell.value && cell.candidates.includes(num)) {
          cells.push({ r, c })
        }
      }
      if (cells.length === 2) {
        colLinks.push(cells)
      }
    }

    // ===== Kite detection =====
    rowLinks.forEach(([r1, r2]) => {
      colLinks.forEach(([c1, c2]) => {
        // 교차 셀 찾기
        const cross =
          (r1.r === c1.r && r1.c === c1.c && r2.c !== c2.c) ||
          (r1.r === c2.r && r1.c === c2.c && r2.c !== c1.c) ||
          (r2.r === c1.r && r2.c === c1.c && r1.c !== c2.c) ||
          (r2.r === c2.r && r2.c === c2.c && r1.c !== c1.c)

        if (!cross) return

        // 교차하지 않는 두 끝점
        const rowEnd = r1.r === c1.r && r1.c === c1.c ? r2 : r1
        const colEnd = c1.r === r1.r && c1.c === r1.c ? c2 : c1

        // 제거 대상: 두 끝점 모두와 peer
        for (let r = 0; r < 9; r++) {
          for (let c = 0; c < 9; c++) {
            const cell = sb[r][c]
            if (cell.value || !cell.candidates.includes(num)) continue

            const peerRowEnd =
              r === rowEnd.r || c === rowEnd.c || Math.floor(r / 3) === Math.floor(rowEnd.r / 3)

            const peerColEnd =
              r === colEnd.r || c === colEnd.c || Math.floor(c / 3) === Math.floor(colEnd.c / 3)

            if (peerRowEnd && peerColEnd) {
              if (removeCandidate(cell, num)) eliminated++
            }
          }
        }
      })
    })
  }

  return eliminated
}

function applySkyscraperSB(sb) {
  let eliminated = 0

  for (let num = 1; num <= 9; num++) {
    // ===== Row-based Skyscraper =====
    const rows = []

    for (let r = 0; r < 9; r++) {
      const cols = []
      for (let c = 0; c < 9; c++) {
        const cell = sb[r][c]
        if (!cell.value && cell.candidates.includes(num)) {
          cols.push(c)
        }
      }
      if (cols.length === 2) {
        rows.push({ r, cols })
      }
    }

    for (let i = 0; i < rows.length; i++) {
      for (let j = i + 1; j < rows.length; j++) {
        const a = rows[i]
        const b = rows[j]

        const common = a.cols.filter((c) => b.cols.includes(c))
        if (common.length !== 1) continue // X-Wing / 무관 구조 제외

        const sharedCol = common[0]
        const otherColA = a.cols.find((c) => c !== sharedCol)
        const otherColB = b.cols.find((c) => c !== sharedCol)

        // 제거 대상: 두 "다른" 칸이 동시에 보는 셀
        for (let r = 0; r < 9; r++) {
          for (let c = 0; c < 9; c++) {
            const cell = sb[r][c]
            if (cell.value || !cell.candidates.includes(num)) continue

            // 두 other cell과 모두 peer 인 경우
            const peerA = r === a.r || c === otherColA || Math.floor(r / 3) === Math.floor(a.r / 3)
            const peerB = r === b.r || c === otherColB || Math.floor(r / 3) === Math.floor(b.r / 3)

            if (peerA && peerB) {
              if (removeCandidate(cell, num)) eliminated++
            }
          }
        }
      }
    }

    // ===== Column-based Skyscraper =====
    const cols = []

    for (let c = 0; c < 9; c++) {
      const rowsInCol = []
      for (let r = 0; r < 9; r++) {
        const cell = sb[r][c]
        if (!cell.value && cell.candidates.includes(num)) {
          rowsInCol.push(r)
        }
      }
      if (rowsInCol.length === 2) {
        cols.push({ c, rows: rowsInCol })
      }
    }

    for (let i = 0; i < cols.length; i++) {
      for (let j = i + 1; j < cols.length; j++) {
        const a = cols[i]
        const b = cols[j]

        const common = a.rows.filter((r) => b.rows.includes(r))
        if (common.length !== 1) continue

        const sharedRow = common[0]
        const otherRowA = a.rows.find((r) => r !== sharedRow)
        const otherRowB = b.rows.find((r) => r !== sharedRow)

        for (let r = 0; r < 9; r++) {
          for (let c = 0; c < 9; c++) {
            const cell = sb[r][c]
            if (cell.value || !cell.candidates.includes(num)) continue

            const peerA = r === otherRowA || c === a.c || Math.floor(c / 3) === Math.floor(a.c / 3)
            const peerB = r === otherRowB || c === b.c || Math.floor(c / 3) === Math.floor(b.c / 3)

            if (peerA && peerB) {
              if (removeCandidate(cell, num)) eliminated++
            }
          }
        }
      }
    }
  }

  return eliminated
}

function applyWWingSB(sb) {
  let eliminated = 0

  // ===== Naked Pair 수집 =====
  const pairs = []

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const cell = sb[r][c]
      if (!cell.value && cell.candidates.length === 2) {
        pairs.push({
          r,
          c,
          nums: [...cell.candidates],
        })
      }
    }
  }

  // ===== Pair 쌍 검사 =====
  for (let i = 0; i < pairs.length; i++) {
    for (let j = i + 1; j < pairs.length; j++) {
      const a = pairs[i]
      const b = pairs[j]

      // 같은 Pair인지
      if (a.nums[0] !== b.nums[0] || a.nums[1] !== b.nums[1]) continue

      // 서로 peer면 W-Wing 아님
      const sameRow = a.r === b.r
      const sameCol = a.c === b.c
      const sameBox =
        Math.floor(a.r / 3) === Math.floor(b.r / 3) && Math.floor(a.c / 3) === Math.floor(b.c / 3)

      if (sameRow || sameCol || sameBox) continue

      const [x, y] = a.nums

      // ===== strong link 숫자 찾기 =====
      ;[x, y].forEach((linkNum) => {
        // row strong link
        for (let r = 0; r < 9; r++) {
          const cells = []
          for (let c = 0; c < 9; c++) {
            if (!sb[r][c].value && sb[r][c].candidates.includes(linkNum)) {
              cells.push({ r, c })
            }
          }
          if (
            cells.length === 2 &&
            ((cells[0].r === a.r &&
              cells[0].c === a.c &&
              cells[1].r === b.r &&
              cells[1].c === b.c) ||
              (cells[1].r === a.r &&
                cells[1].c === a.c &&
                cells[0].r === b.r &&
                cells[0].c === b.c))
          ) {
            eliminateWWing(sb, a, b, x, y, linkNum)
          }
        }

        // col strong link
        for (let c = 0; c < 9; c++) {
          const cells = []
          for (let r = 0; r < 9; r++) {
            if (!sb[r][c].value && sb[r][c].candidates.includes(linkNum)) {
              cells.push({ r, c })
            }
          }
          if (
            cells.length === 2 &&
            ((cells[0].r === a.r &&
              cells[0].c === a.c &&
              cells[1].r === b.r &&
              cells[1].c === b.c) ||
              (cells[1].r === a.r &&
                cells[1].c === a.c &&
                cells[0].r === b.r &&
                cells[0].c === b.c))
          ) {
            eliminateWWing(sb, a, b, x, y, linkNum)
          }
        }

        // box strong link
        const sr = Math.floor(a.r / 3) * 3
        const sc = Math.floor(a.c / 3) * 3
        const cells = []
        for (let r = sr; r < sr + 3; r++) {
          for (let c = sc; c < sc + 3; c++) {
            if (!sb[r][c].value && sb[r][c].candidates.includes(linkNum)) {
              cells.push({ r, c })
            }
          }
        }
        if (
          cells.length === 2 &&
          ((cells[0].r === a.r && cells[0].c === a.c && cells[1].r === b.r && cells[1].c === b.c) ||
            (cells[1].r === a.r && cells[1].c === a.c && cells[0].r === b.r && cells[0].c === b.c))
        ) {
          eliminateWWing(sb, a, b, x, y, linkNum)
        }
      })
    }
  }

  function eliminateWWing(sb, a, b, x, y, linkNum) {
    const removeNum = linkNum === x ? y : x

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const cell = sb[r][c]
        if (cell.value || !cell.candidates.includes(removeNum)) continue

        const peerA = r === a.r || c === a.c || Math.floor(r / 3) === Math.floor(a.r / 3)
        const peerB = r === b.r || c === b.c || Math.floor(r / 3) === Math.floor(b.r / 3)

        if (peerA && peerB) {
          if (removeCandidate(cell, removeNum)) eliminated++
        }
      }
    }
  }

  return eliminated
}

/* ------------------------------------------------------------------
 * Solver
 * ------------------------------------------------------------------ */

export function quickEvaluate(board, difficulty) {
  const result = logicalSolve(cloneBoard(board))

  // 논리 실패
  if (!result.solved && result.stalled) return 'fail'

  const singles = result.techniquesUsed.NakedSingle.used + result.techniquesUsed.HiddenSingle.used

  if (difficulty === 'easy') {
    const hasAdvanced =
      result.techniquesUsed.NakedPair.used +
        result.techniquesUsed.NakedTriple.used +
        result.techniquesUsed.Pointing.used +
        result.techniquesUsed.Claiming.used +
        result.techniquesUsed.XWing.used +
        result.techniquesUsed.TwoStringKite.used +
        result.techniquesUsed.Skyscraper.used +
        result.techniquesUsed.WWing.used >
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
    // 고급 기법 감지
    const hasAdvanced =
      result.techniquesUsed.XWing.used +
        result.techniquesUsed.TwoStringKite.used +
        result.techniquesUsed.Skyscraper.used +
        result.techniquesUsed.WWing.used >
      0
    // veryHard 핵심
    if (singles > 15) return 'tooEasy'
    if (!hasAdvanced && singles > 10) return 'tooEasy'
  }

  return 'ok'
}

function calculateDifficultyScore(techniquesUsed) {
  let score = 0
  for (const k in techniquesUsed) {
    score += techniquesUsed[k].used * (TECHNIQUE_WEIGHT[k] || 0)
  }
  return Number(score.toFixed(2))
}

// function calculateDifficultyScore(techniques) {
//   let score = 0
//   let filledTotal = 0
//   let steps = 0

//   for (const [name, stat] of Object.entries(techniques)) {
//     const w = TECHNIQUE_WEIGHT[name] || 0

//     // 기법 등장 자체를 1회만 반영
//     if (stat.used > 0) {
//       score += w
//       steps += stat.used
//     }

//     // 채운 칸 수는 효율 계산용으로만
//     if (stat.filled) {
//       filledTotal += stat.filled
//     }

//     // 제거는 아주 약하게 캡
//     if (stat.eliminated) {
//       score += Math.min(stat.eliminated, 2) * (w * 0.1)
//     }
//   }

//   // Single 질질 끄는 퍼즐만 페널티
//   const efficiency = filledTotal / Math.max(steps, 1)

//   if (efficiency < 1.1) score += 0.7
//   if (efficiency < 0.9) score += 1.4
//   if (efficiency < 0.7) score += 2.2

//   return Number(score.toFixed(2))
// }

export function logicalSolve(board) {
  const sb = buildSolverBoard(board)
  const techniquesUsed = {
    NakedSingle: { used: 0, filled: 0 },
    HiddenSingle: { used: 0, filled: 0 },

    NakedPair: { used: 0, eliminated: 0 },
    NakedTriple: { used: 0, eliminated: 0 },

    Pointing: { used: 0, eliminated: 0 },
    Claiming: { used: 0, eliminated: 0 },

    XWing: { used: 0, eliminated: 0 },
    TwoStringKite: { used: 0, eliminated: 0 },
    Skyscraper: { used: 0, eliminated: 0 },
    WWing: { used: 0, eliminated: 0 },
  }

  let loopCount = 0
  const MAX_STEPS = 500

  while (loopCount++ < MAX_STEPS) {
    let changed = false

    let filled
    if ((filled = applyNakedSinglesSB(sb)) > 0) {
      techniquesUsed.NakedSingle.used++
      techniquesUsed.NakedSingle.filled += filled
      changed = true
    } else if ((filled = applyHiddenSinglesSB(sb)) > 0) {
      techniquesUsed.HiddenSingle.used++
      techniquesUsed.HiddenSingle.filled += filled
      changed = true
    } else if ((filled = applyNakedPairsSB(sb)) > 0) {
      techniquesUsed.NakedPair.used++
      techniquesUsed.NakedPair.eliminated += filled
      changed = true
    } else if ((filled = applyNakedTriplesSB(sb)) > 0) {
      techniquesUsed.NakedTriple.used++
      techniquesUsed.NakedTriple.eliminated += filled
      changed = true
    } else if ((filled = applyPointingPairSB(sb)) > 0) {
      techniquesUsed.Pointing.used++
      techniquesUsed.Pointing.eliminated += filled
      changed = true
    } else if ((filled = applyClaimingPairSB(sb)) > 0) {
      techniquesUsed.Claiming.used++
      techniquesUsed.Claiming.eliminated += filled
      changed = true
    } else if ((filled = applyXWingSB(sb)) > 0) {
      techniquesUsed.XWing.used++
      techniquesUsed.XWing.eliminated += filled
      changed = true
    } else if ((filled = applyTwoStringKiteSB(sb)) > 0) {
      techniquesUsed.TwoStringKite.used++
      techniquesUsed.TwoStringKite.eliminated += filled
      changed = true
    } else if ((filled = applySkyscraperSB(sb)) > 0) {
      techniquesUsed.Skyscraper.used++
      techniquesUsed.Skyscraper.eliminated += filled
      changed = true
    } else if ((filled = applyWWingSB(sb)) > 0) {
      techniquesUsed.WWing.used++
      techniquesUsed.WWing.eliminated += filled
      changed = true
    }

    if (!changed) break
  }

  const order = [
    'NakedSingle',
    'HiddenSingle',

    'NakedPair',
    'NakedTriple',

    'Pointing',
    'Claiming',

    'XWing',
    'TwoStringKite',
    'Skyscraper',
    'WWing',
  ]

  let maxTechnique = null
  for (let i = order.length - 1; i >= 0; i--) {
    const stat = techniquesUsed[order[i]]
    if (stat.used > 0) {
      maxTechnique = order[i]
      break
    }
  }

  const solved = sb.every((row) => row.every((c) => c.value))

  let stalled = false
  let stallReason = null

  if (!solved) {
    const hasEmpty = sb.some((row) => row.some((c) => !c.value))
    const hasZeroCandidate = sb.some((row) =>
      row.some((c) => !c.value && c.candidates.length === 0),
    )

    if (hasZeroCandidate) {
      stalled = true
      stallReason = 'contradiction'
    } else if (hasEmpty) {
      stalled = true
      stallReason = 'noMoreLogicalMoves'
    }
  }

  return {
    solved,
    stalled,
    stallReason,
    techniquesUsed,
    maxTechnique,
    score: calculateDifficultyScore(techniquesUsed),
  }
}
