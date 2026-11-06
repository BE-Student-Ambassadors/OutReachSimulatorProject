import { useState } from 'react'
import {
  Shield,
  Users,
  Newspaper,
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
  id: 'directory' | 'news' | 'login'
  label: string
  icon: LucideIcon
  highlight?: boolean
}

export function VaultTechPublicSite({ onLoginSuccess }: VaultTechPublicSiteProps) {
  const [activeTab, setActiveTab] = useState<'directory' | 'news' | 'login'>('directory')

  const navItems: NavItem[] = [
    { id: 'directory', label: 'Staff Directory', icon: Users },
    { id: 'news', label: 'Company News', icon: Newspaper },
    { id: 'login', label: 'Employee Portal', icon: LogIn, highlight: true },
  ]

  return (
    <div className="min-h-full flex flex-col bg-[#f4f6fa] text-[#0b1d2e] font-sans">
      {/* Sleek Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-gradient-to-br from-[#003c6c] to-[#002b4d] flex items-center justify-center text-[#fdc700] shadow-xs">
              <Shield className="size-4 text-[#f29813]" />
            </div>
            <span className="font-sans text-base font-black tracking-tight text-[#003c6c]">
              VaultTech
            </span>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 sm:gap-2">
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
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
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
                  <span>{item.label}</span>
                </button>
              )
            })}
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6">
        {activeTab === 'directory' && <EmployeeDirectory />}
        {activeTab === 'news' && <CompanyNews />}
        {activeTab === 'login' && <LoginPortal onLoginSuccess={onLoginSuccess} />}
      </main>
    </div>
  )
}
