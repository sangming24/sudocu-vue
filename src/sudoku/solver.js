// src/sudoku/solver.js
/* ------------------------------------------------------------------
 * Solver Board
 * ------------------------------------------------------------------ */

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
  let changed = false
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const cell = sb[r][c]
      if (!cell.value && cell.candidates.length === 1) {
        cell.value = cell.candidates[0]
        cell.candidates = []
        eliminateFromPeers(sb, r, c, cell.value)
        changed = true
      }
    }
  }
  return changed
}

function applyHiddenSinglesSB(sb) {
  let changed = false

  const checkUnit = (cells) => {
    for (let num = 1; num <= 9; num++) {
      const spots = cells.filter((c) => !c.value && c.candidates.includes(num))
      if (spots.length === 1) {
        spots[0].value = num
        spots[0].candidates = []
        eliminateFromPeers(sb, spots[0].r, spots[0].c, num)
        changed = true
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

  return changed
}

function applyNakedPairsSB(sb) {
  let changed = false

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
                  changed = true
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

  return changed
}

function applyNakedTriplesSB(sb) {
  let changed = false

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
                    changed = true
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

  return changed
}

function applyPointingPairSB(sb) {
  let changed = false

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
                  changed = true
                }
              }
            }
          }

          if (sameCol) {
            const col = positions[0].c
            for (let r = 0; r < 9; r++) {
              if (r < sr || r >= sr + 3) {
                if (removeCandidate(sb[r][col], num)) {
                  changed = true
                }
              }
            }
          }
        }
      }
    }
  }

  return changed
}
function applyClaimingPairSB(sb) {
  let changed = false

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
            changed = true
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
            changed = true
          }
        }
      }
    }
  }

  return changed
}
function applyXWingSB(sb) {
  let changed = false

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
              if (removeCandidate(sb[rr][c1], num)) changed = true
              if (removeCandidate(sb[rr][c2], num)) changed = true
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
              if (removeCandidate(sb[r1][cc], num)) changed = true
              if (removeCandidate(sb[r2][cc], num)) changed = true
            }
          }
        }
      }
    }
  }

  return changed
}

function applyTwoStringKiteSB(sb) {
  let changed = false

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
              if (removeCandidate(cell, num)) changed = true
            }
          }
        }
      })
    })
  }

  return changed
}

function applySkyscraperSB(sb) {
  let changed = false

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
              if (removeCandidate(cell, num)) changed = true
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
              if (removeCandidate(cell, num)) changed = true
            }
          }
        }
      }
    }
  }

  return changed
}

function applyWWingSB(sb) {
  let changed = false

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
          if (removeCandidate(cell, removeNum)) changed = true
        }
      }
    }
  }

  return changed
}

/* ------------------------------------------------------------------
 * Main Solver
 * ------------------------------------------------------------------ */
export function estimateSingles(board) {
  const sb = buildSolverBoard(board)
  let singles = 0

  sb.forEach((row) =>
    row.forEach((cell) => {
      if (!cell.value && cell.candidates.length === 1) singles++
    }),
  )

  return singles
}

export function logicalSolve(board) {
  const sb = buildSolverBoard(board)
  const techniquesUsed = {
    NakedSingle: 0,
    HiddenSingle: 0,

    NakedPair: 0,
    NakedTriple: 0,

    Pointing: 0,
    Claiming: 0,

    XWing: 0,
    TwoStringKite: 0,
    Skyscraper: 0,
    WWing: 0,
  }

  let steps = 0
  const MAX_STEPS = 500

  while (steps++ < MAX_STEPS) {
    let changed = false

    if (applyNakedSinglesSB(sb)) {
      techniquesUsed.NakedSingle++
      changed = true
    } else if (applyHiddenSinglesSB(sb)) {
      techniquesUsed.HiddenSingle++
      changed = true
    } else if (applyNakedPairsSB(sb)) {
      techniquesUsed.NakedPair++
      changed = true
    } else if (applyNakedTriplesSB(sb)) {
      techniquesUsed.NakedTriple++
      changed = true
    } else if (applyPointingPairSB(sb)) {
      techniquesUsed.Pointing++
      changed = true
    } else if (applyClaimingPairSB(sb)) {
      techniquesUsed.Claiming++
      changed = true
    } else if (applyXWingSB(sb)) {
      techniquesUsed.XWing++
      changed = true
    } else if (applyTwoStringKiteSB(sb)) {
      techniquesUsed.TwoStringKite++
      changed = true
    } else if (applySkyscraperSB(sb)) {
      techniquesUsed.Skyscraper++
      changed = true
    } else if (applyWWingSB(sb)) {
      techniquesUsed.WWing++
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
    if (techniquesUsed[order[i]]) {
      maxTechnique = order[i]
      break
    }
  }

  function calculateDifficultyScore(techniquesUsed) {
    let score = 0
    for (const k in techniquesUsed) {
      score += techniquesUsed[k] * (TECHNIQUE_WEIGHT[k] || 0)
    }
    return Number(score.toFixed(2))
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
