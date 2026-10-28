-- Formulário da landing de anúncios do SITE para planejadores financeiros (/planejadores).
-- O SITE envia para o slug "landing-planejadores". Os textos (título, botão) ficam
-- no próprio SITE; aqui vale a validação dos campos e a mensagem de sucesso.
--
-- As opções precisam ser idênticas às do SITE
-- (src/components/landing/planejadores/constants.ts), senão o lead é recusado.
-- "pontuacao" (0 a 8) e "classificacao" (quente/morno/frio) são calculadas pelo
-- SITE a partir das respostas; o visitante não vê esses campos.
--
-- Cole no SQL Editor do Supabase e execute manualmente. É idempotente.

insert into formularios (slug, nome, titulo, subtitulo, botao_texto, mensagem_sucesso, campos)
values (
  'landing-planejadores',
  'Landing de anúncios — Planejadores financeiros',
  'Vamos colocar seu site no ar?',
  'São 5 respostas rápidas, quase tudo com um toque. A gente te chama no WhatsApp.',
  'Quero meu site',
  'Recebemos suas respostas! Já já te chamamos no WhatsApp.',
  '[
    {"id":"nome","chave":"nome","rotulo":"Nome","tipo":"texto","placeholder":"Como podemos te chamar?","obrigatorio":true,"largura":"inteira"},
    {"id":"telefone","chave":"telefone","rotulo":"WhatsApp","tipo":"telefone","placeholder":"(16) 91234-5678","obrigatorio":true,"largura":"inteira"},
    {"id":"tem_site","chave":"tem_site","rotulo":"Você já tem site?","tipo":"opcoes","obrigatorio":true,"largura":"inteira","opcoes":["Não tenho","Tenho, mas está desatualizado","Tenho e gosto"]},
    {"id":"prazo","chave":"prazo","rotulo":"Quando quer o site no ar?","tipo":"opcoes","obrigatorio":true,"largura":"inteira","opcoes":["Este mês","Nos próximos 2 meses","Só pesquisando"]},
    {"id":"orcamento","chave":"orcamento","rotulo":"O site sai por R$ 947, com entrada de 30% (R$ 284). Faz sentido para você?","tipo":"opcoes","obrigatorio":true,"largura":"inteira","opcoes":["Sim, quero conversar","Quero entender melhor","Está fora do meu orçamento"]},
    {"id":"pontuacao","chave":"pontuacao","rotulo":"Pontuação (0 a 8)","tipo":"texto","obrigatorio":false,"largura":"metade"},
    {"id":"classificacao","chave":"classificacao","rotulo":"Classificação","tipo":"opcoes","obrigatorio":false,"largura":"metade","opcoes":["quente","morno","frio"]}
  ]'::jsonb
)
-- Se já existir (versão anterior tinha "oferta" e "cidade"), atualiza os campos.
on conflict (slug) do update set
  subtitulo = excluded.subtitulo,
  campos = excluded.campos;
