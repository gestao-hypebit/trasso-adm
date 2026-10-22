// Regras das automações, sem banco nem Asaas (dá para testar).

// ---------------------------------------------------------------
// Assinaturas → Metas e avisos
// ---------------------------------------------------------------
export type EstadoAssinatura = {
  // Teve fatura paga (nos últimos ~2 meses).
  pagou: boolean
  // Cancelada, inativa ou removida no Asaas.
  cancelada: boolean
  // dateCreated do Asaas (YYYY-MM-DD).
  criadaEm: string
}

export type MarcasRegistro = { novo_registrado: boolean; cancelamento_registrado: boolean }

// Decide o que registrar para uma assinatura:
//   novo         → 1º pagamento: vira "cliente novo" nas Metas;
//   cancelamento → cancelou depois de ter sido cliente: vira cancelamento e avisa.
// Assinatura que o sistema nunca viu e é antiga (ou primeira execução) vira ponto
// de partida: nada é lançado por ela, só passa a ser acompanhada.
// Assinatura criada e cancelada sem nunca pagar não conta como cliente.
export function proximoPasso(
  registro: MarcasRegistro | null,
  e: EstadoAssinatura,
  opcoes: { primeiraExecucao: boolean; antigaAntesDe: string },
): { registro: MarcasRegistro; novo: boolean; cancelamento: boolean } {
  const pontoDePartida = !registro && (opcoes.primeiraExecucao || e.criadaEm < opcoes.antigaAntesDe)
  const base: MarcasRegistro = registro ?? (pontoDePartida
    ? { novo_registrado: e.pagou || e.criadaEm < opcoes.antigaAntesDe, cancelamento_registrado: e.cancelada }
    : { novo_registrado: false, cancelamento_registrado: false })

  const novo = !base.novo_registrado && e.pagou
  const foiCliente = base.novo_registrado || novo
  const cancelamento = !base.cancelamento_registrado && e.cancelada && foiCliente
  return {
    registro: {
      novo_registrado: base.novo_registrado || novo,
      cancelamento_registrado: base.cancelamento_registrado || e.cancelada,
    },
    novo,
    cancelamento,
  }
}

// ---------------------------------------------------------------
// Régua de cobrança
// ---------------------------------------------------------------
export const ETAPAS_COBRANCA = [3, 7, 15] as const
export type EtapaCobranca = (typeof ETAPAS_COBRANCA)[number]

// Etapa da régua para quem está há `dias` em atraso (nula = ainda não chegou na 1ª).
export function etapaDaRegua(dias: number): EtapaCobranca | null {
  return [...ETAPAS_COBRANCA].reverse().find((e) => dias >= e) ?? null
}

// Mensagem de WhatsApp conforme o tempo de atraso: mais firme a cada etapa.
export function mensagemCobranca(nome: string, valor: string, dias: number, produto = ''): string {
  const primeiro = nome.trim().split(' ')[0]
  if (dias >= 15) {
    return `Oi ${primeiro}, tudo bem? A mensalidade${produto} de ${valor} está em aberto há ${dias} dias. Para não interromper o serviço, consegue regularizar hoje? Se tiver qualquer dificuldade, me fala que a gente resolve junto.`
  }
  if (dias >= 7) {
    return `Oi ${primeiro}! A mensalidade${produto} de ${valor} venceu há ${dias} dias e ainda consta em aberto. Consegue verificar para mim?`
  }
  return `Oi ${primeiro}! Tudo bem? Identificamos ${valor} em aberto da sua mensalidade${produto}. Consegue verificar?`
}
