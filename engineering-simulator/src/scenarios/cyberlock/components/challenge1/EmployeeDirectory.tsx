import { useState } from 'react'
import {
  Search,
  Mail,
  MapPin,
  Briefcase,
  Key,
} from 'lucide-react'
import { VAULTTECH_EMPLOYEES } from '../../data/vaulttechData'

export function EmployeeDirectory() {
  const [search, setSearch] = useState('')
  const [filterDept, setFilterDept] = useState<string>('All')

  const departments = ['All', 'IT Administration', 'Robotics & Hardware', 'Supply Chain Operations', 'Safety & Physical Plant']

  const filtered = VAULTTECH_EMPLOYEES.filter((emp) => {
    const matchesSearch =
      emp.name.toLowerCase().includes(search.toLowerCase()) ||
      emp.role.toLowerCase().includes(search.toLowerCase()) ||
      emp.department.toLowerCase().includes(search.toLowerCase()) ||
      emp.username.toLowerCase().includes(search.toLowerCase())

    const matchesDept = filterDept === 'All' || emp.department === filterDept
    return matchesSearch && matchesDept
  })

  return (
    <div className="space-y-5">
      {/* Search & Filter Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative flex-1">
          <Search className="size-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search staff directory by name, role, or username..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#003c6c] focus:ring-1 focus:ring-[#003c6c] focus:outline-none transition"
          />
        </div>

        {/* Department filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {departments.map((dept) => (
            <button
              key={dept}
              type="button"
              onClick={() => setFilterDept(dept)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition cursor-pointer ${
                filterDept === dept
                  ? 'bg-[#003c6c] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {dept === 'All' ? 'All Staff' : dept.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Directory Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((emp) => {
          const isAlex = emp.username === 'amorgan'

          return (
            <div
              key={emp.id}
              className={`rounded-2xl border p-5 transition-all bg-white shadow-xs hover:shadow-md flex flex-col justify-between ${
                isAlex
                  ? 'border-[#003c6c]/40 ring-1 ring-[#003c6c]/20'
                  : 'border-slate-200'
              }`}
            >
              <div>
                {/* Profile Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`size-12 rounded-xl flex items-center justify-center font-bold text-base text-white ${
                        isAlex
                          ? 'bg-gradient-to-br from-[#003c6c] to-[#002b4d]'
                          : 'bg-slate-700'
                      }`}
                    >
                      {emp.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')}
                    </div>
                    <div>
                      <h3 className="font-sans text-base font-bold text-[#0b1d2e]">
                        {emp.name}
                      </h3>
                      <span className="font-mono text-xs font-semibold text-[#f29813] block">
                        @{emp.username}
                      </span>
                    </div>
                  </div>

                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold border border-slate-200">
                    Joined {emp.joinedYear}
                  </span>
                </div>

                {/* Role & Department */}
                <div className="mt-3.5 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#003c6c]">
                    <Briefcase className="size-3.5 shrink-0" />
                    <span>{emp.role}</span>
                  </div>
                  <div className="text-xs text-slate-500 font-medium">
                    Department: {emp.department}
                  </div>
                </div>

                {/* Bio */}
                <p className="mt-3 text-xs text-slate-600 leading-relaxed">
                  {emp.bio}
                </p>

                {/* Key Projects */}
                <div className="mt-3.5">
                  <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block mb-1">
                    Key Projects:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {emp.keyProjects.map((proj) => (
                      <span
                        key={proj}
                        className={`text-[11px] px-2 py-0.5 rounded font-mono ${
                          proj.includes('Atlas')
                            ? 'bg-amber-100 text-amber-800 font-bold border border-amber-300'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {proj}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer Meta & Password Hint Box */}
              <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <Mail className="size-3 text-slate-400" />
                    {emp.email}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="size-3 text-slate-400" />
                    {emp.location.split('—')[0]}
                  </span>
                </div>

                {/* Password Recovery Hint Indicator */}
                <div className="rounded-lg bg-amber-50/80 border border-amber-200/80 p-2.5 text-[11px] text-amber-900">
                  <div className="flex items-center gap-1.5 font-bold mb-0.5 text-amber-800">
                    <Key className="size-3.5" />
                    <span>Password Security Hint:</span>
                  </div>
                  <p className="italic text-slate-700">"{emp.securityHintAnswer}"</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
