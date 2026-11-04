// Sino gerado no navegador, sem arquivo de áudio. O navegador só libera som
// depois de um clique ou tecla na página, por isso `liberarSom` existe.

let contexto: AudioContext | null = null

const obterContexto = () => (contexto ??= new AudioContext())

export function somLiberado() {
  try {
    return obterContexto().state === 'running'
  } catch {
    return false
  }
}

// Chamar a partir de um clique ou tecla. Sem esse gesto, o resume() nunca termina.
export async function liberarSom() {
  try {
    const c = obterContexto()
    if (c.state !== 'running') await c.resume()
    return c.state === 'running'
  } catch {
    return false
  }
}

function badalada(c: AudioContext, inicio: number) {
  // Harmônicos de sino: o tom mais agudo some primeiro.
  for (const [frequencia, volume, duracao] of [[1046.5, 0.3, 1.6], [2093, 0.14, 1], [3136, 0.07, 0.5]]) {
    const oscilador = c.createOscillator()
    const ganho = c.createGain()
    oscilador.frequency.value = frequencia
    ganho.gain.setValueAtTime(0.0001, inicio)
    ganho.gain.exponentialRampToValueAtTime(volume, inicio + 0.01)
    ganho.gain.exponentialRampToValueAtTime(0.0001, inicio + duracao)
    oscilador.connect(ganho).connect(c.destination)
    oscilador.start(inicio)
    oscilador.stop(inicio + duracao)
  }
}

export function tocarSino() {
  if (!somLiberado()) return
  const c = obterContexto()
  badalada(c, c.currentTime)
  badalada(c, c.currentTime + 0.28)
}
