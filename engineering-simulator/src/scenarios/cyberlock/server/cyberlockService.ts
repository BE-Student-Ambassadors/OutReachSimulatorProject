/**
 * CyberLock Server Service
 *
 * Implements server-side secret storage, session isolation,
 * IDOR vulnerability simulation, and facilitator endpoints.
 * Answers and secret tables are never bundled into the client build.
 */

import type { LockboxConfig, VaultRecord, ShippingManifestEntry } from '../types.ts'

export function combinationToHexAscii(code: string): string {
  return code
    .split('')
    .map((ch) => ch.charCodeAt(0).toString(16).toLowerCase())
    .join(' ')
}

export function hexAsciiToCombination(hex: string): string {
  return hex
    .trim()
    .split(/\s+/)
    .map((h) => String.fromCharCode(parseInt(h, 16)))
    .join('')
}

/** Default lockboxes configured for BESA workshops */
const DEFAULT_LOCKBOXES: LockboxConfig[] = [
  { serial: 'BESA-0001', recordId: '1003', combination: '4826', label: 'Vault Alpha' },
  { serial: 'BESA-0002', recordId: '1014', combination: '1937', label: 'Vault Bravo' },
  { serial: 'BESA-0003', recordId: '1027', combination: '6504', label: 'Vault Charlie' },
  { serial: 'BESA-0004', recordId: '1038', combination: '2719', label: 'Vault Delta' },
  { serial: 'BESA-0427', recordId: '1042', combination: '5183', label: 'Vault DTI Special' },
]

export interface ActiveSession {
  sessionId: string
  serial: string
  targetRecordId: string
  teamName: string
  startTime: number
}

export class CyberlockService {
  private lockboxes: Map<string, LockboxConfig> = new Map()
  private sessions: Map<string, ActiveSession> = new Map()
  private adminToken: string = process.env.CYBERLOCK_ADMIN_KEY || 'besa-facilitator-2026'

  constructor() {
    this.resetToDefaults()
  }

  public resetToDefaults(): void {
    this.lockboxes.clear()
    for (const lb of DEFAULT_LOCKBOXES) {
      this.lockboxes.set(lb.serial.toUpperCase().trim(), { ...lb })
    }
  }

  public getLockbox(serial: string): LockboxConfig | undefined {
    return this.lockboxes.get(serial.toUpperCase().trim())
  }

  public getAllLockboxes(): LockboxConfig[] {
    return Array.from(this.lockboxes.values())
  }

  public addOrUpdateLockbox(config: LockboxConfig): { success: boolean; error?: string } {
    const cleanSerial = config.serial.toUpperCase().trim()
    const cleanRecord = config.recordId.trim()
    const cleanCode = config.combination.trim()

    if (!cleanSerial.startsWith('BESA-') || cleanSerial.length < 6) {
      return { success: false, error: 'Serial number must follow BESA-XXXX format (e.g. BESA-0005).' }
    }
    if (!/^\d{4}$/.test(cleanRecord)) {
      return { success: false, error: 'Internal Record ID must be a 4-digit number (e.g. 1045).' }
    }
    if (!/^\d{4}$/.test(cleanCode)) {
      return { success: false, error: 'Physical lock combination must be exactly 4 digits (e.g. 4826).' }
    }

    this.lockboxes.set(cleanSerial, {
      serial: cleanSerial,
      recordId: cleanRecord,
      combination: cleanCode,
      label: config.label?.trim() || `Vault ${cleanSerial}`,
    })
    return { success: true }
  }

  public deleteLockbox(serial: string): boolean {
    return this.lockboxes.delete(serial.toUpperCase().trim())
  }

  public createSession(serial: string, teamName: string = 'Team Vaultbreak'): { success: boolean; session?: ActiveSession; error?: string } {
    const cleanSerial = serial.toUpperCase().trim()
    const lockbox = this.getLockbox(cleanSerial)
    if (!lockbox) {
      return {
        success: false,
        error: `Unrecognized serial number "${serial}". Please verify the serial label printed on your physical lockbox (e.g. BESA-0001, BESA-0002, BESA-0427).`,
      }
    }

    const sessionId = 'session_' + Math.random().toString(36).substring(2, 12) + '_' + Date.now().toString(36)
    const session: ActiveSession = {
      sessionId,
      serial: lockbox.serial,
      targetRecordId: lockbox.recordId,
      teamName: teamName.trim() || 'Team Vaultbreak',
      startTime: Date.now(),
    }
    this.sessions.set(sessionId, session)
    return { success: true, session }
  }

  public getSession(sessionId: string): ActiveSession | undefined {
    return this.sessions.get(sessionId)
  }

  /**
   * Challenge 1: Employee login verification
   */
  public verifyLogin(username: string, password: string): { success: boolean; message: string; user?: { username: string; name: string; department: string } } {
    const u = username.trim().toLowerCase()
    const p = password.trim()

    if (u === 'amorgan' && p === 'Atlas2022') {
      return {
        success: true,
        message: 'Authentication successful. Access granted to internal intranet.',
        user: {
          username: 'amorgan',
          name: 'Alex Morgan',
          department: 'IT Administration & Infrastructure',
        },
      }
    }

    if (u !== 'amorgan') {
      return {
        success: false,
        message: `Authentication failed: Username "${username}" is not authorized for remote administrative login.`,
      }
    }

    return {
      success: false,
      message: 'Authentication failed: Invalid credentials. Password does not match user account record.',
    }
  }

  /**
   * Challenge 2: Record retrieval
   * Demonstrates Insecure Direct Object Reference (IDOR).
   * Note: The UI denies standard links to restricted records, but when requested
   * directly by ID through the simulated browser URL, the backend returns the record!
   * Scoped isolation prevents students from enumerating other teams' combinations.
   */
  public getVaultRecord(recordId: string, sessionId?: string): { success: boolean; record?: VaultRecord; error?: string; status: number } {
    const id = recordId.trim()
    const session = sessionId ? this.sessions.get(sessionId) : undefined

    // Standard accessible record 1001
    if (id === '1001') {
      return {
        success: true,
        status: 200,
        record: {
          id: '1001',
          title: 'Storage Bay Environmental Telemetry',
          classification: 'Internal',
          isRestricted: false,
          accessAllowedInUI: true,
          content: 'Sector 4 Storage Bay: Ambient Temperature: 19.4°C. Relative Humidity: 42%. HVAC ventilation dampers: Nominal. Fire suppression systems: Active and armed.',
          timestamp: '2026-11-06 08:30:15 PST',
        },
      }
    }

    // Standard accessible record 1002
    if (id === '1002') {
      return {
        success: true,
        status: 200,
        record: {
          id: '1002',
          title: 'Robotics Calibration & Maintenance Log',
          classification: 'Internal',
          isRestricted: false,
          accessAllowedInUI: true,
          content: 'Atlas Heavy-Lift Robotic Arm (Unit #04): Joint 3 torque sensor recalibrated. Actuator positioning variance < 0.015 mm. Routine inspection completed by Alex Morgan.',
          timestamp: '2026-11-05 14:12:00 PST',
        },
      }
    }

    // Check if this recordId belongs to ANY configured lockbox
    let matchingLockbox: LockboxConfig | undefined
    for (const lb of this.lockboxes.values()) {
      if (lb.recordId === id) {
        matchingLockbox = lb
        break
      }
    }

    if (!matchingLockbox) {
      return {
        success: false,
        status: 404,
        error: `Record #${id} not found in VaultTech internal repository. Verify the record ID in the Shipping Manifest.`,
      }
    }

    // Session-scoped isolation:
    // If a session is active, verify that the record matches the team's assigned target record.
    // If not matching, we protect other teams' combinations from being snooped!
    if (session && session.targetRecordId !== id) {
      return {
        success: false,
        status: 403,
        error: `ACCESS PROHIBITED: Record #${id} belongs to a different regional operational container. Your investigation is restricted to your assigned lockbox asset (${session.serial}).`,
      }
    }

    // IDOR vulnerability successfully exploited!
    // The server does NOT enforce role/authorization checks on direct ID requests!
    const hex = combinationToHexAscii(matchingLockbox.combination)
    return {
      success: true,
      status: 200,
      record: {
        id: matchingLockbox.recordId,
        title: `Classified Vault Asset - Storage Unit ${matchingLockbox.serial}`,
        classification: 'Restricted',
        isRestricted: true,
        accessAllowedInUI: false, // UI hides/disables it, but direct URL retrieves it!
        serial: matchingLockbox.serial,
        hexPayload: hex,
        encodingFormat: 'Hexadecimal ASCII Byte Sequence (Base-16)',
        content: `AUTHORIZED LOGISTICS DATA DUMP:
Physical Hardware Asset: ${matchingLockbox.serial} (${matchingLockbox.label || 'Secure Lockbox'})
Routing Code: Baskin Engineering / DTI Outreach
Security Protocol: Encoded Lock Register (Hardware Lockbox Model 4-Dial)
Warning: Raw hexadecimal byte stream exposed due to missing endpoint authorization enforcement.`,
        timestamp: '2026-11-06 09:44:22 PST',
      },
    }
  }

  /**
   * Challenge 3: Combination verification
   */
  public verifyCombination(sessionId: string, enteredCode: string): { success: boolean; message: string; points: number } {
    const session = this.sessions.get(sessionId)
    if (!session) {
      return {
        success: false,
        message: 'Session expired or not found. Please re-enter your lockbox serial number.',
        points: 0,
      }
    }

    const lockbox = this.getLockbox(session.serial)
    if (!lockbox) {
      return {
        success: false,
        message: 'Lockbox configuration missing for this session.',
        points: 0,
      }
    }

    const cleanInput = enteredCode.trim().replace(/\D/g, '')
    if (cleanInput.length !== 4) {
      return {
        success: false,
        message: 'The physical combination must be exactly 4 numeric digits.',
        points: 0,
      }
    }

    if (cleanInput === lockbox.combination) {
      return {
        success: true,
        message: `ACCESS CODE CONFIRMED! Combination ${lockbox.combination} matches lockbox ${session.serial}.`,
        points: 150,
      }
    }

    return {
      success: false,
      message: `Combination "${cleanInput}" is incorrect. The physical lock tumblers will not turn. Re-check the hexadecimal ASCII decoding table for each byte.`,
      points: 0,
    }
  }

  /**
   * Facilitator Admin authentication
   */
  public verifyAdmin(token?: string): boolean {
    if (!token) return false
    return token.trim() === this.adminToken.trim()
  }

  /**
   * Shipping Manifest entries generated dynamically based on active lockboxes
   */
  public getShippingManifest(): ShippingManifestEntry[] {
    const entries: ShippingManifestEntry[] = []

    // Background entries to make it a realistic manifest
    entries.push(
      {
        serial: 'SYS-SRV-0109',
        recordId: '1001',
        assetName: 'Telemetry Sensor Cluster Array',
        destination: 'Engineering Bay 4',
        status: 'Delivered',
        classification: 'Standard',
        dispatchDate: '2026-11-01',
      },
      {
        serial: 'ROB-ACT-0842',
        recordId: '1002',
        assetName: 'Atlas Servo Recalibration Kit',
        destination: 'Robotics Workshop B',
        status: 'Delivered',
        classification: 'Standard',
        dispatchDate: '2026-11-03',
      },
    )

    // Add configured lockboxes
    for (const lb of this.lockboxes.values()) {
      entries.push({
        serial: lb.serial,
        recordId: lb.recordId,
        assetName: `Secure Field Lockbox Container (${lb.label || lb.serial})`,
        destination: 'UCSC Baskin Engineering Outreach — DTI Demo',
        status: 'Dispatched',
        classification: 'Restricted',
        dispatchDate: '2026-11-06',
      })
    }

    // Sort so target serial is easily findable if searched or scrolled
    return entries
  }
}

// Singleton server instance
export const cyberlockService = new CyberlockService()
