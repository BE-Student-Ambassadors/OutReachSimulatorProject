import type { EmployeeProfile } from '../types'

export const VAULTTECH_EMPLOYEES: EmployeeProfile[] = [
  {
    id: 'emp_01',
    username: 'amorgan',
    name: 'Alex Morgan',
    role: 'Senior Infrastructure & IT Administrator',
    department: 'IT Administration',
    email: 'a.morgan@vaulttech.corp',
    location: 'Building C — Sector 4 Server Room',
    bio: 'Alex oversees core directory services, storage networks, and automated manufacturing pipelines. Prior to joining VaultTech in 2022, Alex specialized in high-torque industrial automation and robotics kinematics.',
    joinedYear: 2022,
    keyProjects: ['Project Atlas Robotic Arm', 'Internal Directory Migration', 'Central Vault Telemetry'],
    securityHintQuestion: 'Security Verification Hint',
    securityHintAnswer: 'My favorite robot and the year I joined.',
  },
  {
    id: 'emp_02',
    username: 'jlee',
    name: 'Jordan Lee',
    role: 'Lead Mechatronics Engineer',
    department: 'Robotics & Hardware',
    email: 'j.lee@vaulttech.corp',
    location: 'Building A — Rapid Prototyping Lab',
    bio: 'Jordan leads chassis modeling, dynamic motor testing, and brushless actuator drivers. Joined VaultTech in 2021 to pioneer high-speed inspection rovers.',
    joinedYear: 2021,
    keyProjects: ['Valkyrie Rover', 'Brushless Motor Dyno', 'Battery Enclosure v3'],
    securityHintQuestion: 'Favorite test track location',
    securityHintAnswer: 'Mojave Desert Proving Grounds',
  },
  {
    id: 'emp_03',
    username: 'erostova',
    name: 'Dr. Elena Rostova',
    role: 'Director of Logistics & Manifest Security',
    department: 'Supply Chain Operations',
    email: 'e.rostova@vaulttech.corp',
    location: 'Building B — Logistics Command Center',
    bio: 'Dr. Rostova is responsible for secure shipping manifests, hardware tracking, and custody verification for all distributed lockbox containers.',
    joinedYear: 2023,
    keyProjects: ['Global Manifest Registry', 'Tamper-Evident Seals', 'Air Freight Routing'],
    securityHintQuestion: 'First research paper subject',
    securityHintAnswer: 'Autonomous Supply Chains (Zurich, 2018)',
  },
  {
    id: 'emp_04',
    username: 'mchen',
    name: 'Marcus Chen',
    role: 'Physical Security & Facility Officer',
    department: 'Safety & Physical Plant',
    email: 'm.chen@vaulttech.corp',
    location: 'Security Station Alpha',
    bio: 'Marcus oversees badge access, biometric gates, and high-security storage vaults. Marcus has been with VaultTech since the initial facility commissioning in 2019.',
    joinedYear: 2019,
    keyProjects: ['Vault Access Control v1', 'Perimeter IR Sensors', 'Emergency Lockouts'],
    securityHintQuestion: 'First company badge number',
    securityHintAnswer: 'SEC-004',
  },
]

export interface NewsArticle {
  id: string
  title: string
  date: string
  author: string
  category: string
  readTime: string
  summary: string
  body: string
}

export const VAULTTECH_NEWS: NewsArticle[] = [
  {
    id: 'news_01',
    title: 'Spotlight: Project Atlas Marks Four Years of High-Precision Automation',
    date: 'October 14, 2024',
    author: 'VaultTech Communications',
    category: 'Engineering & Robotics',
    readTime: '3 min read',
    summary:
      'A retrospective on the heavy-payload robotic arm that revolutionized VaultTech automated warehousing.',
    body: `When senior infrastructure administrator Alex Morgan came aboard in 2022, one of Alex’s initial major initiatives was overseeing the deployment of Project Atlas.

Atlas is our premier 6-axis heavy-payload robotic manipulator, designed to handle multi-ton vault cassettes with sub-millimeter precision. In numerous interviews, Alex Morgan has named Atlas as his favorite engineering milestone and proudest robotic achievement across his career.

"Atlas proved that safety and speed don’t have to compromise each other," Morgan noted during the recent internal engineering town hall. Today, Atlas units handle round-the-clock physical movements in VaultTech’s most secure subterranean containment sectors.`,
  },
  {
    id: 'news_02',
    title: 'Baskin Engineering Student Outreach Collaboration Announced',
    date: 'November 02, 2026',
    author: 'Outreach & Partnerships',
    category: 'Community & Education',
    readTime: '2 min read',
    summary:
      'VaultTech partners with UC Santa Cruz Baskin Engineering ambassadors to demonstrate cybersecurity engineering.',
    body: `VaultTech is pleased to announce an educational demonstration partnership with the Baskin Engineering Student Ambassadors (BESA) at UC Santa Cruz.

A batch of special 3D-printed field lockbox containers has been prepared and dispatched for hands-on activities at the Design, Technology, and Innovation (DTI) youth outreach program. High school students will act as security analysts to identify system vulnerabilities and test physical lock mechanisms.`,
  },
  {
    id: 'news_03',
    title: 'Quarterly Infrastructure Audit & Security Hardening Notice',
    date: 'September 28, 2026',
    author: 'Alex Morgan, IT Administration',
    category: 'Internal IT Notice',
    readTime: '2 min read',
    summary:
      'Reminder regarding internal portal access credentials and role separation policies across staff accounts.',
    body: `All personnel are reminded that employee portal accounts are restricted to assigned clearance levels. 

Standard administrative accounts (Clearance Level 1) are authorized for routine maintenance and telemetry inspection only. Restricted vault records require elevated Level 3 authorization. Note: password recovery hints based on public projects or joining years are strictly discouraged under updated company cybersecurity policies.`,
  },
]
