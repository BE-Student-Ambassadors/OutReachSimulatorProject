import { useState, useEffect } from 'react'
import {
  Truck,
  Search,
  Package,
  ShieldAlert,
} from 'lucide-react'
import { cyberlockApi } from '../../client/apiClient'
import type { ShippingManifestEntry } from '../../types'

interface ShippingManifestProps {
  targetSerial: string
}

export function ShippingManifest({ targetSerial }: ShippingManifestProps) {
  const [manifest, setManifest] = useState<ShippingManifestEntry[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await cyberlockApi.getShippingManifest()
        if (res.success && res.manifest) {
          setManifest(res.manifest)
        }
      } catch (err) {
        console.error('Failed to load shipping manifest', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = manifest.filter((entry) => {
    const q = search.toLowerCase()
    return (
      entry.serial.toLowerCase().includes(q) ||
      entry.recordId.includes(q) ||
      entry.assetName.toLowerCase().includes(q) ||
      entry.destination.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-4 font-sans">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Truck className="size-4 text-amber-400" />
            Hardware Logistics & Dispatch Manifest
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Cross-reference physical lockbox serials to determine internal database record IDs.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="size-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search serial, record ID, asset..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-700 bg-slate-950 text-slate-200 focus:border-amber-500 focus:outline-none"
          />
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-400 font-mono">
          Loading logistics manifest database...
        </div>
      ) : (
        <div className="rounded-xl border border-slate-800 bg-slate-900/90 overflow-hidden shadow-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase font-mono text-[10px] tracking-wider">
                <tr>
                  <th className="px-4 py-2.5">Hardware Serial</th>
                  <th className="px-4 py-2.5">Internal Record ID</th>
                  <th className="px-4 py-2.5">Asset Description</th>
                  <th className="px-4 py-2.5">Destination</th>
                  <th className="px-4 py-2.5">Classification</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {filtered.map((entry) => {
                  const isTarget = entry.serial.toUpperCase() === targetSerial.toUpperCase()

                  return (
                    <tr
                      key={entry.serial}
                      className={`transition ${
                        isTarget
                          ? 'bg-amber-500/15 border-l-4 border-l-amber-500'
                          : 'hover:bg-slate-800/50'
                      }`}
                    >
                      <td className="px-4 py-3 font-bold text-slate-100 flex items-center gap-1.5">
                        <Package className="size-3.5 text-slate-400" />
                        <span>{entry.serial}</span>
                        {isTarget && (
                          <span className="ml-1 text-[9px] uppercase px-1.5 py-0.2 rounded bg-amber-500 text-slate-950 font-black">
                            YOUR LOCKBOX
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-amber-400 font-bold">
                        #{entry.recordId}
                      </td>
                      <td className="px-4 py-3 font-sans text-slate-300">
                        {entry.assetName}
                      </td>
                      <td className="px-4 py-3 font-sans text-slate-400">
                        {entry.destination}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                            entry.classification === 'Restricted'
                              ? 'bg-red-950/80 text-red-400 border border-red-800/60'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {entry.classification === 'Restricted' && (
                            <ShieldAlert className="size-3" />
                          )}
                          {entry.classification}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300 font-sans">
                        <span className="inline-block size-2 rounded-full bg-emerald-400 mr-1.5" />
                        {entry.status}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Helper note */}
      <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg text-xs text-slate-400">
        <strong className="text-amber-400 font-mono">INVESTIGATOR NOTE:</strong> Note the{' '}
        <strong>Internal Record ID</strong> corresponding to your physical lockbox serial (
        <span className="text-amber-300 font-mono font-bold">{targetSerial}</span>). You will need this
        record ID to query the vault database.
      </div>
    </div>
  )
}
