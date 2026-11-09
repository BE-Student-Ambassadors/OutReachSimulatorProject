import { useState } from 'react'
import {
  Calendar,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react'
import { VAULTTECH_NEWS, type NewsArticle } from '../../data/vaulttechData'
import { play } from '../../../../shared/audio/sfx'

export function CompanyNews() {
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null)

  return (
    <div className="space-y-3 font-sans">
      {selectedArticle ? (
        /* Concise Article View */
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs animate-fadeIn">
          <button
            type="button"
            onClick={() => {
              play('click')
              setSelectedArticle(null)
            }}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#003c6c] hover:underline mb-3 cursor-pointer"
          >
            <ArrowLeft className="size-3.5" /> Back to Articles
          </button>

          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#f29813]">
              {selectedArticle.category}
            </span>
            <h2 className="text-lg font-black text-[#0b1d2e] mt-0.5">
              {selectedArticle.title}
            </h2>
            <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 pb-3 border-b border-slate-100">
              <span className="flex items-center gap-1">
                <Calendar className="size-3" />
                {selectedArticle.date}
              </span>
              <span>· {selectedArticle.author}</span>
            </div>
          </div>

          <div className="mt-4 text-xs leading-relaxed text-slate-700 whitespace-pre-line space-y-2">
            {selectedArticle.body}
          </div>
        </div>
      ) : (
        /* Concise News List */
        <div className="grid grid-cols-1 gap-2.5">
          {VAULTTECH_NEWS.map((article) => (
            <div
              key={article.id}
              onClick={() => {
                play('click')
                setSelectedArticle(article)
              }}
              className="group bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs hover:border-[#003c6c] transition cursor-pointer flex items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[10px] text-slate-400 mb-0.5">
                  <span className="font-mono font-bold text-[#f29813] uppercase">
                    {article.category}
                  </span>
                  <span>· {article.date}</span>
                </div>
                <h3 className="font-bold text-xs sm:text-sm text-[#0b1d2e] group-hover:text-[#003c6c] transition truncate">
                  {article.title}
                </h3>
                <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                  {article.summary}
                </p>
              </div>

              <ArrowRight className="size-4 text-slate-400 group-hover:text-[#003c6c] group-hover:translate-x-0.5 transition shrink-0" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
