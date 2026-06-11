import { Sidebar } from '@/components/layout/sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-brand-noite">
      <Sidebar />
      <div className="flex-1 pl-60">
        <main className="min-h-screen">
          {children}
        </main>
      </div>
    </div>
  )
}
