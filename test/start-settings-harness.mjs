import { mkdtemp, mkdir, writeFile, symlink, open } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'

const home = await mkdtemp(join(tmpdir(), 'noteboard-settings-harness-'))
const profile = join(home, 'profiles/web')
await mkdir(join(profile, 'node_modules'), { recursive: true })
await writeFile(join(profile, 'package.json'), JSON.stringify({
  name: 'noteboard-settings-test', private: true,
  dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', 'dsh-noteboard'], patchReload: 'live' } },
}))
await symlink(resolve('.'), join(profile, 'node_modules/dsh-noteboard'))
const log = join(home, 'server.log'), output = await open(log, 'a', 0o600)
const child = spawn('dsh', ['web', '--no-open', '--port', '0'], { env: { ...process.env, DSH_HOME: home }, detached: true, stdio: ['ignore', output.fd, output.fd] })
child.unref(); await output.close()
const metadata = { home, log, pid: child.pid }
await mkdir('artifacts/settings', { recursive: true })
await writeFile('artifacts/settings/harness.json', JSON.stringify(metadata))
console.log(JSON.stringify(metadata))
