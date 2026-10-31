# Branch de desenvolvimento — Semifinal / Lumos Connect

## Implementado nesta entrega
- Cadastro persistente de perfis de marca, com perfil inicial Lumos Connect (dados preliminares sujeitos à confirmação).
- GET /api/system/brand-profiles disponível a usuários autenticados.
- PUT /api/system/brand-profiles restrito a admin, com validação de ID, URLs e cores HEX.
- Interface de cadastro em Administração > Manual de marca.
- Testes de autorização, validação e persistência por consulta.

## Limitações declaradas
- O motor de geração, tokens de cor e regras farmacêuticas continuam atrelados ao manual original; **selecionar uma marca NÃO personaliza ainda a geração de peças**.
- Sem importação real de logos por upload, publicação Instagram, integração Pague Menos, deploy ou conexão com IA externa.
- O arquivo original do usuário era um ZIP sem histórico Git: este trabalho é um snapshot independente, não uma branch remota criada no GitHub.

## Próximas tarefas P0
1. Auditar a dependência dos tokens `@cf/shared` para separar marca e regras de conformidade por campanha.
2. Adicionar `brandId` ao briefing com migração compatível com campanhas antigas e contexto confiável no gerador/renderizador.
3. Criar catálogo de serviços institucionais separado de ofertas farmacêuticas.
4. Testar criação, edição, aprovação e exportação da campanha Lumos de ponta a ponta.
5. Validar uso dos materiais e direitos/autorização do hackathon com a mentora.
