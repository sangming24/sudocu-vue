import { exec } from 'child_process'

const commitMessage = process.argv[2] || '자동 커밋'

const commands = [
  'git add .',
  `git commit -m "${commitMessage}"`,
  'git push origin gh-pages', // gh-pages에 올리려면 gh-pages로 변경
]

function runCommand(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error(`❌ Error: ${error.message}`)
        return reject(error)
      }
      if (stderr) console.error(`stderr: ${stderr}`)
      console.log(stdout)
      resolve()
    })
  })
}

;(async () => {
  for (let cmd of commands) {
    await runCommand(cmd)
  }
  console.log('✅ Git push 완료!')
})()
