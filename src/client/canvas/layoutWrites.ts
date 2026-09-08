import { rpc } from '../api'
type Job = { timer: ReturnType<typeof setTimeout> | null; args: any; running?: Promise<any>; error?: string }
const jobs = new Map<string, Job>()
const inFlight = new Map<string, Promise<any>>()
const keyOf = (root: string, canvas: string) => `${root}\n${canvas}`
export function pendingLayout(root: string, canvas: string) { return jobs.get(keyOf(root, canvas)) }
export function queueLayout(root: string, canvas: string, args: any, onResult: (error?: string) => void) {
  const key = keyOf(root, canvas), prior = jobs.get(key)
  if (prior?.timer) clearTimeout(prior.timer)
  const job: Job = { args, timer: null }
  jobs.set(key, job)
  job.timer = setTimeout(() => { job.timer = null; void flushLayout(root, canvas).then(() => onResult(), (e) => onResult(e.message)) }, 400)
}
export async function flushLayout(root: string, canvas: string) {
  const key = keyOf(root, canvas), job = jobs.get(key)
  if (!job) return
  if (job.timer) { clearTimeout(job.timer); job.timer = null }
  if (job.running) return job.running
  const previous = inFlight.get(key)
  job.running = (previous ?? Promise.resolve()).then(() => rpc(root, 'writeCanvas', job.args)).then((result) => {
    if (jobs.get(key) === job) jobs.delete(key)
    else { const next = jobs.get(key); if (next) next.args.canvasVersion = result.canvasVersion }
    return result
  }, (e) => { job.error = e.message; job.running = undefined; throw e })
  const running = job.running
  inFlight.set(key, running)
  void running.finally(() => { if (inFlight.get(key) === running) inFlight.delete(key) }).catch(() => {})
  return job.running
}
