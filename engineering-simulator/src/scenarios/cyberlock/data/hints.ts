import type { HintItem } from '../types'

export const CHALLENGE_HINTS: Record<'challenge1' | 'challenge2' | 'challenge3', HintItem[]> = {
  challenge1: [
    {
      id: 'c1_h1',
      challenge: 'challenge1',
      level: 1,
      title: 'Check the Public Staff Directory',
      content:
        'VaultTech’s public website lists employees and departments. Explore who works in IT Administration or Systems, and look closely at their profile details and bio.',
      pointsDeducted: 25,
    },
    {
      id: 'c1_h2',
      challenge: 'challenge1',
      level: 2,
      title: 'Inspect Password Security Hints & News',
      content:
        'Try logging into Alex Morgan’s account (amorgan) or click "Forgot Password?". Alex’s recovery hint mentions "My favorite robot and the year I joined." Check the Company News or About page to discover when Alex joined and which robot project was Alex’s favorite.',
      pointsDeducted: 25,
    },
    {
      id: 'c1_h3',
      challenge: 'challenge1',
      level: 3,
      title: 'Combine Robot Name and Joining Year',
      content:
        'The news articles show Alex Morgan joined VaultTech in 2022 and built the "Atlas" heavy-payload robotic arm. Predictable passwords often concatenate key words: try the password "Atlas2022" (capital A).',
      pointsDeducted: 25,
    },
  ],
  challenge2: [
    {
      id: 'c2_h1',
      challenge: 'challenge2',
      level: 1,
      title: 'Cross-reference Your Lockbox Serial',
      content:
        'In the internal dashboard, look at the Shipping Manifest & Logistics tab. Find the entry matching your physical lockbox serial number (e.g., BESA-0427) to identify its assigned Internal Record ID.',
      pointsDeducted: 25,
    },
    {
      id: 'c2_h2',
      challenge: 'challenge2',
      level: 2,
      title: 'Observe URL Addressing in the Browser',
      content:
        'Open Record #1001 or #1002 from the Vault Records list. Observe the simulated browser address bar at the top: notice how the URL ends with "/vault/1001" or "/vault/1002".',
      pointsDeducted: 25,
    },
    {
      id: 'c2_h3',
      challenge: 'challenge2',
      level: 3,
      title: 'Edit the Record Number in the Address Bar',
      content:
        'Although the internal web buttons block Level 1 users from restricted records, the backend does not verify permissions on direct object URLs! Click the address bar, replace the number with your lockbox’s record ID (e.g. /vault/1003 or your record ID), and press Enter.',
      pointsDeducted: 25,
    },
  ],
  challenge3: [
    {
      id: 'c3_h1',
      challenge: 'challenge3',
      level: 1,
      title: 'Identify the Encoding Format',
      content:
        'The recovered record contains space-separated pairs of alphanumeric characters (e.g. "34 38 32 36"). This is hexadecimal (base-16) byte notation representing ASCII text.',
      pointsDeducted: 25,
    },
    {
      id: 'c3_h2',
      challenge: 'challenge3',
      level: 2,
      title: 'Use the ASCII Reference Table',
      content:
        'Each pair of hex numbers represents one character. In the ASCII standard, printable digits "0" through "9" have hex codes starting with 3 (for instance, 0x30 = "0", 0x31 = "1", 0x32 = "2"). Use the lookup tool to convert each byte.',
      pointsDeducted: 25,
    },
    {
      id: 'c3_h3',
      challenge: 'challenge3',
      level: 3,
      title: 'Translate Each Byte into a Digit',
      content:
        'Take each two-character hex byte one by one: for example, 34 in hex corresponds to character "4", 38 corresponds to "8", 32 corresponds to "2", and 36 corresponds to "6". Enter the resulting 4-digit code into the combination lock.',
      pointsDeducted: 25,
    },
  ],
}
