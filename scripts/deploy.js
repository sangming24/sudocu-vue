/* eslint-env node */
import { execSync } from 'child_process'

function run(cmd) {
  console.log(`\n▶ ${cmd}`)
  execSync(cmd, { stdio: 'inherit' })
}

function getOutput(cmd) {
  return execSync(cmd).toString().trim()
}

try {
  // 1. main 브랜치인지 확인
  const branch = getOutput('git branch --show-current')
  if (branch !== 'main') {
    console.error('❌ main 브랜치에서만 실행할 수 있습니다.')
    process.exit(1)
  }

  // 2. 변경 사항 확인
  const status = getOutput('git status --porcelain')

  if (status) {
    const message = process.argv[2] || 'chore: update source before deploy'

    console.log('📝 변경 사항이 있어 자동 커밋합니다.')
    run('git add .')
    run(`git commit -m "${message}"`)
    run('git push origin main')
  } else {
    console.log('ℹ️ 커밋할 변경 사항 없음')
  }

  // 3. 최신 코드 보장
  run('git pull origin main')

  // 4. 빌드
  run('npm run build')

  // 5. gh-pages 배포
  run('npx gh-pages -d dist')

  console.log('\n✅ 커밋 + 배포 완료!')
} catch (e) {
  console.error('\n❌ 배포 중 오류 발생', e)
  process.exit(1)
}
