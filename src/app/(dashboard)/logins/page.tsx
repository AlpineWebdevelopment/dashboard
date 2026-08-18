import type { Metadata } from 'next'
import { ExternalLink } from 'lucide-react'
import BrandMark, { hasBrandMark } from '@/components/BrandMark'
import { SERVICES } from '@/lib/login-hub'

export const metadata: Metadata = { title: 'Login Hub' }

export default function LoginsPage() {
  const total = SERVICES.reduce((n, s) => n + s.accounts.length, 0)

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-screen overflow-hidden">
      <div className="px-4 sm:px-8 pt-6 sm:pt-8 pb-3 sm:pb-4 shrink-0">
        <p className="text-[13px] font-medium tracking-widest uppercase text-zinc-500 dark:text-zinc-200 mb-2">
          Personal
        </p>
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="text-2xl sm:text-[26px] font-semibold text-zinc-900 dark:text-white tracking-tight leading-tight">
            Login Hub
          </h1>
          <span className="text-[13px] text-zinc-500 dark:text-zinc-300">
            {total} account{total === 1 ? '' : 's'} across {SERVICES.length} services
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-8 pb-8">
        <div className="flex flex-col gap-6">
          {SERVICES.map((service) => (
            <section key={service.id}>
              <div className="flex items-center gap-2 mb-2.5">
                <BrandMark
                  brand={service.brand}
                  name={service.name}
                  size={18}
                  className={hasBrandMark(service.brand) ? '' : service.color}
                />
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{service.name}</h2>
                <span className="text-[12px] text-zinc-400 dark:text-zinc-400">{service.accounts.length}</span>
              </div>

              <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(13rem,1fr))]">
                {service.accounts.map((account) => (
                  <a
                    key={account.id}
                    href={account.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-3 panel bg-white dark:bg-white/[0.02] border border-zinc-200 dark:border-white/[0.07] rounded-xl px-3.5 py-3 hover:border-zinc-300 dark:hover:border-white/[0.14] hover:bg-zinc-50 dark:hover:bg-white/[0.04] transition-all"
                  >
                    <BrandMark
                      brand={service.brand}
                      name={service.name}
                      size={26}
                      className={hasBrandMark(service.brand) ? '' : service.color}
                    />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-zinc-800 dark:text-zinc-100 truncate">
                        {account.label}
                      </span>
                      {account.hint && (
                        <span className="block text-[12px] text-zinc-500 dark:text-zinc-300 truncate">
                          {account.hint}
                        </span>
                      )}
                    </span>
                    <ExternalLink
                      size={13}
                      className="shrink-0 text-zinc-300 dark:text-zinc-500 group-hover:text-zinc-500 dark:group-hover:text-zinc-200 transition-colors"
                    />
                  </a>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
