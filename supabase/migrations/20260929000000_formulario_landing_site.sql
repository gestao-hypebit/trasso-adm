-- Formulário da landing de anúncios do SITE (/site, oferta de criação de site).
-- O SITE envia para o slug "landing-site" com os campos nome, telefone e
-- tipo_negocio. Os textos (título, botão) ficam no próprio SITE; aqui vale
-- a validação dos campos e a mensagem de sucesso.
--
-- Cole no SQL Editor do Supabase e execute manualmente. É idempotente.

insert into formularios (slug, nome, titulo, subtitulo, botao_texto, mensagem_sucesso, campos)
values (
  'landing-site',
  'Landing de anúncios — Criação de site',
  'Vamos colocar seu negócio no ar?',
  'Deixe seu contato e a gente te chama no WhatsApp com o orçamento.',
  'Quero meu site',
  'Recebemos! Já já te chamamos no WhatsApp.',
  '[
    {"id":"nome","chave":"nome","rotulo":"Nome","tipo":"texto","placeholder":"Como podemos te chamar?","obrigatorio":true,"largura":"inteira"},
    {"id":"telefone","chave":"telefone","rotulo":"WhatsApp","tipo":"telefone","placeholder":"(16) 91234-5678","obrigatorio":true,"largura":"inteira"},
    {"id":"tipo_negocio","chave":"tipo_negocio","rotulo":"Tipo de negócio","tipo":"texto","placeholder":"Ex.: clínica, restaurante, loja…","obrigatorio":true,"largura":"inteira"}
  ]'::jsonb
)
on conflict (slug) do nothing;
