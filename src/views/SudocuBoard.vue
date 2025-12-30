<template>
  <div class="page-wrapper" @click="selectedCell = null">
    <div class="container">
      <h2>논리적 스도쿠!</h2>

      <div class="controls">
        <select v-model="errorMode" class="mode-select">
          <option value="possible">가능 숫자 기준</option>
          <option value="answer">정답 기준</option>
        </select>
        <select v-model.number="difficulty" class="mode-select">
          <option :value="30">쉬움</option>
          <option :value="40">보통</option>
          <option :value="50">어려움</option>
          <option :value="60">극한</option>
          <option :value="70">극한어려움</option>
        </select>
        <button @click="startGame">게임 시작</button>
        <button @click="isMemoMode = !isMemoMode">
          {{ isMemoMode ? '메모 모드 ON' : '메모 모드 OFF' }}
        </button>
      </div>

      <div class="message">{{ message }}</div>
      <div class="board-wrapper">
        <table @click.stop>
          <tr v-for="(row, i) in userBoard" :key="i">
            <td
              v-for="(cell, j) in row"
              :key="j"
              :class="cellClass(i, j)"
              @click.stop="selectCell(i, j)"
            >
              <div class="cell">
                <!-- 문제 숫자 -->
                <span v-if="board[i][j] !== null" class="problem">{{ board[i][j] }}</span>

                <!-- 입력 숫자 -->
                <span v-else-if="cell.value !== null" class="number">{{ cell.value }}</span>

                <!-- 메모 표시 -->
                <div v-if="cell.value === null && board[i][j] === null" class="memo-grid">
                  <span
                    v-for="n in 9"
                    :key="n"
                    :class="{
                      memoHighlight:
                        selectedCellNumber !== null &&
                        n === selectedCellNumber &&
                        cell.candidates.includes(n),
                    }"
                    >{{ cell.candidates.includes(n) ? n : '' }}</span
                  >
                </div>

                <!-- 실제 입력 input (투명) -->
                <input
                  :ref="(el) => setCellInput(el, i, j)"
                  type="text"
                  inputmode="none"
                  maxlength="1"
                  @focus="selectedCell = [i, j]"
                  @keydown="handleKey($event, i, j)"
                />
              </div>
            </td>
          </tr>
        </table>
      </div>

      <div class="tracker-wrapper">
        <!-- 보드 아래 트래커 -->
        <!-- 트래커 영역 -->
        <div class="tracker-container">
          <div
            v-for="item in remainingNumbers"
            :key="item.num"
            class="tracker-item"
            @mousedown.prevent
            @click.stop="handleTrackerInput(item.num)"
          >
            <!-- 숫자 -->
            <div class="tracker-number">{{ item.num }}</div>

            <!-- 남은 개수 점 표시 -->
            <div class="tracker-dots">
              <span v-for="i in Math.min(item.count, 10)" :key="i" class="dot"></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'

const difficulty = ref(50)
const message = ref('')
const selectedCell = ref(null)
const isMemoMode = ref(false)
const errorMode = ref('possible')
const cellInputs = ref(Array.from({ length: 9 }, () => Array(9).fill(null)))

function setCellInput(el, i, j) {
  if (el) {
    cellInputs.value[i][j] = el
  }
}

const board = reactive(Array.from({ length: 9 }, () => Array(9).fill(null)))
const solution = reactive(Array.from({ length: 9 }, () => Array(9).fill(null)))
const userBoard = reactive(
  Array.from({ length: 9 }, () =>
    Array.from({ length: 9 }, () => ({ value: null, candidates: [] })),
  ),
)

function mergedBoard() {
  return board.map((r, i) => r.map((c, j) => c ?? userBoard[i][j].value))
}

function shuffle(array) {
  const a = [...array]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function isSafe(b, r, c, n) {
  for (let i = 0; i < 9; i++) if (b[r][i] === n || b[i][c] === n) return false
  const sr = Math.floor(r / 3) * 3
  const sc = Math.floor(c / 3) * 3
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (b[sr + i][sc + j] === n) return false
  return true
}

function solveRandom(b) {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (b[r][c] === null) {
        const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])
        for (let n of nums) {
          if (isSafe(b, r, c, n)) {
            b[r][c] = n
            if (solveRandom(b)) return true
            b[r][c] = null
          }
        }
        return false
      }
    }
  }
  return true
}

function countSolutions(b, limit = 2) {
  let count = 0
  function backtrack() {
    if (count >= limit) return
    for (let r = 0; r < 9; r++)
      for (let c = 0; c < 9; c++)
        if (b[r][c] === null) {
          for (let n = 1; n <= 9; n++) {
            if (isSafe(b, r, c, n)) {
              b[r][c] = n
              backtrack()
              b[r][c] = null
            }
          }
          return
        }
    count++
  }
  backtrack()
  return count
}

function generatePuzzle(empty) {
  solveRandom(board)

  // solution 저장
  for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) solution[i][j] = board[i][j]

  const cells = shuffle([...Array(81).keys()])
  for (let idx of cells) {
    if (empty <= 0) break
    const r = Math.floor(idx / 9)
    const c = idx % 9
    const backup = board[r][c]
    board[r][c] = null
    const copy = mergedBoard().map((row) => [...row])
    if (countSolutions(copy) !== 1) board[r][c] = backup
    else empty--
  }
}

function startGame() {
  message.value = ''
  selectedCell.value = null

  for (let i = 0; i < 9; i++)
    for (let j = 0; j < 9; j++) {
      board[i][j] = null
      userBoard[i][j] = { value: null, candidates: [] }
    }

  generatePuzzle(difficulty.value)

  console.table(board)
  console.log('중복 체크:', checkBoardSafety(board) ? '중복 없음 ✅' : '중복 있음 ❌')
}

function selectCell(i, j) {
  selectedCell.value = [i, j]

  cellInputs.value[i][j]?.focus()
}

function handleKey(e, i, j) {
  const key = e.key
  const cell = userBoard[i][j]

  if (['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(key)) {
    moveNextCell(i, j, key.replace('Arrow', '').toLowerCase())
    e.preventDefault()
    return
  }

  // 문제칸이면 나머지 키 입력 무시
  if (board[i][j] !== null) {
    e.preventDefault()
    return
  }

  // 지우기 지원
  if (key === 'Backspace' || key === 'Delete') {
    cell.value = null
    // cell.candidates = [];
    return
  }

  if (!/^[1-9]$/.test(key)) return
  const num = Number(key)

  if (isMemoMode.value) {
    // 유효성 체크: 해당 위치에 넣어도 되는 숫자인지 확인
    if (!isSafeFull(mergedBoard(), i, j, num)) return // 불가능하면 그냥 무시

    const idx = cell.candidates.indexOf(num)
    if (idx === -1) cell.candidates.push(num)
    else cell.candidates.splice(idx, 1)
    cell.candidates.sort((a, b) => a - b)
  } else {
    cell.value = num
    // cell.candidates = [];	// 보존 후 숫자 삭제 시 재노출
    removeCandidates(i, j, num)
  }
}

function handleTrackerInput(num) {
  if (!selectedCell.value) return

  const [i, j] = selectedCell.value
  if (board[i][j] !== null) return

  const cell = userBoard[i][j]
  if (isMemoMode.value) {
    // ✅ 메모 모드: 후보 숫자 토글
    const idx = cell.candidates.indexOf(num)
    if (idx === -1) {
      cell.candidates.push(num)
      cell.candidates.sort((a, b) => a - b)
    } else {
      cell.candidates.splice(idx, 1)
    }
  } else {
    // ✅ 일반 모드: 같은 숫자면 삭제 (토글)
    if (cell.value === num) {
      cell.value = null
    } else {
      cell.value = num
      removeCandidates(i, j, num)
    }
  }

  focusSelectedCell()
}

function focusSelectedCell() {
  if (!selectedCell.value) return
  const [i, j] = selectedCell.value
  cellInputs.value[i][j]?.focus()
}

function removeCandidates(r, c, num) {
  const b = mergedBoard()

  // 입력된 숫자가 정상 아닐 경우 → 메모 건드리지 않음
  let canRemove = false

  if (errorMode.value === 'possible') {
    canRemove = isSafeFull(b, r, c, num)
  } else if (errorMode.value === 'answer') {
    // solution 기준으로 체크
    canRemove = solution[r][c] === num
  }
  if (!canRemove) return

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

function moveNextCell(i, j, dir) {
  let ni = i
  let nj = j

  if (dir === 'right') nj = (j + 1) % 9
  else if (dir === 'left') nj = (j + 8) % 9
  else if (dir === 'down') ni = (i + 1) % 9
  else if (dir === 'up') ni = (i + 8) % 9

  selectedCell.value = [ni, nj]
  focusSelectedCell()
}

const selectedCellNumber = computed(() => {
  if (!selectedCell.value) return null

  const [i, j] = selectedCell.value
  return userBoard[i][j].value || board[i][j]
})

function cellClass(i, j) {
  const cell = userBoard[i][j]
  const b = mergedBoard()

  // 선택된 숫자가 들어있는 모든 위치
  const selNum = selectedCellNumber.value
  const [si, sj] = selectedCell.value || []

  const related =
    selNum !== null &&
    selectedCell.value &&
    (i === si ||
      j === sj ||
      (Math.floor(i / 3) === Math.floor(si / 3) && Math.floor(j / 3) === Math.floor(sj / 3)))

  // 에러 판단
  let isError = false
  if (cell.value !== null) {
    if (errorMode.value === 'possible') {
      // 현재 셀 제외하고 가능한지 체크
      isError = !isSafeFull(b, i, j, cell.value)
    } else if (errorMode.value === 'answer') {
      // solution과 비교
      isError = solution[i][j] !== cell.value
    }
  }

  return {
    problem: board[i][j] !== null,
    selected: selectedCell.value?.[0] === i && selectedCell.value?.[1] === j,
    error: isError,
    highlight: selNum !== null && (cell.value === selNum || board[i][j] === selNum),
    related,
  }
}

const remainingNumbers = computed(() => {
  const b = mergedBoard()
  return Array.from({ length: 9 }, (_, i) => i + 1)
    .map((num) => {
      // solution 기준으로 아직 입력되지 않은 개수
      let count = 0
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (solution[r][c] === num && b[r][c] !== num) count++
        }
      }
      return { num, count }
    })
    .filter((x) => x.count > 0)
})

watch(
  userBoard,
  () => {
    const b = mergedBoard()
    for (let i = 0; i < 9; i++)
      for (let j = 0; j < 9; j++) if (!b[i][j] || !isSafeFull(b, i, j, b[i][j])) return
    // 완성 시
    message.value = '🎉 완성!'
  },
  { deep: true },
)

function isSafeFull(b, r, c, n) {
  for (let i = 0; i < 9; i++) if (i !== c && b[r][i] === n) return false
  for (let i = 0; i < 9; i++) if (i !== r && b[i][c] === n) return false
  const sr = Math.floor(r / 3) * 3
  const sc = Math.floor(c / 3) * 3
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      if ((sr + i !== r || sc + j !== c) && b[sr + i][sc + j] === n) return false
  return true
}

function checkBoardSafety(b) {
  for (let r = 0; r < 9; r++) {
    const seen = new Set()
    for (let c = 0; c < 9; c++) {
      const v = b[r][c]
      if (v === null) continue
      if (seen.has(v)) return false
      seen.add(v)
    }
  }
  for (let c = 0; c < 9; c++) {
    const seen = new Set()
    for (let r = 0; r < 9; r++) {
      const v = b[r][c]
      if (v === null) continue
      if (seen.has(v)) return false
      seen.add(v)
    }
  }
  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 3; bc++) {
      const seen = new Set()
      for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++) {
          const v = b[br * 3 + i][bc * 3 + j]
          if (v === null) continue
          if (seen.has(v)) return false
          seen.add(v)
        }
    }
  }
  return true
}
</script>

<style scoped>
* {
  word-break: keep-all;
}

.page-wrapper {
  min-height: 100dvh;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

.container {
  min-width: 320px;
  min-height: auto;

  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 4px;
  box-sizing: border-box;
  gap: 8px;
}

h2 {
  margin: 4px 0;
  font-size: clamp(18px, 4vw, 24px);
}
.controls {
  min-width: 280px;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px;
  margin: 4px 0;
}

.controls button {
  margin-left: 5px;
  padding: 5px 12px;
  border-radius: 6px;
  border: 1px solid #007bff;
  background-color: #007bff;
  color: white;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.controls button:hover {
  background-color: #0056b3;
}

.tracker-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(36px, 1fr));
  gap: 8px;
  grid-auto-rows: auto;
  max-height: calc(36px * 2 + 20px);

  /* ⭐ 보드와 동일한 너비 규칙 */
  width: min(92vw, 92vh);
  max-width: 420px;
  min-width: 280px;

  margin-top: 12px;
}

.tracker-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.tracker-number {
  width: 100%;
  max-width: 36px;
  aspect-ratio: 1 / 1;

  font-size: clamp(12px, 2.5vw, 16px);
  font-weight: bold;

  background-color: #d0e7ff;
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 4px;
  margin-bottom: 4px;
  user-select: none;
}

.tracker-dots {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 2px;
  max-width: 36px;
}

.dot {
  width: 6px;
  height: 6px;
  background-color: #007bff;
  border-radius: 50%;
}

table {
  width: min(92vw, 92vh);

  min-width: 280px;
  min-height: 280px;

  max-width: 420px;
  max-height: 420px;

  margin: 0 auto;

  border-collapse: collapse;
  border-spacing: 0;

  table-layout: fixed;
  line-height: 0;
}
table input {
  opacity: 0;
  pointer-events: auto;
}

td span.number,
td span.problem,
input {
  font-size: clamp(14px, 2.8vw, 20px);
}

td {
  width: 11.1%;

  border: 1px solid #aaa;
  text-align: center;
  position: relative;
  padding: 0;
  box-sizing: border-box;
}

.cell {
  width: 100%;
  aspect-ratio: 1 / 1;

  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

td:nth-child(3),
td:nth-child(6) {
  border-right: 2px solid #000;
}
tr:nth-child(3) td,
tr:nth-child(6) td {
  border-bottom: 2px solid #000;
}

td.selected {
  background-color: #cfe2ff;
  box-shadow: inset 0 0 0 2px #4a90ff;
}
td.problem {
  font-weight: bold;
}
span.number {
  color: rgb(0, 128, 255);
  font-weight: bold;
}
td.error {
  background-color: #fbb !important;
  box-shadow: inset 0 0 0 2px #d00;
  line-height: 1;
}
td.error span {
  color: red !important;
}

input {
  width: 100%;
  height: 100%;
  border: none;
  text-align: center;
  background: transparent;
  color: transparent; /* 텍스트 안 보이게 */
  caret-color: transparent; /* 커서 안 보이게 */
  position: absolute; /* td 위에 겹치게 */
  top: 0;
  left: 0;
}

input:focus {
  outline: none;
}

.memo-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  font-size: clamp(7px, 1.8vw, 12px);
  line-height: 1em;
  width: 100%;
  height: 100%;
  text-align: center;
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
}
.memo-grid span {
  display: flex;
  justify-content: center;
  align-items: center;
  white-space: nowrap;
}

.message {
  margin-top: 10px;
  font-weight: bold;
}

/* 트래커 클릭시 같은 숫자 색변경 */
td.highlight {
  background-color: #c1dcff;
}

/* 트래커 클릭시 같은 숫자(메모) 색변경 */
span.memoHighlight {
  background-color: #c1dcff;
  font-weight: bold;
  border-radius: 2px;
}

/* 선택된 숫자 영역 표시 */
td.related {
  background-color: #f2f6ff;
}

/* 숫자가 없으면 메모 보임 */
/* td > span + .memo-grid {
	display: grid;
} */

/* 숫자가 입력되면 메모 숨김 */
/* td > span:not(:empty) + .memo-grid {
	display: none;
} */

/* 숫자가 입력되면 메모 숨김 */
/* td input[value]:not([value='']) + .memo-grid {
	opacity: 0;
} */
.mode-select {
  margin: 0 5px;
  padding: 5px 10px;
  border-radius: 6px;
  border: 1px solid #ccc;
  font-size: 14px;
  background-color: #f8f9fa;
  cursor: pointer;
  transition: all 0.2s;
}

.mode-select:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 3px rgba(0, 123, 255, 0.5);
}

@media (max-width: 400px) {
  .controls {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px;
  }

  .mode-select,
  .controls button {
    font-size: 13px;
    padding: 4px 8px;
  }
  .tracker-container {
    min-width: 280px;
    margin-top: 4px;
    gap: 2vw;
    flex-wrap: wrap;
    justify-content: center;
  }

  .tracker-number {
    width: 28px;
    height: 28px;
    font-size: 12px;
  }

  .tracker-dots {
    grid-auto-rows: 4px;
    gap: 2px;
  }

  .dot {
    width: 4px;
    height: 4px;
  }
}

@media (max-width: 360px) {
  table {
    min-width: 280px;
    max-width: 92vw;
  }
}
</style>
