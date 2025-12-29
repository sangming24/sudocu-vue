import { exec } from 'child_process'

const commitMessage = process.argv[2] || '자동 커밋'

// 명령어를 순서대로 실행
const commands = [
  // 1. 빌드
  'npm run build',

  // 2. git add
  'git add .',

  // 3. commit (변경 없으면 스킵)
  `git commit -m "${commitMessage}" || echo "Nothing to commit"`,

  // 4. pull --rebase, 충돌 있으면 자동 stash 후 진행
  'git pull --rebase --autostash origin gh-pages || echo "Pull skipped due to conflict"',

  // 5. push gh-pages
  'git push origin gh-pages',
]

// 커맨드 실행 함수
function runCommand(cmd) {
  return new Promise((resolve) => {
    exec(cmd, (error, stdout, stderr) => {
      if (stdout) console.log(stdout)
      if (stderr) console.error(stderr)
      if (error) console.error(`❌ Error: ${error.message}`)
      // 에러 있어도 멈추지 않음
      resolve()
    })
  })
}

// 순차적으로 실행
;(async () => {
  for (const cmd of commands) {
    await runCommand(cmd)
  }
  console.log('✅ Git push 완료!')
})()
