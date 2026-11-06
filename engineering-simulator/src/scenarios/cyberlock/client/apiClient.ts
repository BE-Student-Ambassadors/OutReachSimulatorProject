/**
 * Client API for CyberLock
 * Communicates with the backend server endpoints at /api/cyberlock/*
 * Includes client resilience fallback.
 */

import type { LockboxConfig, VaultRecord, ShippingManifestEntry } from '../types'
import { cyberlockService } from '../server/cyberlockService'

class CyberlockApiClient {
  private hasCheckedBackend = false

  private async fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
    try {
      const res = await fetch(url, options)
      const data = await res.json()
      this.hasCheckedBackend = true
      return data
    } catch {
      // If server endpoint is unreachable (e.g. offline static deployment), use direct service fallback
      if (!this.hasCheckedBackend) {
        console.warn(
          '[CyberLock] Backend API unreachable at /api/cyberlock. Falling back to local in-memory simulation service.',
        )
      }
      this.hasCheckedBackend = true
      throw new Error('Network error calling ' + url)
    }
  }

  public async startSession(
    serial: string,
    teamName: string,
  ): Promise<{ success: boolean; sessionId?: string; serial?: string; targetRecordId?: string; error?: string }> {
    try {
      return await this.fetchJson('/api/cyberlock/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serial, teamName }),
      })
    } catch {
      const res = cyberlockService.createSession(serial, teamName)
      if (res.success && res.session) {
        return {
          success: true,
          sessionId: res.session.sessionId,
          serial: res.session.serial,
          targetRecordId: res.session.targetRecordId,
        }
      }
      return { success: false, error: res.error }
    }
  }

  public async login(
    username: string,
    password: string,
  ): Promise<{ success: boolean; message: string; user?: { username: string; name: string; department: string } }> {
    try {
      return await this.fetchJson('/api/cyberlock/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
    } catch {
      return cyberlockService.verifyLogin(username, password)
    }
  }

  public async getShippingManifest(): Promise<{ success: boolean; manifest: ShippingManifestEntry[] }> {
    try {
      return await this.fetchJson('/api/cyberlock/manifest')
    } catch {
      return {
        success: true,
        manifest: cyberlockService.getShippingManifest(),
      }
    }
  }

  public async getRecord(
    recordId: string,
    sessionId?: string,
  ): Promise<{ success: boolean; record?: VaultRecord; error?: string }> {
    try {
      const q = new URLSearchParams({ id: recordId })
      if (sessionId) q.set('session', sessionId)
      return await this.fetchJson(`/api/cyberlock/record?${q.toString()}`)
    } catch {
      const res = cyberlockService.getVaultRecord(recordId, sessionId)
      return {
        success: res.success,
        record: res.record,
        error: res.error,
      }
    }
  }

  public async verifyCombination(
    sessionId: string,
    combination: string,
  ): Promise<{ success: boolean; message: string; points: number }> {
    try {
      return await this.fetchJson('/api/cyberlock/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, combination }),
      })
    } catch {
      return cyberlockService.verifyCombination(sessionId, combination)
    }
  }

  public async adminGetLockboxes(
    token: string,
  ): Promise<{ success: boolean; lockboxes?: LockboxConfig[]; error?: string }> {
    try {
      return await this.fetchJson('/api/cyberlock/admin/lockboxes', {
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch {
      if (cyberlockService.verifyAdmin(token)) {
        return { success: true, lockboxes: cyberlockService.getAllLockboxes() }
      }
      return { success: false, error: 'Unauthorized key.' }
    }
  }

  public async adminSaveLockbox(
    token: string,
    config: LockboxConfig,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      return await this.fetchJson('/api/cyberlock/admin/lockboxes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(config),
      })
    } catch {
      if (!cyberlockService.verifyAdmin(token)) {
        return { success: false, error: 'Unauthorized key.' }
      }
      return cyberlockService.addOrUpdateLockbox(config)
    }
  }

  public async adminDeleteLockbox(
    token: string,
    serial: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      return await this.fetchJson(`/api/cyberlock/admin/lockboxes?serial=${encodeURIComponent(serial)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch {
      if (!cyberlockService.verifyAdmin(token)) {
        return { success: false, error: 'Unauthorized key.' }
      }
      return { success: cyberlockService.deleteLockbox(serial) }
    }
  }
}

export const cyberlockApi = new CyberlockApiClient()
