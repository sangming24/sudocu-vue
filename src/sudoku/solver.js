// src/sudoku/solver.js
/* ------------------------------------------------------------------
 * Solver Board
 * ------------------------------------------------------------------ */

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
                removeCandidate(sb[row][c], num)
                changed = true
              }
            }
          }

          if (sameCol) {
            const col = positions[0].c
            for (let r = 0; r < 9; r++) {
              if (r < sr || r >= sr + 3) {
                removeCandidate(sb[r][col], num)
                changed = true
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

  for (let r = 0; r < 9; r++) {
    for (let num = 1; num <= 9; num++) {
      const cells = sb[r].filter((c) => !c.value && c.candidates.includes(num))
      if (cells.length < 2) continue

      const block = Math.floor(cells[0].c / 3)
      if (!cells.every((c) => Math.floor(c.c / 3) === block)) continue

      const sr = Math.floor(r / 3) * 3
      const sc = block * 3

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

  return changed
}

function snapshotSB(sb) {
  return sb
    .map((row) => row.map((c) => `${c.value ?? 0}:${c.candidates.join('')}`).join('|'))
    .join('\n')
}

/* ------------------------------------------------------------------
 * Main Solver
 * ------------------------------------------------------------------ */

export function logicalSolve(board) {
  const sb = buildSolverBoard(board)
  const techniquesUsed = {
    NakedSingle: false,
    HiddenSingle: false,
    NakedPair: false,
    Pointing: false,
    Claiming: false,
  }

  let prevSnap = ''

  while (true) {
    const snap = snapshotSB(sb)
    if (snap === prevSnap) break // ⭐ 무한 루프 차단
    prevSnap = snap

    if (applyNakedSinglesSB(sb)) {
      techniquesUsed.NakedSingle = true
      continue
    }
    if (applyHiddenSinglesSB(sb)) {
      techniquesUsed.HiddenSingle = true
      continue
    }
    if (applyNakedPairsSB(sb)) {
      techniquesUsed.NakedPair = true
      continue
    }
    if (applyPointingPairSB(sb)) {
      techniquesUsed.Pointing = true
      continue
    }
    if (applyClaimingPairSB(sb)) {
      techniquesUsed.Claiming = true
      continue
    }
    break
  }

  const order = ['NakedSingle', 'HiddenSingle', 'NakedPair', 'Pointing', 'Claiming']

  let maxTechnique = null
  for (let i = order.length - 1; i >= 0; i--) {
    if (techniquesUsed[order[i]]) {
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
  }
}
