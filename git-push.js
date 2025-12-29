import { exec } from 'child_process'

const commitMessage = process.argv[2] || '자동 커밋'

const commands = [
  // 1. 빌드
  'npm run build',

  // 2. git add
  'git add .',

  // 3. git commit
  `git commit -m "${commitMessage}" || echo "Nothing to commit"`,

  // 4. git pull (충돌 있으면 그냥 병합)
  'git pull --rebase --autostash origin gh-pages || git pull --allow-unrelated-histories origin gh-pages',

  // 5. gh-pages로 push
  'git push origin gh-pages',
]

function runCommand(cmd) {
  return new Promise((resolve) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) console.error(`❌ Error: ${error.message}`)
      if (stderr) console.error(`stderr: ${stderr}`)
      console.log(stdout)
      resolve() // 에러 있어도 멈추지 않게
    })
  })
}

;(async () => {
  for (let cmd of commands) {
    await runCommand(cmd)
  }
  console.log('✅ Git push 완료!')
})()
