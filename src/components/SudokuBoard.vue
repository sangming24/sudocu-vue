<template>
  <div class="page-wrapper" @click="selectedCell = null">
    <div class="container">
      <h2>논리적 스도쿠!</h2>

      <div class="controls">
        <select v-model="difficulty" :disabled="isGenerating" class="mode-select">
          <option value="easy">쉬움</option>
          <option value="medium">보통</option>
          <option value="hard">어려움</option>
          <option value="veryHard">매우 어려움</option>
        </select>
        <button @click="startGame" :disabled="isGenerating">
          {{ isGenerating ? '생성 중...' : '게임 시작' }}
        </button>
      </div>

      <div class="board-wrapper" :class="{ locked: isComplete }">
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
        <!-- 상단 메모 버튼 -->
        <div class="tracker-header">
          <div
            class="tracker-memo"
            :class="{ active: isMemoMode }"
            @click.stop="isMemoMode = !isMemoMode"
          >
            ✏️ 메모
          </div>
        </div>

        <!-- 트래커 영역 -->
        <div class="tracker-container">
          <div
            v-for="item in remainingNumbers"
            :key="item.num"
            class="tracker-item"
            :class="{ used: item.count === 0 }"
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

      <div v-if="isComplete" class="success-overlay">
        <div class="confetti">
          <span v-for="n in 24" :key="n"></span>
        </div>
        <div class="success-box">
          <h2>🎉 완료!</h2>
          <p>스도쿠를 완성했어요</p>
          <button @click="startGame">새 게임</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { checkBoardSafety, isPossibleByBoard } from '@/sudoku/utils'
import { useSudoku } from '@/composables/useSudoku'
import { useSudokuWorker } from '@/composables/useSudokuWorker'

const difficulty = ref('medium')
const selectedCell = ref(null)
const isMemoMode = ref(false)
const isComplete = ref(false)
const cellInputs = ref(Array.from({ length: 9 }, () => Array(9).fill(null)))

const sudoku = useSudoku()
const { generate, isGenerating } = useSudokuWorker()

const board = reactive(Array.from({ length: 9 }, () => Array(9).fill(null)))
const solution = reactive(Array.from({ length: 9 }, () => Array(9).fill(null)))
const userBoard = reactive(
  Array.from({ length: 9 }, () =>
    Array.from({ length: 9 }, () => ({ value: null, candidates: [] })),
  ),
)

function setCellInput(el, i, j) {
  if (el) {
    cellInputs.value[i][j] = el
  }
}

function selectCell(i, j) {
  selectedCell.value = [i, j]

  cellInputs.value[i][j]?.focus()
}

async function startGame() {
  if (isGenerating.value) return

  selectedCell.value = null
  isComplete.value = false
  isMemoMode.value = false

  for (let i = 0; i < 9; i++)
    for (let j = 0; j < 9; j++) {
      board[i][j] = null
      userBoard[i][j] = { value: null, candidates: [] }
    }

  try {
    const result = await generate(difficulty.value)
    if (!result) return

    const { puzzle, solution: solved } = result

    for (let i = 0; i < 9; i++)
      for (let j = 0; j < 9; j++) {
        board[i][j] = puzzle[i][j]
        solution[i][j] = solved[i][j]
      }

    console.table(board)
    console.log('중복 체크:', checkBoardSafety(board) ? '중복 없음 ✅' : '중복 있음 ❌')
  } catch (err) {
    console.log('퍼즐 생성 실패', err)
  }
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
    if (!isPossibleByBoard(sudoku.mergedBoard(board, userBoard), i, j, num)) return // 불가능하면 그냥 무시

    const idx = cell.candidates.indexOf(num)
    if (idx === -1) cell.candidates.push(num)
    else cell.candidates.splice(idx, 1)
    cell.candidates.sort((a, b) => a - b)
  } else {
    cell.value = num
    // cell.candidates = [];	// 보존 후 숫자 삭제 시 재노출
    sudoku.removeCandidates(userBoard, solution, i, j, num)
  }
}

function handleTrackerInput(num) {
  if (!selectedCell.value) return

  const [i, j] = selectedCell.value
  if (board[i][j] !== null) return

  const cell = userBoard[i][j]
  if (isMemoMode.value) {
    // 유효성 체크: 해당 위치에 넣어도 되는 숫자인지 확인
    if (!isPossibleByBoard(sudoku.mergedBoard(board, userBoard), i, j, num)) return // 불가능하면 그냥 무시

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
      sudoku.removeCandidates(userBoard, solution, i, j, num)
    }
  }

  focusSelectedCell()
}

function focusSelectedCell() {
  if (!selectedCell.value) return
  const [i, j] = selectedCell.value
  cellInputs.value[i][j]?.focus()
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
    // solution과 비교
    isError = solution[i][j] !== cell.value
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
  const b = sudoku.mergedBoard(board, userBoard)
  return Array.from({ length: 9 }, (_, i) => i + 1).map((num) => {
    // solution 기준으로 아직 입력되지 않은 개수
    let count = 0
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (solution[r][c] === num && b[r][c] !== num) count++
      }
    }
    return { num, count }
  })
})

function initConfetti() {
  nextTick(() => {
    document.querySelectorAll('.confetti span').forEach((el, i) => {
      el.style.setProperty('--x', Math.random())
      el.style.setProperty('--i', i)
      el.style.setProperty('--h', Math.floor(Math.random() * 360))
    })
  })
}

watch(
  userBoard,
  () => {
    // ⭐ solution 준비 전에는 완료 체크 금지
    if (solution[0][0] === null) return

    const b = sudoku.mergedBoard(board, userBoard)
    for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) if (b[i][j] !== solution[i][j]) return
    // 완성 시
    if (!isComplete.value) {
      isComplete.value = true
      initConfetti()
    }
  },
  { deep: true },
)
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

.tracker-header {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 8px;
}

.tracker-memo {
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 14px;
  background: #f5f5f5;
  border: 1px solid #aaa;
  cursor: pointer;
}

.tracker-memo.active {
  background: #cfe2ff;
  border-color: #4a90ff;
  font-weight: bold;
}

.tracker-container {
  display: flex;
  /* ⭐ 보드와 동일한 너비 규칙 */
  width: min(92vw, 92vh);
  max-width: 420px;
  min-width: 280px;

  overflow-x: hidden;
  box-sizing: border-box;
}

.tracker-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;

  flex: 1 1 0;
  min-width: 0;

  padding: 0 4px;
  box-sizing: border-box;
}

.tracker-number {
  width: 100%;
  aspect-ratio: 1 / 1;
  max-width: 100%;

  max-width: 36px;
  margin: 0 auto;

  font-size: clamp(12px, 2.5vw, 16px);
  font-weight: bold;
  user-select: none;

  background-color: #d0e7ff;
  border-radius: 4px;

  display: flex;
  align-items: center;
  justify-content: center;
  touch-action: manipulation;
}

/* ===== 트래커 숫자 고정 + 소진 처리 ===== */
.tracker-item.used {
  visibility: hidden; /* 공간 유지 */
  pointer-events: none; /* 클릭 방지 */
}

.tracker-dots {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 2px;

  width: 100%;

  max-width: 36px;
  margin: 3px auto 0;
}

.dot {
  width: 5px;
  height: 5px;
  background-color: #007bff;
  border-radius: 50%;
}

.board-wrapper {
  margin-bottom: 12px; /* 8~16px 사이 취향 */
}

.locked {
  pointer-events: none;
  opacity: 0.6;
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
}
td.selected .cell {
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
  height: 30px; /* 버튼과 높이 통일 */
  padding: 0 10px; /* 위아래 padding 제거 */
  font-size: 14px;
  line-height: 30px;
  border-radius: 6px;
  border: 1px solid #ccc;
  background-color: #f8f9fa;
  cursor: pointer;
  appearance: none; /* 기본 화살표 제거 (중요) */

  background-image:
    linear-gradient(45deg, transparent 50%, #555 50%),
    linear-gradient(135deg, #555 50%, transparent 50%);
  background-position:
    calc(100% - 16px) 55%,
    calc(100% - 11px) 55%;
  background-size: 5px 5px;
  background-repeat: no-repeat;
}

.mode-select:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 3px rgba(0, 123, 255, 0.5);
}

.success-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.success-box {
  background: #fff;
  padding: 24px 28px;
  border-radius: 14px;
  text-align: center;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  animation: pop 0.35s ease-out;
}

.success-box h2 {
  margin-bottom: 8px;
}

.success-box button {
  margin-top: 12px;
  padding: 8px 16px;
  border-radius: 8px;
  border: none;
  background: #007bff;
  color: white;
  font-size: 14px;
  cursor: pointer;
}

@keyframes pop {
  from {
    transform: scale(0.85);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

/* ===== 가벼운 컨페티 효과 ===== */
.confetti {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.confetti span {
  position: absolute;
  top: -10%;
  width: 8px;
  height: 8px;
  background-color: hsl(var(--h), 80%, 60%);
  animation: confetti-fall 1.8s linear forwards;
}

/* 랜덤 위치 & 색상 */
.confetti span:nth-child(n) {
  left: calc(100% * var(--x));
  animation-delay: calc(0.02s * var(--i));
}

/* 낙하 애니메이션 */
@keyframes confetti-fall {
  to {
    transform: translateY(120vh) rotate(360deg);
    opacity: 0;
  }
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
    gap: 4px;
  }

  .tracker-number {
    font-size: 16px;
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
