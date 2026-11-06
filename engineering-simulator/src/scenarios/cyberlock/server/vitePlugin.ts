/**
 * Vite plugin for CyberLock API
 * Intercepts /api/cyberlock/* in Vite dev & preview servers,
 * routing requests to the server-side CyberlockService.
 */

import type { Plugin, ViteDevServer, PreviewServer } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { cyberlockService } from './cyberlockService.ts'

function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch {
        resolve({})
      }
    })
  })
}

function sendJson(res: ServerResponse, statusCode: number, data: unknown) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(data))
}

function configureCyberlockMiddleware(server: ViteDevServer | PreviewServer) {
  server.middlewares.use(async (req, res, next) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (!url.pathname.startsWith('/api/cyberlock')) {
      return next()
    }

    const path = url.pathname.replace(/^\/api\/cyberlock/, '')

    try {
      // 1. Session start
      if (path === '/session/start' && req.method === 'POST') {
        const body = await readBody(req)
        const serial = String(body.serial || '')
        const teamName = body.teamName ? String(body.teamName) : undefined
        const result = cyberlockService.createSession(serial, teamName)
        if (!result.success) {
          return sendJson(res, 400, { success: false, error: result.error })
        }
        return sendJson(res, 200, {
          success: true,
          sessionId: result.session?.sessionId,
          serial: result.session?.serial,
          teamName: result.session?.teamName,
          targetRecordId: result.session?.targetRecordId,
        })
      }

      // 2. Login
      if (path === '/login' && req.method === 'POST') {
        const body = await readBody(req)
        const result = cyberlockService.verifyLogin(
          String(body.username || ''),
          String(body.password || ''),
        )
        return sendJson(res, result.success ? 200 : 401, result)
      }

      // 3. Shipping Manifest
      if (path === '/manifest' && req.method === 'GET') {
        const manifest = cyberlockService.getShippingManifest()
        return sendJson(res, 200, { success: true, manifest })
      }

      // 4. Record Retrieval (IDOR Vulnerability point)
      if (path === '/record' && req.method === 'GET') {
        const recordId = url.searchParams.get('id') || ''
        const sessionId = url.searchParams.get('session') || undefined
        const result = cyberlockService.getVaultRecord(recordId, sessionId)
        return sendJson(res, result.status, result)
      }

      // 5. Combination Verification
      if (path === '/verify' && req.method === 'POST') {
        const body = await readBody(req)
        const result = cyberlockService.verifyCombination(
          String(body.sessionId || ''),
          String(body.combination || ''),
        )
        return sendJson(res, result.success ? 200 : 400, result)
      }

      // 6. Admin / Facilitator Endpoints
      if (path.startsWith('/admin')) {
        const authHeader = req.headers.authorization || ''
        const token = authHeader.replace(/^Bearer\s+/i, '') || url.searchParams.get('token') || ''
        if (!cyberlockService.verifyAdmin(token)) {
          return sendJson(res, 401, {
            success: false,
            error: 'Unauthorized: Valid BESA facilitator key required.',
          })
        }

        if (path === '/admin/lockboxes' && req.method === 'GET') {
          return sendJson(res, 200, {
            success: true,
            lockboxes: cyberlockService.getAllLockboxes(),
          })
        }

        if (path === '/admin/lockboxes' && req.method === 'POST') {
          const body = await readBody(req)
          const result = cyberlockService.addOrUpdateLockbox({
            serial: String(body.serial || ''),
            recordId: String(body.recordId || ''),
            combination: String(body.combination || ''),
            label: body.label ? String(body.label) : undefined,
          })
          return sendJson(res, result.success ? 200 : 400, result)
        }

        if (path === '/admin/lockboxes' && req.method === 'DELETE') {
          const serial = url.searchParams.get('serial') || ''
          const success = cyberlockService.deleteLockbox(serial)
          return sendJson(res, 200, { success })
        }
      }

      // Unknown endpoint under /api/cyberlock
      return sendJson(res, 404, { success: false, error: 'Endpoint not found' })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal server error'
      return sendJson(res, 500, { success: false, error: message })
    }
  })
}

export function cyberlockApiPlugin(): Plugin {
  return {
    name: 'cyberlock-api-plugin',
    configureServer(server) {
      configureCyberlockMiddleware(server)
    },
    configurePreviewServer(server) {
      configureCyberlockMiddleware(server)
    },
  }
}
