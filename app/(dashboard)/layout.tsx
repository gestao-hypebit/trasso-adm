import { Sidebar } from '@/components/layout/sidebar'
import { CommandPaletteProvider } from '@/components/layout/command-palette'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <CommandPaletteProvider>
      <div className="flex min-h-screen bg-brand-noite">
        <Sidebar />
        <div className="flex-1 min-w-0 pl-60">
          <main className="min-h-screen">
            {children}
          </main>
        </div>
      </div>
    </CommandPaletteProvider>
  )
}
