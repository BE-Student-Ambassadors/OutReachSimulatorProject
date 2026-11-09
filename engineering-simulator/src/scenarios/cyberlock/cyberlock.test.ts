import { describe, it, expect, beforeEach } from 'vitest'
import {
  cyberlockService,
  combinationToHexAscii,
  hexAsciiToCombination,
} from './server/cyberlockService'
import { lookupHex } from './data/asciiData'

describe('CyberLock — Operation Vaultbreak', () => {
  beforeEach(() => {
    cyberlockService.resetToDefaults()
  })

  describe('Hexadecimal & ASCII Utilities', () => {
    it('accurately encodes 4-digit combinations to hex ASCII byte sequences', () => {
      expect(combinationToHexAscii('4826')).toBe('34 38 32 36')
      expect(combinationToHexAscii('1937')).toBe('31 39 33 37')
      expect(combinationToHexAscii('6504')).toBe('36 35 30 34')
      expect(combinationToHexAscii('2719')).toBe('32 37 31 39')
    })

    it('accurately decodes hex ASCII sequences back to combinations', () => {
      expect(hexAsciiToCombination('34 38 32 36')).toBe('4826')
      expect(hexAsciiToCombination('31 39 33 37')).toBe('1937')
    })

    it('looks up individual ASCII byte equivalents', () => {
      expect(lookupHex('34')?.character).toBe('4')
      expect(lookupHex('38')?.character).toBe('8')
      expect(lookupHex('32')?.character).toBe('2')
      expect(lookupHex('36')?.character).toBe('6')
    })
  })

  describe('Session Initialization & Serial Validation', () => {
    it('initializes a scoped session for valid physical lockbox serial', () => {
      const res = cyberlockService.createSession('BESA-0427', 'Test Slug Team')
      expect(res.success).toBe(true)
      expect(res.session).toBeDefined()
      expect(res.session?.serial).toBe('BESA-0427')
      expect(res.session?.targetRecordId).toBe('1003')
    })

    it('rejects invalid or unknown serial numbers with informative error', () => {
      const res = cyberlockService.createSession('UNKNOWN-9999', 'Fake Team')
      expect(res.success).toBe(false)
      expect(res.error).toContain('Unrecognized serial number')
    })
  })

  describe('Challenge 1: Gain Access (Authentication & OSINT)', () => {
    it('accepts valid credentials for amorgan / Atlas2022', () => {
      const res = cyberlockService.verifyLogin('amorgan', 'Atlas2022')
      expect(res.success).toBe(true)
      expect(res.user?.username).toBe('amorgan')
      expect(res.user?.name).toBe('Alex Morgan')
    })

    it('rejects invalid passwords', () => {
      const res = cyberlockService.verifyLogin('amorgan', 'password123')
      expect(res.success).toBe(false)
      expect(res.message).toContain('Authentication failed')
    })

    it('rejects unknown usernames', () => {
      const res = cyberlockService.verifyLogin('johndoe', 'Atlas2022')
      expect(res.success).toBe(false)
    })
  })

  describe('Challenge 2: Insecure Direct Object Reference (IDOR)', () => {
    it('allows access to standard unrestricted records 1001 and 1002', () => {
      const r1 = cyberlockService.getVaultRecord('1001')
      expect(r1.success).toBe(true)
      expect(r1.record?.id).toBe('1001')
      expect(r1.record?.isRestricted).toBe(false)

      const r2 = cyberlockService.getVaultRecord('1002')
      expect(r2.success).toBe(true)
      expect(r2.record?.id).toBe('1002')
    })

    it('exploits IDOR when directly requesting the team’s assigned restricted record', () => {
      const sessionRes = cyberlockService.createSession('BESA-0001', 'Alpha Team')
      const sessionId = sessionRes.session!.sessionId

      // Requesting assigned restricted record #1003 directly returns the record with hex payload
      const recordRes = cyberlockService.getVaultRecord('1003', sessionId)
      expect(recordRes.success).toBe(true)
      expect(recordRes.record?.id).toBe('1003')
      expect(recordRes.record?.isRestricted).toBe(true)
      expect(recordRes.record?.hexPayload).toBe('34 38 32 36')
    })

    it('protects other teams’ combinations from unrestricted snooping', () => {
      // Team 1 has serial BESA-0001 (target record 1003)
      const session1 = cyberlockService.createSession('BESA-0001', 'Team 1').session!

      // If Team 1 tries to probe Team 2's private record 1014, access is prohibited
      const recordRes = cyberlockService.getVaultRecord('1014', session1.sessionId)
      expect(recordRes.success).toBe(false)
      expect(recordRes.status).toBe(403)
      expect(recordRes.error).toContain('ACCESS PROHIBITED')
    })
  })

  describe('Challenge 3: Combination Verification', () => {
    it('verifies the correct 4-digit code and awards 150 points', () => {
      const session = cyberlockService.createSession('BESA-0001', 'Team 1').session!
      const verifyRes = cyberlockService.verifyCombination(session.sessionId, '4826')
      expect(verifyRes.success).toBe(true)
      expect(verifyRes.points).toBe(150)
      expect(verifyRes.message).toContain('ACCESS CODE CONFIRMED')
    })

    it('rejects incorrect combinations without revealing the secret', () => {
      const session = cyberlockService.createSession('BESA-0001', 'Team 1').session!
      const verifyRes = cyberlockService.verifyCombination(session.sessionId, '9999')
      expect(verifyRes.success).toBe(false)
      expect(verifyRes.points).toBe(0)
      expect(verifyRes.message).toContain('incorrect')
    })
  })

  describe('Facilitator & Admin Operations', () => {
    it('authenticates with the facilitator key', () => {
      expect(cyberlockService.verifyAdmin('besa-facilitator-2026')).toBe(true)
      expect(cyberlockService.verifyAdmin('wrong-key')).toBe(false)
    })

    it('allows facilitators to add and update lockbox configurations', () => {
      const addRes = cyberlockService.addOrUpdateLockbox({
        serial: 'BESA-0009',
        recordId: '1099',
        combination: '7412',
        label: 'Workshop Extra Box',
      })
      expect(addRes.success).toBe(true)

      const lb = cyberlockService.getLockbox('BESA-0009')
      expect(lb).toBeDefined()
      expect(lb?.combination).toBe('7412')
      expect(lb?.recordId).toBe('1099')
    })
  })
})
