'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Zap, Mail, Lock, ArrowRight, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
})
type LoginData = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [error, setError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
  })

  async function onSubmit(data: LoginData) {
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email: data.email, password: data.password })
    if (error) {
      setError('Email ou senha incorretos. Verifique suas credenciais.')
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <Card className="border-white/[0.1] shadow-2xl shadow-brand-noite">
      <CardHeader className="text-center pb-2">
        <div className="flex justify-center mb-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.07] border border-white/[0.1]">
            <Zap className="h-8 w-8 text-brand-lima" />
          </div>
        </div>
        <CardTitle className="text-3xl font-bold" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
          trasso
        </CardTitle>
        <CardDescription className="text-brand-lavanda/60">
          Cada projeto começa com um traço
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-lavanda/40" />
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                className="pl-10"
                {...register('email')}
              />
            </div>
            {errors.email && <p className="text-xs text-brand-rosa">{errors.email.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-lavanda/40" />
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                className="pl-10"
                {...register('password')}
              />
            </div>
            {errors.password && <p className="text-xs text-brand-rosa">{errors.password.message}</p>}
          </div>

          {error && (
            <div className="rounded-xl bg-brand-rosa/10 border border-brand-rosa/30 px-4 py-3 text-sm text-brand-rosa">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full gap-2" disabled={isSubmitting} size="lg">
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>Entrar <ArrowRight className="h-4 w-4" /></>
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-brand-lavanda/40">
          Criatividade e tecnologia no mesmo traço
        </p>
      </CardContent>
    </Card>
  )
}
