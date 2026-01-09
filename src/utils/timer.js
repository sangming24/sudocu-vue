// src/utils/timer.js
export function createTimer(onTick) {
  let startTime = 0
  let accumulated = 0 // 누적 시간(ms)
  let timerId = null

  function start() {
    if (timerId) return

    startTime = Date.now()

    timerId = setInterval(() => {
      const elapsed = Math.floor((accumulated + Date.now() - startTime) / 1000)
      onTick(elapsed)
    }, 1000)
  }

  function stop() {
    if (!timerId) return

    accumulated += Date.now() - startTime
    clearInterval(timerId)
    timerId = null
  }

  function reset() {
    clearInterval(timerId)
    timerId = null
    startTime = 0
    accumulated = 0
    onTick(0)
  }

  return {
    start,
    stop,
    reset,
  }
}
