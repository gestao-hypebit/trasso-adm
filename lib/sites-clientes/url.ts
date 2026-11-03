// Endereço do site a partir do domínio cadastrado (sem protocolo).
// localhost/127.0.0.1 usam http, para testar com o site rodando na máquina.
export function urlDoSite(dominio: string) {
  const d = dominio.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '')
  return /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(d) ? `http://${d}` : `https://${d}`
}
