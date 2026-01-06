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
  SimpleColoring: 3.0,
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

        if (positions.length > 1) {
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
    const rows = []

    for (let r = 0; r < 9; r++) {
      const cols = []
      for (let c = 0; c < 9; c++) {
        if (!sb[r][c].value && sb[r][c].candidates.includes(num)) {
          cols.push(c)
        }
      }
      if (cols.length === 2) {
        rows.push({ r, cols })
      }
    }

    for (let i = 0; i < rows.length; i++) {
      for (let j = i + 1; j < rows.length; j++) {
        if (rows[i].cols[0] === rows[j].cols[0] && rows[i].cols[1] === rows[j].cols[1]) {
          const [c1, c2] = rows[i].cols

          for (let r = 0; r < 9; r++) {
            if (r !== rows[i].r && r !== rows[j].r) {
              if (removeCandidate(sb[r][c1], num)) changed = true
              if (removeCandidate(sb[r][c2], num)) changed = true
            }
          }
        }
      }
    }
  }

  return changed
}

function applySimpleColoringSB(sb) {
  let changed = false

  for (let num = 1; num <= 9; num++) {
    const links = []

    // 행 strong link
    for (let r = 0; r < 9; r++) {
      const cells = []
      for (let c = 0; c < 9; c++) {
        if (!sb[r][c].value && sb[r][c].candidates.includes(num)) {
          cells.push(sb[r][c])
        }
      }
      if (cells.length === 2) links.push(cells)
    }

    // (열 / 박스도 동일하게 확장 가능)

    links.forEach(([a, b]) => {
      // 같은 색 충돌 체크 (최소 구현: peer 중복)
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          const cell = sb[r][c]
          if (
            cell !== a &&
            cell !== b &&
            cell.candidates.includes(num) &&
            (cell.r === a.r || cell.c === a.c)
          ) {
            if (removeCandidate(cell, num)) changed = true
          }
        }
      }
    })
  }

  return changed
}

function snapshotSB(sb) {
  return sb
    .map((row) => row.map((c) => (c.value ? c.value : `(${c.candidates.join('')})`)).join(','))
    .join('|')
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
    SimpleColoring: 0,
  }

  let prevSnap = ''

  while (true) {
    const snap = snapshotSB(sb)
    if (snap === prevSnap) break // ⭐ 무한 루프 차단
    prevSnap = snap

    if (applyNakedSinglesSB(sb)) {
      techniquesUsed.NakedSingle++
      continue
    }
    if (applyHiddenSinglesSB(sb)) {
      techniquesUsed.HiddenSingle++
      continue
    }
    if (applyNakedPairsSB(sb)) {
      techniquesUsed.NakedPair++
      continue
    }
    if (applyNakedTriplesSB(sb)) {
      techniquesUsed.NakedTriple++
      continue
    }
    if (applyPointingPairSB(sb)) {
      techniquesUsed.Pointing++
      continue
    }
    if (applyClaimingPairSB(sb)) {
      techniquesUsed.Claiming++
      continue
    }
    if (applyXWingSB(sb)) {
      techniquesUsed.XWing++
      continue
    }
    if (applySimpleColoringSB(sb)) {
      techniquesUsed.SimpleColoring++
      continue
    }

    break
  }

  const order = [
    'NakedSingle',
    'HiddenSingle',
    'NakedPair',
    'NakedTriple',
    'Pointing',
    'Claiming',
    'XWing',
    'SimpleColoring',
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
