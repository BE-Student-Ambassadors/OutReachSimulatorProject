import { useState } from 'react'
import {
  Search,
  ChevronDown,
  ChevronUp,
  Key,
  MapPin,
  Calendar,
} from 'lucide-react'
import { VAULTTECH_EMPLOYEES } from '../../data/vaulttechData'
import { play } from '../../../../shared/audio/sfx'

// Concise 1-sentence summaries for the scannable cards
const SHORT_DESCRIPTIONS: Record<string, string> = {
  amorgan: 'Manages server infrastructure, directory services, and warehouse automation.',
  jlee: 'Leads motor torque testing, inspection rovers, and rapid chassis prototyping.',
  erostova: 'Directs logistics manifests, container dispatch, and custody verification.',
  mchen: 'Oversees biometric facility gates, security badges, and physical plant keys.',
}

export function EmployeeDirectory() {
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filtered = VAULTTECH_EMPLOYEES.filter((emp) => {
    const q = search.toLowerCase()
    return (
      emp.name.toLowerCase().includes(q) ||
      emp.role.toLowerCase().includes(q) ||
      emp.username.toLowerCase().includes(q) ||
      emp.department.toLowerCase().includes(q)
    )
  })

  const toggleExpand = (id: string) => {
    play('click')
    setExpandedId(expandedId === id ? null : id)
  }

  return (
    <div className="space-y-3 font-sans">
      {/* Compact Search */}
      <div className="relative">
        <Search className="size-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search staff directory..."
          className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:border-[#003c6c] focus:outline-none shadow-xs"
        />
      </div>

      {/* Compact Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filtered.map((emp) => {
          const isExpanded = expandedId === emp.id
          const shortDesc = SHORT_DESCRIPTIONS[emp.username] || emp.bio

          return (
            <div
              key={emp.id}
              className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs hover:border-slate-300 transition flex flex-col justify-between"
            >
              <div>
                {/* Header: Name, Username, Role */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-sm text-[#0b1d2e] leading-snug">
                      {emp.name}
                    </h3>
                    <span className="font-mono text-[11px] font-semibold text-[#f29813]">
                      @{emp.username}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold shrink-0">
                    {emp.department.split(' ')[0]}
                  </span>
                </div>

                <div className="text-xs font-semibold text-[#003c6c] mt-0.5">
                  {emp.role}
                </div>

                {/* 1 Short Description */}
                <p className="mt-1.5 text-xs text-slate-600 leading-normal">
                  {shortDesc}
                </p>

                {/* Project Tags */}
                <div className="mt-2 flex flex-wrap gap-1">
                  {emp.keyProjects.map((proj) => (
                    <span
                      key={proj}
                      className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700"
                    >
                      {proj}
                    </span>
                  ))}
                </div>
              </div>

              {/* Expandable Profile Details */}
              <div className="mt-3 pt-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => toggleExpand(emp.id)}
                  className="w-full flex items-center justify-between text-[11px] font-bold text-[#003c6c] hover:underline cursor-pointer"
                >
                  <span>{isExpanded ? 'Hide Details' : 'View Profile & Hint'}</span>
                  {isExpanded ? (
                    <ChevronUp className="size-3.5" />
                  ) : (
                    <ChevronDown className="size-3.5" />
                  )}
                </button>

                {isExpanded && (
                  <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-2 text-xs animate-fadeIn">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3 text-slate-400" /> Joined {emp.joinedYear}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3 text-slate-400" /> {emp.location.split('—')[0]}
                      </span>
                    </div>

                    {/* Password Recovery Hint */}
                    <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-[11px] text-amber-900">
                      <div className="flex items-center gap-1 font-bold mb-0.5 text-amber-800">
                        <Key className="size-3" />
                        <span>Security Verification Hint:</span>
                      </div>
                      <p className="italic text-slate-700 font-mono">"{emp.securityHintAnswer}"</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
