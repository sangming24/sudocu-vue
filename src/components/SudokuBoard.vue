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

      <div class="game-status">
        <span>⏱ {{ formattedTime }}</span>
        <span>❌ {{ mistakeCount }}</span>

        <button v-if="gameStatus === 'playing'" @click="pauseGame">⏸ 일시정지</button>

        <button v-else-if="gameStatus === 'paused'" @click="resumeGame">▶ 재개</button>
      </div>

      <div class="board" :class="{ 'is-locked': isComplete, 'is-paused': isPaused }">
        <table @click.stop>
          <tr v-for="(row, i) in userBoard" :key="i">
            <td v-for="(cell, j) in row" :key="j" @click.stop="selectCell(i, j)">
              <div class="cell" :class="cellClass(i, j)">
                <!-- 문제 숫자 -->
                <span v-if="board[i][j] !== null" class="cell__value is-problem">{{
                  board[i][j]
                }}</span>

                <!-- 입력 숫자 -->
                <span v-else-if="cell.value !== null" class="cell__value">{{ cell.value }}</span>

                <!-- 메모 표시 -->
                <div v-if="cell.value === null && board[i][j] === null" class="cell__memo">
                  <span
                    v-for="n in 9"
                    :key="n"
                    :class="{
                      'is-memo-highlighted':
                        selectedCellNumber !== null &&
                        n === selectedCellNumber &&
                        cell.candidates.includes(n),
                    }"
                    >{{ cell.candidates.includes(n) ? n : '' }}</span
                  >
                </div>

                <!-- 실제 입력 input (투명) -->
                <input
                  class="cell__input"
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

      <div class="tracker">
        <!-- 상단 메모 버튼 -->
        <div class="tracker-header">
          <div
            class="tracker-memo"
            :class="{ 'is-active': isMemoMode }"
            @click.stop="isMemoMode = !isMemoMode"
          >
            ✏️ 메모
          </div>
        </div>

        <!-- 트래커 영역 -->
        <div class="tracker-list">
          <div
            v-for="item in remainingNumbers"
            :key="item.num"
            class="tracker-item"
            :class="{ 'is-used': item.count === 0 }"
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
          <span
            v-for="n in 24"
            :key="n"
            :style="{
              left: `${Math.random() * 100}%`,
              '--speed': Math.random(),
              '--h': Math.random() * 360,
            }"
          ></span>
        </div>
        <div class="success-box">
          <h2>🎉 완료!</h2>
          <p>스도쿠를 완성했어요</p>
          <p>소요 시간: {{ formattedTime }}</p>
          <p>실수 횟수: {{ mistakeCount }}</p>
          <button @click="startGame">새 게임</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import '@/styles/base.css'
import '@/styles/theme-dark.css'

import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { checkBoardSafety, isPossibleByBoard } from '@/sudoku/utils'
import { useSudoku } from '@/composables/useSudoku'
import { useSudokuWorker } from '@/composables/useSudokuWorker'
import { createTimer } from '@/utils/timer'

const difficulty = ref('medium')
const selectedCell = ref(null)
const isMemoMode = ref(false)
const isComplete = ref(false)
const gameStatus = ref('idle') // idle | playing | paused | completed
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

const mistakeCount = ref(0)
const elapsedTime = ref(0)
const isPaused = ref(false)
const timer = createTimer((sec) => {
  elapsedTime.value = sec
})

const formattedTime = computed(() => {
  const min = Math.floor(elapsedTime.value / 60)
  const sec = elapsedTime.value % 60
  return `${min}:${sec.toString().padStart(2, '0')}`
})

function setCellInput(el, i, j) {
  if (el) {
    cellInputs.value[i][j] = el
  }
}

function selectCell(i, j) {
  if (gameStatus.value !== 'playing') {
    selectedCell.value = null
    return
  }

  selectedCell.value = [i, j]
  cellInputs.value[i][j]?.focus()
}

async function startGame() {
  if (isGenerating.value) return

  gameStatus.value = 'playing'
  isComplete.value = false
  isMemoMode.value = false
  selectedCell.value = null

  mistakeCount.value = 0
  isPaused.value = false
  timer.reset()

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

    timer.start()

    console.table(board)
    console.log('중복 체크:', checkBoardSafety(board) ? '중복 없음 ✅' : '중복 있음 ❌')
  } catch (err) {
    console.log('퍼즐 생성 실패', err)
  }
}

function pauseGame() {
  if (gameStatus.value !== 'playing') return

  gameStatus.value = 'paused'
  isPaused.value = true
  selectedCell.value = null
  timer.stop()
}

function resumeGame() {
  if (gameStatus.value !== 'paused') return

  gameStatus.value = 'playing'
  isPaused.value = false
  timer.start()
}

//탭 전환 자동 일시정지
function handleVisibilityChange() {
  document.activeElement?.blur()
  if (document.hidden) {
    pauseGame()
  }
}

onMounted(() => {
  document.addEventListener('visibilitychange', handleVisibilityChange)
})

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', handleVisibilityChange)
})

function handleKey(e, i, j) {
  if (gameStatus.value !== 'playing') {
    e.preventDefault()
    return
  }

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
    if (cell.value === num) {
      cell.value = null
    } else {
      cell.value = num
      // cell.candidates = [];	// 보존 후 숫자 삭제 시 재노출selectedCell

      // ✅ 실수 체크
      if (solution[i][j] !== num) {
        mistakeCount.value++
      }
      sudoku.removeCandidates(userBoard, solution, i, j, num)
    }
  }
}

function handleTrackerInput(num) {
  if (gameStatus.value !== 'playing') return
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

      // ✅ 실수 체크
      if (solution[i][j] !== num) {
        mistakeCount.value++
      }

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

  const selected = selectedCell.value?.[0] === i && selectedCell.value?.[1] === j
  const related =
    selNum !== null &&
    selectedCell.value &&
    (i === si ||
      j === sj ||
      (Math.floor(i / 3) === Math.floor(si / 3) && Math.floor(j / 3) === Math.floor(sj / 3)))
  const highlight = selNum !== null && (cell.value === selNum || board[i][j] === selNum)
  let isError = false
  if (cell.value !== null) {
    // solution과 비교
    isError = solution[i][j] !== cell.value
  }

  return {
    'is-problem': board[i][j] !== null,
    'is-selected': selected,
    'is-error': isError,
    'is-highlighted': highlight,
    'is-related': related,
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
    // solution 준비 전에는 완료 체크 금지
    if (solution[0][0] === null) return

    const b = sudoku.mergedBoard(board, userBoard)
    for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) if (b[i][j] !== solution[i][j]) return

    // 완성 시
    if (!isComplete.value) {
      isComplete.value = true
      gameStatus.value = 'completed'

      timer.stop()
      initConfetti()
    }
  },
  { deep: true },
)
</script>
