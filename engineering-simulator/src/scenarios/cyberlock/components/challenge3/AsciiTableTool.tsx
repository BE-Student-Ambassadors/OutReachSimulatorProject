import { useState } from 'react'
import {
  Search,
  Cpu,
} from 'lucide-react'
import { ASCII_TABLE, lookupHex, type AsciiEntry } from '../../data/asciiData'
import { play } from '../../../../shared/audio/sfx'

export function AsciiTableTool() {
  const [search, setSearch] = useState('')
  const [filterMode, setFilterMode] = useState<'digits' | 'letters' | 'all'>('digits')
  const [testHex, setTestHex] = useState('')
  const [testedEntry, setTestedEntry] = useState<AsciiEntry | null>(null)

  const handleTestByte = (val: string) => {
    const clean = val.trim().replace(/^0x/i, '').slice(0, 2)
    setTestHex(clean)
    if (clean.length === 2) {
      const match = lookupHex(clean)
      setTestedEntry(match || null)
      if (match) play('pop')
    } else {
      setTestedEntry(null)
    }
  }

  const filtered = ASCII_TABLE.filter((entry) => {
    if (filterMode === 'digits' && !entry.isDigit) return false
    if (filterMode === 'letters' && !/[A-Za-z]/.test(entry.character)) return false

    if (!search) return true
    const q = search.toLowerCase()
    return (
      entry.hex.toLowerCase().includes(q) ||
      entry.decimal.toString().includes(q) ||
      entry.character.toLowerCase().includes(q) ||
      entry.description.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-4 font-sans text-xs">
      {/* Interactive Single-Byte Tester */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-950 border border-amber-500/30 rounded-2xl p-4 sm:p-5 shadow-md">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Cpu className="size-4 text-amber-400" />
            <h3 className="font-bold text-sm text-slate-100">
              Interactive Single-Byte Inspector
            </h3>
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            Experiment with individual bytes
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="w-full sm:w-auto flex items-center gap-2">
            <span className="font-mono text-slate-400 text-sm font-bold">0x</span>
            <input
              type="text"
              maxLength={2}
              value={testHex}
              onChange={(e) => handleTestByte(e.target.value)}
              placeholder="34"
              className="w-20 px-3 py-2 text-center font-mono text-lg font-black uppercase tracking-wider rounded-xl bg-slate-950 border border-amber-500/60 text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="flex-1 w-full flex items-center justify-between bg-slate-950 px-4 py-2.5 rounded-xl border border-slate-800 font-mono">
            {testedEntry ? (
              <div className="flex items-center justify-between w-full">
                <span className="text-slate-400">
                  Hex <strong className="text-amber-400">0x{testedEntry.hex}</strong> = Dec{' '}
                  <strong className="text-slate-200">{testedEntry.decimal}</strong>
                </span>
                <span className="text-xs px-2.5 py-1 rounded bg-amber-500 text-slate-950 font-black">
                  ASCII Character: "{testedEntry.character}"
                </span>
              </div>
            ) : testHex.length > 0 ? (
              <span className="text-slate-500">
                Enter two hex characters (e.g. 34, 38, 32, 36)
              </span>
            ) : (
              <span className="text-slate-500">
                Try typing a 2-character hex byte from your recovered payload...
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Reference Table Header & Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Filters */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFilterMode('digits')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition cursor-pointer ${
              filterMode === 'digits'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Digits ('0'–'9')
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('letters')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition cursor-pointer ${
              filterMode === 'letters'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Letters ('A'–'z')
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition cursor-pointer ${
              filterMode === 'all'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            All Printable
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-56">
          <Search className="size-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search hex, decimal, or char..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-700 bg-slate-950 text-slate-200 focus:border-amber-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/90 overflow-hidden max-h-72 overflow-y-auto">
        <table className="w-full text-left font-mono text-xs">
          <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 sticky top-0 text-[10px] uppercase">
            <tr>
              <th className="px-4 py-2">Hex Byte</th>
              <th className="px-4 py-2">Decimal</th>
              <th className="px-4 py-2">Decoded Character</th>
              <th className="px-4 py-2">Standard Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {filtered.map((entry) => (
              <tr
                key={entry.hex}
                className={`hover:bg-slate-800/40 transition ${
                  entry.isDigit ? 'bg-amber-500/5' : ''
                }`}
              >
                <td className="px-4 py-2 font-bold text-amber-400">
                  0x{entry.hex}
                </td>
                <td className="px-4 py-2 text-slate-400">{entry.decimal}</td>
                <td className="px-4 py-2">
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded font-black text-sm ${
                      entry.isDigit
                        ? 'bg-amber-500 text-slate-950 shadow-xs'
                        : 'bg-slate-800 text-slate-100'
                    }`}
                  >
                    {entry.character}
                  </span>
                </td>
                <td className="px-4 py-2 text-slate-400 font-sans text-[11px]">
                  {entry.description}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
