import net from 'node:net'
import { spawn } from 'node:child_process'

const PORT = 5173
const HOSTS = ['127.0.0.1', '::1', 'localhost']

function canConnect(port, host) {
	return new Promise((resolve) => {
		const socket = net.createConnection({ port, host })
		socket.once('connect', () => {
			socket.destroy()
			resolve(true)
		})
		socket.once('error', () => {
			socket.destroy()
			resolve(false)
		})
	})
}

async function isPortOpen(port) {
	for (const host of HOSTS) {
		if (await canConnect(port, host)) return true
	}
	return false
}

if (await isPortOpen(PORT)) {
	console.log(`Dev server already running at http://localhost:${PORT} — leaving it running.`)
	process.exit(0)
}

const vite = spawn('vite', [], { stdio: 'inherit', shell: true })
vite.on('exit', (code) => process.exit(code ?? 0))
