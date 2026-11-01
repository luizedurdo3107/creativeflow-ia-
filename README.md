# CreativeFlow

Espaço de produção de campanhas para uma equipe, com várias marcas, dados próprios, revisão independente e exportação. O modo normal não cria usuários, marcas, produtos ou campanhas de exemplo.

## Iniciar

Requer Node 20+, pnpm 10.28 e Chrome/Chromium para exportar PNG.

```bash
pnpm install --frozen-lockfile
# Somente se não houver um .env:
cp -n .env.example .env
pnpm dev
```

Abra http://localhost:5173. Crie sua conta de proprietário, cadastre a marca e o catálogo e convide a equipe. Não há Ana/Bia/Rui no modo normal. Senhas de geração não são pedidas: a sessão e as permissões autorizam a operação.

Para usar a versão compilada local, encerre o desenvolvimento e execute `pnpm start:product`; o acesso passa para http://localhost:3001. Para iniciar com Docker local, use `docker compose up --build`. O Compose padrão usa banco local persistente e expõe a porta somente neste computador. O perfil Docker foi preparado, mas precisa ser validado na máquina onde será executado.

## Dados e custo

- Banco PGlite e arquivos em `data/product`, sem contratar banco hospedado.
- Cloudflare Workers AI para textos e imagens; a conta deve permanecer em **Workers Free** para usar apenas a alocação gratuita.
- Limites locais conservadores: até 10 chamadas de imagem e 20 de texto por dia, inclusive tentativas que falham. Não há fallback para provedor pago.
- A cota da Cloudflare é compartilhada com outros aplicativos. Os contadores locais não representam o saldo da conta.
- Sem IA configurada ou disponível, você pode escolher **Usar meus textos do briefing, sem IA**. Falhas de geração não são disfarçadas como resposta de IA.
- Convites são links privados de uso único, sem serviço de e-mail contratado.

Veja a documentação oficial de [cotas Workers AI](https://developers.cloudflare.com/workers-ai/platform/pricing/). Não há hospedagem pública incluída nesta entrega: localmente o computador precisa permanecer ligado. O projeto não provisiona planos pagos nem faz upgrade da conta.

## Segurança e trabalho em equipe

Login por e-mail e senha, hash scrypt, sessão revogável em cookie HttpOnly e SameSite, validação de origem nas alterações, limite de tentativas de login e permissões no servidor. O proprietário mantém acesso de administração. Convites e links de recuperação expiram em 48 horas e só podem ser usados uma vez.

A equipe compartilha um único espaço e pode manter várias marcas. Não é um SaaS com múltiplas organizações isoladas ou cobrança. Para expor na internet, configure HTTPS, `APP_PUBLIC_URL`, `COOKIE_SECURE=true`, armazenamento persistente e backups. A primeira conta deve ser configurada em acesso local antes de exposição pública. Não declare homologação de segurança empresarial com base apenas nos testes do projeto.

## Fluxo

1. Marcas e identidade: dados oficiais, logo, cores e fonte.
2. Produtos e serviços: cadastro manual ou importação CSV/XLSX conferida antes de salvar.
3. Campanhas: briefing próprio, canais, formatos e criação por IA ou textos da equipe.
4. Editor manual: arraste e redimensione os elementos, edite os textos, cores e enquadramento; envie uma imagem própria ou gere outra. Salve cada formato.
5. Canais e textos de publicação: mensagens específicas por destino e assunto/corpo de e-mail, organizados no ZIP.
6. Revise e edite; depois use **Enviar para revisão**.
7. Outro integrante com permissão de revisão aprova ou pede ajustes.
8. Exporte somente a versão aprovada. Mudanças revogam a aprovação. Atualizar dados de origem retira os fundos anteriores da versão atual e exige nova conferência.
9. Campanhas podem ser arquivadas e restauradas como rascunho.

## Backup e recuperação

Administração: **Configurações → Baixar backup do espaço**. Guarde o ZIP em local privado. Ele contém cadastros, hashes de senhas, campanhas, histórico e imagens; não contém `.env`, credenciais Cloudflare ou sessões.

Restaure em uma nova pasta vazia, usando caminhos absolutos:

```bash
pnpm restore:workspace /caminho/backup.zip /nova/pasta/de/dados
```

Depois, configure `DATA_DIR=/nova/pasta/de/dados` no `.env` e reinicie. As contas são preservadas; sessões e convites pendentes não são restaurados. A restauração não sobrescreve o banco atual.

Se o proprietário perder o acesso e não houver outro administrador, encerre o servidor e execute `pnpm recover:owner` no terminal da instalação. O comando pede e-mail e nova senha sem exibi-la, recupera apenas o proprietário e encerra suas sessões antigas.

## Legado

A base anterior continua em `data/pglite` e o código da primeira fase permanece acessível somente com `APP_MODE=demo`. Não há limpeza automática dessa base e não há importação automática de dados fictícios para o produto. Cadastre ou importe somente os dados realmente autorizados da empresa. O guia antigo está em `docs/README-DEMONSTRACAO.md`.

## Validar

```bash
pnpm typecheck
pnpm test
pnpm build
```

Os testes usam bancos e diretórios isolados e respostas HTTP simuladas, sem consumir a cota da sua conta. O roteiro operacional está em `docs/PRODUTO.md`.
