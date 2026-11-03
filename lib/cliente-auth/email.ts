import 'server-only'

// Envio do código de acesso pelo Resend (API REST, sem dependência).
// Variáveis: RESEND_API_KEY e RESEND_FROM_EMAIL (remetente de um domínio
// verificado no Resend, ex.: "Slick <acesso@slick.com.br>").
// Em desenvolvimento sem RESEND_API_KEY, o código sai no terminal.

export async function enviarCodigoPorEmail(email: string, codigo: string): Promise<boolean> {
  const chave = process.env.RESEND_API_KEY
  if (!chave) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[entrar] código de ${email}: ${codigo} (RESEND_API_KEY não configurada; só em desenvolvimento)`)
      return true
    }
    console.error('[entrar] RESEND_API_KEY não configurada')
    return false
  }

  const remetente = process.env.RESEND_FROM_EMAIL ?? 'Slick <onboarding@resend.dev>'
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:440px;margin:0 auto;padding:32px 24px;color:#1A0533">
      <p style="font-size:15px;margin:0 0 16px">Seu código para entrar na área do cliente da Slick:</p>
      <p style="font-size:34px;font-weight:700;letter-spacing:8px;margin:0 0 16px;font-family:'Courier New',monospace">${codigo}</p>
      <p style="font-size:13px;color:#666;margin:0">Ele vale por 10 minutos. Se não foi você que pediu, é só ignorar este e-mail.</p>
    </div>`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: remetente,
        to: [email],
        subject: `${codigo} é seu código de acesso`,
        html,
        text: `Seu código para entrar na área do cliente da Slick: ${codigo}\nEle vale por 10 minutos.`,
      }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) console.error('[entrar] resend', res.status, await res.text())
    return res.ok
  } catch (e) {
    console.error('[entrar] resend', e)
    return false
  }
}
