import { useState } from 'react'
import {
  Shield,
  Users,
  Newspaper,
  Info,
  LogIn,
  type LucideIcon,
} from 'lucide-react'
import { EmployeeDirectory } from './EmployeeDirectory'
import { CompanyNews } from './CompanyNews'
import { LoginPortal } from './LoginPortal'
import { play } from '../../../../shared/audio/sfx'

interface VaultTechPublicSiteProps {
  onLoginSuccess: (user: { username: string; name: string; department: string }) => void
}

interface NavItem {
  id: 'directory' | 'news' | 'about' | 'login'
  label: string
  icon: LucideIcon
  highlight?: boolean
}

export function VaultTechPublicSite({ onLoginSuccess }: VaultTechPublicSiteProps) {
  const [activeTab, setActiveTab] = useState<'directory' | 'news' | 'about' | 'login'>('directory')

  const navItems: NavItem[] = [
    { id: 'directory', label: 'Staff Directory', icon: Users },
    { id: 'news', label: 'Company News & Milestones', icon: Newspaper },
    { id: 'about', label: 'About VaultTech', icon: Info },
    { id: 'login', label: 'Employee Portal', icon: LogIn, highlight: true },
  ]

  return (
    <div className="min-h-full flex flex-col bg-[#f4f6fa] text-[#0b1d2e] font-sans">
      {/* Corporate Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-gradient-to-br from-[#003c6c] to-[#002b4d] flex items-center justify-center text-[#fdc700] shadow-sm">
              <Shield className="size-5 text-[#f29813]" />
            </div>
            <div>
              <span className="font-sans text-lg font-black tracking-tight text-[#003c6c] block leading-none">
                VaultTech
              </span>
              <span className="text-[10px] font-mono tracking-widest uppercase text-slate-500">
                Robotics & Secure Systems
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center gap-1.5 sm:gap-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = activeTab === item.id

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    play('click')
                    setActiveTab(item.id)
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    item.highlight
                      ? isActive
                        ? 'bg-[#003c6c] text-white shadow-xs'
                        : 'bg-[#003c6c]/10 text-[#003c6c] hover:bg-[#003c6c] hover:text-white'
                      : isActive
                      ? 'bg-slate-100 text-[#003c6c]'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="size-3.5" />
                  <span className="hidden sm:inline">{item.label}</span>
                  <span className="sm:hidden">{item.label.split(' ')[0]}</span>
                </button>
              )
            })}
          </nav>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'directory' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
              <h1 className="text-xl font-black text-[#0b1d2e]">Public Employee Directory</h1>
              <p className="text-xs text-slate-600 mt-1">
                VaultTech’s public roster of key infrastructure, robotics, and logistics personnel.
                Investigate staff profiles to uncover operational context.
              </p>
            </div>
            <EmployeeDirectory />
          </div>
        )}

        {activeTab === 'news' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
              <h1 className="text-xl font-black text-[#0b1d2e]">Company Announcements & Engineering News</h1>
              <p className="text-xs text-slate-600 mt-1">
                Press releases, engineering retrospectives, and partnership announcements.
              </p>
            </div>
            <CompanyNews />
          </div>
        )}

        {activeTab === 'about' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
            <div>
              <span className="text-[11px] font-mono uppercase font-bold text-[#f29813]">
                Company Overview
              </span>
              <h1 className="text-2xl font-black text-[#0b1d2e] mt-1">
                Securing High-Precision Engineering & Logistics
              </h1>
              <p className="mt-3 text-xs sm:text-sm text-slate-600 leading-relaxed max-w-3xl">
                Founded in California, VaultTech develops autonomous robotics handling systems and
                distributed field lockboxes. Our facilities integrate heavy-payload robotics,
                such as Project Atlas, with multi-layer tamper-evident physical containment to
                safeguard critical engineering payloads.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <h3 className="font-bold text-sm text-[#003c6c]">Autonomous Robotics</h3>
                <p className="text-xs text-slate-600 mt-1">
                  6-axis industrial arms capable of precision handling in restricted subterranean bays.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <h3 className="font-bold text-sm text-[#003c6c]">Field Containment</h3>
                <p className="text-xs text-slate-600 mt-1">
                  Ruggedized lockboxes deployed for high-stakes transport and educational outreach.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <h3 className="font-bold text-sm text-[#003c6c]">Internal Architecture</h3>
                <p className="text-xs text-slate-600 mt-1">
                  Role-based directory infrastructure managing thousands of distributed records.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'login' && (
          <div className="space-y-4">
            <LoginPortal onLoginSuccess={onLoginSuccess} />
          </div>
        )}
      </main>

      {/* Corporate Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-4 text-slate-500 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>© 2026 VaultTech Corporation · All Rights Reserved · Simulated CTF Environment</span>
          <span className="font-mono text-[11px] text-[#003c6c]">
            VaultTech Intranet Gateway v4.2
          </span>
        </div>
      </footer>
    </div>
  )
}
