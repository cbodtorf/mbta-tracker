import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

function slackDevProxy(): Plugin {
  let webhookUrl: string | undefined
  return {
    name: 'slack-dev-proxy',
    configResolved(config) {
      const env = loadEnv(config.mode, config.root, '')
      webhookUrl = env.SLACK_WEBHOOK_URL
    },
    configureServer(server) {
      server.middlewares.use('/api/slack', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }
        if (!webhookUrl) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: 'SLACK_WEBHOOK_URL not configured' }))
          return
        }
        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(chunk as Buffer)
        const body = JSON.parse(Buffer.concat(chunks).toString())

        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: body.text }),
        })

        res.statusCode = response.ok ? 200 : 502
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: response.ok }))
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), slackDevProxy()],
})
