import { SudokuBoardStore } from '@/workersPool/sudokuBoardStore'
import { SudokuWorkerPool } from '@/workersPool/sudokuWorkerPool'
import { ref, onUnmounted } from 'vue'

const isGenerating = ref(false)

// worker pool 생성
const pool = new SudokuWorkerPool(Math.max(2, navigator.hardwareConcurrency - 1))

// 재고 관리자 생성
const boardStore = new SudokuBoardStore(pool)

// 앱 시작 시 미리 채워두기
boardStore.warmUp()

export function useSudokuWorker() {
  async function generate(difficulty) {
    if (isGenerating.value) return

    isGenerating.value = true

    try {
      return await boardStore.getBoard(difficulty)
    } catch (err) {
      console.log('생성 오류 ', err)
    } finally {
      isGenerating.value = false
    }
  }

  onUnmounted(() => {
    pool.terminate()
  })

  return {
    generate,
    isGenerating,
  }
}
