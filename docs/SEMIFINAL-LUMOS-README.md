> Documento da etapa anterior. Para o modo atual com contas reais e sem dados de exemplo, use [PRODUTO.md](PRODUTO.md). A senha de geração é exigida apenas no modo de demonstração.

# CreativeFlow AI — semifinal / Lumos Connect

O projeto local está na branch `feat/semifinal-lumos`. As alterações desta rodada ficam na pasta de trabalho, sem commit, push ou merge.

## O fluxo disponível

- Catálogo de produtos e serviços por marca, com nome, descrição, preço opcional, condições, fonte e estado ativo; cadastro manual e importação CSV/XLSX com conferência antes de salvar.
- Dados comerciais selecionados vêm do catálogo, ficam preservados na composição e bloqueiam a exportação se o item tiver mudado.
- Cadastro de várias marcas com descrição, cores HEX, fonte (Inter, Poppins, Nunito ou Arial), diretrizes e logo original PNG/JPEG/WebP de até 1 MB.
- Campanhas institucionais independentes das regras e dos dados sintéticos de farmácia.
- Briefing confirmado pelo responsável, direção de arte editável e prévias de feed (1080×1080), story (1080×1920) e banner (1920×1080).
- Textos gerados pelo provedor configurado; quando ele está ausente ou falha, o sistema identifica o uso de template.
- Imagem de fundo via Cloudflare Workers AI, gerada somente por ação explícita. A logo e os textos permanecem sob controle do compositor.
- Edição manual e proposta por comando de texto com comparação antes/depois. A proposta só altera o rascunho ao clicar em **Aplicar proposta**. Sem IA configurada, a edição por comando fica indisponível.
- Revisão por pessoa diferente do criador e do último editor, inclusive quando o editor é administrador.
- Controle de versão para impedir sobrescrita ou aprovação de uma aba desatualizada.
- Qualquer edição, regeneração de texto ou imagem revoga a aprovação.
- Exportação de campanha aprovada com três PNGs (ou os formatos escolhidos), legenda e manifesto contendo textos, identidade visual, versão, origem das imagens e revisão.
- Banco persistente e imagens em `DATA_DIR/ai-artworks`. Faça backup do volume inteiro.
- Navegação adaptável para computador e celular.

## Executar no computador

Na pasta `creativeflow`, com Node 20+ e pnpm 10.28:

```bash
pnpm install --frozen-lockfile
# Somente se ainda não houver .env:
cp -n .env.example .env
pnpm dev
```

Abra `http://localhost:5173/marcas/campanhas`.
Não substitua um `.env` existente: ele pode conter suas credenciais e configurações locais.
Para exportar, é necessário Chromium ou Google Chrome instalado. O aplicativo tenta localizá-lo automaticamente; se necessário, defina o caminho em `CHROMIUM_PATH`.

O banco PGlite fica em `data/pglite` por padrão. Não é necessário instalar Postgres para a demonstração local. `DATABASE_URL` permite usar Postgres externo.

## Roteiro de teste da equipe

1. Entre como **Bia Costa** (admin), vá a **Marca e regras**, selecione Lumos e salve a identidade visual autorizada. A configuração inicial da Lumos é um exemplo a conferir com a empresa.
2. Cadastre produtos ou serviços em **Produtos e serviços**, se a campanha divulgar um item específico. Preço, condições e fonte devem ser fornecidos pela empresa. É possível conferir e importar CSV/XLSX.
3. Entre como **Ana Souza** (criadora), abra **Campanhas de marcas**, revise o briefing do Norya e selecione os formatos e, opcionalmente, um item do catálogo. Para outra marca, os textos da Lumos são limpos ao trocar de empresa.
4. Confirme as fontes e a autorização. Crie a campanha. Confira os indicadores de texto e de imagem: são integrações distintas.
5. Se a Cloudflare estiver configurada, digite a senha de geração e gere inicialmente apenas o feed. As outras visualizações não consomem uma nova geração.
6. Ajuste os textos manualmente ou peça uma proposta por comando. Confira os fatos antes de aplicar. Valores de um item selecionado ficam no catálogo e são compostos pelo sistema.
7. Entre como **Rui Lima** (revisor), abra a campanha e revise os formatos. Aprove ou peça ajustes com comentário.
8. Baixe o pacote aprovado e confira os PNGs e o `manifest.json`.
9. Volte à criadora, altere o texto e confirme que o download fica bloqueado até nova revisão.
10. Reinicie o app e confirme a persistência da marca e da campanha.

Os usuários por seleção são de demonstração. Antes de disponibilizar dados privados pela internet, substitua esse login por autenticação empresarial.

## IA da Cloudflare

Veja [IA-GRATUITA-CLOUDFLARE.md](IA-GRATUITA-CLOUDFLARE.md). Preencha apenas no `.env` local:

```dotenv
AI_PROVIDER=cloudflare
CLOUDFLARE_ACCOUNT_ID=seu_account_id
CLOUDFLARE_API_TOKEN=seu_token_workers_ai
IMAGE_AI_ENABLED=true
IMAGE_GENERATION_SECRET=sua_senha_local
```

Não há chamada à API de imagens da OpenAI. O texto pode usar outros provedores se alguém os selecionar explicitamente, mas o caminho deste piloto é a Cloudflare.
A existência das variáveis indica configuração, não comprova conexão, permissões ou cota. A validação ao vivo depende de uma conta válida e de geração efetivamente concluída.

## Validação automatizada

```bash
pnpm typecheck
pnpm test
pnpm build
```

Os testes da API usam banco isolado e diretório temporário, forçam o provedor de demonstração e simulam as respostas HTTP da Cloudflare. Eles não gastam sua cota nem alteram o banco da equipe.
Há testes para permissões, versões desatualizadas, revisão independente, propostas de texto, números inventados, arte persistida, exportação PNG/ZIP e persistência após reinício. O fluxo farmacêutico original também continua coberto.

## Escopo que depende de trabalho externo ou dados da equipe

- Account ID e token da Cloudflare válidos para testar uma geração ao vivo.
- Logo, identidade visual e briefing oficialmente aprovados pela Lumos.
- Publicação da campanha autorizada pela empresa.
- Medição de produtividade manual versus CreativeFlow com o mesmo briefing, sem inventar resultados.
- Integrações com ERP/APIs internas da Pague Menos: não há acesso nem integração implementada.
- Publicação automática em redes sociais e autenticação SSO: não implementadas.
- O catálogo farmacêutico continua sintético; CSV/XLSX importa ofertas de SKUs já cadastrados. O catálogo de novas marcas é independente e aceita produtos e serviços por cadastro manual ou CSV/XLSX, em **Produtos e serviços**.

Os exemplos em `docs/previews` ilustram o compositor vetorial e não são imagens geradas por IA nem material oficialmente publicado.
