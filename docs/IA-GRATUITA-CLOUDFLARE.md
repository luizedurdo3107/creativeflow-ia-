> Documento da etapa anterior. Para o modo atual com contas reais e sem dados de exemplo, use [PRODUTO.md](PRODUTO.md). A senha de geração é exigida apenas no modo de demonstração.

# IA no CreativeFlow — Cloudflare Workers AI

A imagem de fundo usa `@cf/black-forest-labs/flux-1-schnell`. O texto pode usar `@cf/meta/llama-3.1-8b-instruct-fp8`. O CreativeFlow acrescenta a logo original e os textos revisados depois da geração, sem pedir ao modelo que os desenhe.

## Configurar sem expor segredos

1. Abra o [painel Cloudflare](https://dash.cloudflare.com/) e selecione sua conta.
2. Localize o **Account ID** e crie um token para **Workers AI**, com acesso à conta escolhida. São dois valores diferentes.
3. Abra o `.env` verdadeiro na raiz do projeto. Preencha uma única declaração de cada variável abaixo, sem compartilhar os valores em mensagens, prints ou arquivos públicos:

```dotenv
AI_PROVIDER=cloudflare
CLOUDFLARE_ACCOUNT_ID=seu_account_id
CLOUDFLARE_API_TOKEN=seu_token_workers_ai
CLOUDFLARE_TEXT_MODEL=@cf/meta/llama-3.1-8b-instruct-fp8
IMAGE_AI_ENABLED=true
IMAGE_GENERATION_SECRET=sua_senha_local
```

4. Se a senha ainda estiver vazia, gere uma com `openssl rand -hex 24` e salve o resultado somente em `IMAGE_GENERATION_SECRET`. Ela é uma senha local do CreativeFlow, diferente do token da Cloudflare.
5. Reinicie `pnpm dev` depois de mudar o `.env`.

## Primeiro teste

- Cadastre a identidade visual autorizada em **Marca e regras**.
- Entre como criadora e crie uma campanha em **Campanhas de marcas**.
- Selecione **Feed**, informe a senha de geração e clique uma vez em **Gerar imagem com IA neste formato**.
- O indicador deve mudar de **Template vetorial** para **Imagem IA** após a resposta e a gravação no armazenamento.
- Confira logo, texto, composição e cores. Faça a revisão com outro usuário antes de exportar.

Prévia, alternância entre formatos e exportação reutilizam os arquivos salvos. Um novo clique de geração consome nova cota. O aplicativo não verifica o tipo de assinatura da sua conta; acompanhe o consumo no painel e use Workers Free se a intenção for ficar dentro da camada gratuita.

O Workers AI oferece uma alocação gratuita diária compartilhada entre modelos e sujeita a limites. A disponibilidade da cota não equivale a geração ilimitada. Consulte a [documentação de preços](https://developers.cloudflare.com/workers-ai/platform/pricing/) para as condições atuais.

## Se falhar

- Token sem acesso / 401 ou 403: confira token, conta e permissões Workers AI.
- Limite / 402 ou 429: confira a cota e o uso da conta.
- Texto em template: confira `AI_PROVIDER`, as credenciais e a resposta do provedor. O fallback fica identificado.
- Botão de imagem indisponível: confira `IMAGE_AI_ENABLED`, as credenciais, a senha e o perfil criador/admin.
- PNG não exporta: confira a instalação de Chrome/Chromium e, se necessário, `CHROMIUM_PATH`.
- Arte ausente no armazenamento: restaure `DATA_DIR/ai-artworks` junto com o banco ou gere novamente. A aplicação não troca silenciosamente uma arte faltante por um template.

O retorno do FLUX pode ser JPEG ou PNG; o arquivo final exportado é PNG. A API nunca recebe os tokens pelo navegador: a senha local é enviada ao CreativeFlow, e a credencial Cloudflare fica no servidor.

Referências oficiais: [modelo de imagem](https://developers.cloudflare.com/workers-ai/models/flux-1-schnell/), [endpoint de texto compatível](https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/).
