# CreativeFlow AI — branch `feat/semifinal-lumos`

## Entregas incluídas neste ZIP

- O projeto **completo** extraído do ZIP original, preservado em commit `main` local.
- Branch separada `feat/semifinal-lumos`, sem publicação ou merge no GitHub remoto.
- Perfis persistentes de marcas com validação e upload local de logo PNG/JPEG/WebP no painel de administração.
- Novo menu **Campanhas de marcas**, independente das campanhas farmacêuticas.
- Briefing com dados informados e confirmados pelo responsável, geração de textos (IA quando configurada, ou template sem IA), três formatos visuais e edição de textos.
- Prévia de feed 1080×1080, story 1080×1920 e banner 1920×1080.
- Revisão humana por usuário diferente do criador. Qualquer edição revoga a aprovação.
- ZIP de campanha **aprovada** com PNGs, legenda, manifest (origem, provedor, revisor e data).
- Testes adicionais para fluxo e permissões.

## Iniciar no computador

Pré-requisitos: Node 20+, `pnpm` e Chromium. Execute no diretório raiz:

```bash
corepack enable
pnpm install
cp .env.example .env
pnpm dev
```

Acesse `http://localhost:5173` e entre com os usuários **sintéticos** de demonstração:
- Ana Souza: criação e edição;
- Rui Lima: revisão independente;
- Bia Costa: administração / cadastro de marcas.

Para cadastrar a logo original da Lumos: `Marca e regras` → `Perfis de empresas` → `Lumos Connect` → `Logo original` → `Salvar marca`.
A logo do usuário é mantida no banco da aplicação como data URI. Por segurança, apenas PNG/JPEG/WebP e até 1 MB pela interface.

Para criar uma campanha real:
1. Abra `Campanhas de marcas` e escolha `Lumos Connect`.
2. Substitua os textos exemplificativos pelos **fatos aprovados da organização**.
3. Confirme a autorização e selecione os formatos.
4. Crie, revise a prévia e ajuste a cópia.
5. Troque para um usuário **revisor diferente** daquele que criou.
6. Aprove e faça o download do ZIP com PNGs e manifesto.

## Sobre IA e dados reais

Com `AI_PROVIDER=mock` ou sem chave válida, **não existe geração por modelo externo**: os textos vêm do briefing e a interface marca `template-sem-ia`.
Com `AI_PROVIDER=openai`, `azure-openai` ou `anthropic` configurado corretamente em `.env`, o serviço chama o modelo e valida a saída. Se falhar, usa o briefing e marca `template-fallback-ia`.

Os **dados da Lumos** são os que a equipe fornece; não são obtidos automaticamente de seus sistemas ou redes sociais. A descrição padrão serve apenas de ponto de partida, sujeita a aprovação. Não há postagem automática no Instagram.
O fluxo farmacêutico original continua usando catálogo e regras sintéticos, separados da campanha institucional.

## Proteção da versão já classificada

A branch `main` local contém o ZIP inicial sem alterações. A branch `feat/semifinal-lumos` tem os novos commits. Não faça merge diretamente na `main` antes de executar os testes.

```bash
pnpm typecheck
pnpm test
pnpm build
```

Para publicar no GitHub, vincule **seu repositório autorizado** como remoto e envie somente a branch de testes:

```bash
git remote add origin <URL-DO-REPOSITORIO-AUTORIZADO>
git push -u origin feat/semifinal-lumos
```

Não inclua `.env`, senhas, chaves de API, dados de terceiros ou materiais confidenciais. O login por seleção de usuários é apenas para **demonstração**; substitua por autenticação real antes de disponibilizar dados não públicos online. Confirme com a mentora as regras de propriedade intelectual e publicação do hackathon.

## O que ainda requer validação

- Instalar dependências e executar `pnpm typecheck`, `pnpm test`, `pnpm build` em ambiente com npm acessível.
- Testar renderização PNG com Chromium e revisar visualmente as dimensões de feed/story/banner.
- Testar IA real com chave privada autorizada.
- Fazer benchmark de produção manual × automática com dados coletados de verdade.
- Publicar uma peça pela Lumos somente com autorização. Integração direta com ERP/API Pague Menos e publicação automática não foram implementadas.

## Pré-visualizações incluídas

`docs/previews/` contém os três exemplos em SVG e PNG, derivados do mesmo gerador vetorial do novo módulo e de um **briefing de exemplo**. Não representam uma postagem publicada nem um resultado medido. A arte final poderá usar a logo original se a equipe anexar o arquivo autorizado no cadastro de marcas.
