import { Sidebar } from '@/components/layout/sidebar'
import { CommandPaletteProvider } from '@/components/layout/command-palette'
import { MobileNavProvider } from '@/components/layout/mobile-nav'
import { AvisoProvider } from '@/components/ui/toaster'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AvisoProvider>
      <CommandPaletteProvider>
        <MobileNavProvider>
          <div className="flex min-h-screen bg-brand-noite">
            <Sidebar />
            <div className="flex-1 min-w-0 md:pl-60">
              <main className="min-h-screen">
                {children}
              </main>
            </div>
          </div>
        </MobileNavProvider>
      </CommandPaletteProvider>
    </AvisoProvider>
  )
}
