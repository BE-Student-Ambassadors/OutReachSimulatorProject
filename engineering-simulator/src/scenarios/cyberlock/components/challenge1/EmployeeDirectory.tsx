import { useState } from 'react'
import { Search } from 'lucide-react'
import { VAULTTECH_EMPLOYEES } from '../../data/vaulttechData'

// Concise 1-sentence summaries for the scannable cards
const SHORT_DESCRIPTIONS: Record<string, string> = {
  amorgan: 'Manages server infrastructure, directory services, and warehouse automation.',
  jlee: 'Leads motor torque testing, inspection rovers, and rapid chassis prototyping.',
  erostova: 'Directs logistics manifests, container dispatch, and custody verification.',
  mchen: 'Oversees biometric facility gates, security badges, and physical plant keys.',
}

export function EmployeeDirectory() {
  const [search, setSearch] = useState('')

  const filtered = VAULTTECH_EMPLOYEES.filter((emp) => {
    const q = search.toLowerCase()
    return (
      emp.name.toLowerCase().includes(q) ||
      emp.role.toLowerCase().includes(q) ||
      emp.username.toLowerCase().includes(q) ||
      emp.department.toLowerCase().includes(q)
    )
  })

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

                {/* Short Description */}
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

              {/* Clean Footer Metadata */}
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span>Joined {emp.joinedYear}</span>
                <span>{emp.location.split('—')[0].trim()}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
