import { useState } from 'react'
import {
  Calendar,
  Clock,
  User,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react'
import { VAULTTECH_NEWS, type NewsArticle } from '../../data/vaulttechData'
import { play } from '../../../../shared/audio/sfx'

export function CompanyNews() {
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null)

  return (
    <div className="space-y-5">
      {selectedArticle ? (
        /* Full Article View */
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs animate-fadeIn">
          <button
            type="button"
            onClick={() => {
              play('click')
              setSelectedArticle(null)
            }}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#003c6c] hover:underline mb-4 cursor-pointer"
          >
            <ArrowLeft className="size-3.5" /> Back to News Index
          </button>

          <div className="space-y-2">
            <span className="inline-block px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-mono font-bold uppercase tracking-wider">
              {selectedArticle.category}
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-[#0b1d2e]">
              {selectedArticle.title}
            </h2>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1 pb-3 border-b border-slate-100">
              <span className="flex items-center gap-1">
                <Calendar className="size-3.5 text-slate-400" />
                {selectedArticle.date}
              </span>
              <span className="flex items-center gap-1">
                <User className="size-3.5 text-slate-400" />
                {selectedArticle.author}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="size-3.5 text-slate-400" />
                {selectedArticle.readTime}
              </span>
            </div>
          </div>

          <div className="mt-5 prose prose-slate max-w-none text-xs sm:text-sm leading-relaxed text-slate-700 whitespace-pre-line">
            {selectedArticle.body}
          </div>
        </div>
      ) : (
        /* News List */
        <div className="grid grid-cols-1 gap-4">
          {VAULTTECH_NEWS.map((article) => (
            <div
              key={article.id}
              onClick={() => {
                play('click')
                setSelectedArticle(article)
              }}
              className="group bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-[#003c6c] hover:shadow-md transition cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mb-2">
                  <span className="font-mono font-bold text-[#f29813] uppercase tracking-wider">
                    {article.category}
                  </span>
                  <span className="flex items-center gap-1 text-slate-400">
                    <Calendar className="size-3" />
                    {article.date}
                  </span>
                </div>

                <h3 className="font-sans text-base font-bold text-[#0b1d2e] group-hover:text-[#003c6c] transition">
                  {article.title}
                </h3>

                <p className="mt-2 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                  {article.summary}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-[#003c6c]">
                <span>Read Full Article</span>
                <ArrowRight className="size-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
