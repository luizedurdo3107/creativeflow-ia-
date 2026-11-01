# CreativeFlow — operação com dados reais

## Comece aqui

Abra http://localhost:5173 e entre com sua conta. Na primeira instalação, crie a conta do proprietário com seu nome, e-mail e uma senha longa. Não mande a senha no chat. A antiga seleção de perfis foi substituída por login real.

O novo ambiente usa `data/product`, separado do banco antigo. As credenciais Cloudflare existentes no `.env` foram mantidas. `APP_MODE=product` é o padrão; não é necessário mudar o arquivo para sair da demonstração.

1. **Marcas e identidade** → Nova marca. Preencha informações oficiais e carregue o logotipo autorizado.
2. **Produtos e serviços** → Cadastre itens ou confira e importe CSV/XLSX. Cada marca tem o próprio catálogo.
3. **Configurações** → Convide os integrantes reais e defina seus papéis. Copie o link individual e envie ao destinatário por um canal privado. Não há envio automático de e-mail.
4. **Campanhas** → Escreva o briefing, informe fontes e autorização, selecione o item, os canais e os formatos. Escolha criar textos com IA ou usar os textos da própria equipe. Não há briefing fictício preenchido.
5. No **Editor manual da arte**, selecione os elementos para mover, redimensionar, alinhar e ajustar cores e fonte. As abas **Arte**, **Texto** e **Imagem** reúnem os controles. Você pode usar uma imagem própria ou escolher estilo e assunto para gerar outra com IA. Salve a arte antes de gerar, enviar imagem ou mudar de formato. Não há senha técnica adicional.
6. Use **Editar briefing desta campanha** para mudar objetivo, público, mensagem ou formatos. Salvar o briefing recria os textos, retira os fundos da versão anterior e devolve ao rascunho.
7. Salve as edições e use **Enviar para revisão**. Outro integrante real com papel de revisão ou administração precisa conferir.
8. Só campanhas aprovadas podem ser exportadas. O ZIP contém os PNGs escolhidos, legenda, manifesto de origem e aprovação, além de pastas de imagens e textos por canal.

## Editor manual e canais

- **Um briefing, várias peças:** ao criar a campanha, todos os formatos escolhidos recebem uma composição adaptada. A galeria mostra as prévias lado a lado, suas dimensões e os canais compatíveis. Use **Editar peça** para abrir o formato desejado; alterações não salvas impedem a troca para preservar seu trabalho. Criar os layouts não exige gerar uma imagem por canal.
- **Arte:** composições com imagem ao lado, imagem abaixo, fundo completo ou arte pronta preservada, cores, fonte, visibilidade, posição, largura, tamanho e alinhamento dos elementos.
- **Arrastar:** clique e mova o elemento. A alça azul ajusta largura e tamanho. As setas do teclado movem o elemento em pequenos passos; Shift amplia o passo.
- **Texto:** título, apoio, chamada e legenda são editáveis sem IA. Esses textos são compartilhados entre os formatos; a composição visual é independente em cada um.
- **Imagem:** a opção **Mostrar imagem inteira** preserva mascotes e ilustrações com transparência dentro da área da composição; **Preencher área** recorta para ocupar o espaço. Envie PNG/JPEG de até 5 MB, altere zoom, enquadramento e sobreposição, ou escolha fotografia editorial, ilustração com volume ou abstrato. Escreva o assunto, salve e use Gerar nova imagem com IA. O resultado do modelo varia; é possível reenquadrar ou substituir a imagem.
- **Histórico local:** Desfazer, Refazer e Descartar ajustes da arte atuam antes de salvar. Salvar cria uma nova revisão persistente e revoga a aprovação anterior.
- **Canais:** Instagram, Facebook, LinkedIn, WhatsApp, e-mail e site. A seleção habilita os formatos suportados pelo produto: quadrado 1080×1080, retrato 4:5 1080×1350, vertical 1080×1920 e horizontal 1920×1080. São presets do CreativeFlow, não uma promessa de abranger todos os posicionamentos ou exigências de cada plataforma.
- Em **Canais e textos de publicação**, edite a legenda/mensagem por destino e o assunto e corpo do e-mail. Use **Salvar canais e textos**; isso não recria textos ou imagens pela IA.
- O ZIP organiza `canais/instagram/`, `canais/whatsapp/`, `canais/email/` etc. Publicação, disparo de e-mail e envio de mensagens continuam manuais.
- Materiais antigos preservam a composição salva. **Abrir no editor manual** cria uma nova versão editável, que precisa de revisão.
- Campanhas anteriores à seleção de canais precisam receber destinos antes de serem novamente enviadas para revisão.

## Limites gratuitos

O servidor aceita somente Cloudflare nesta configuração e não troca para API paga. A geração é limitada por dia e por espaço: no máximo 10 chamadas de imagem e 20 de texto. Os números podem ser reduzidos com `IMAGE_DAILY_LIMIT` e `TEXT_DAILY_LIMIT`. Tentativas que falham também contam, para ser conservador com a cota.

Mantenha sua conta no plano **Workers Free**, sem upgrade. A Cloudflare possui sua própria alocação diária compartilhada entre modelos e aplicativos; o limite local não mede esse saldo. Consulte [as condições atuais](https://developers.cloudflare.com/workers-ai/platform/pricing/). Quando a IA estiver indisponível, os materiais salvos e a opção de textos próprios continuam utilizáveis. O sistema não apresenta um template como uma imagem gerada por modelo.

Não foi contratado servidor, banco, e-mail ou serviço pago. A versão entregue roda no seu computador. Disponibilidade pública contínua e implantação em uma hospedagem gratuita ainda exigem escolher o destino e validar sua infraestrutura; não foram publicadas nesta rodada.

## Continuidade

- Baixe backups privados em Configurações. A restauração é feita numa pasta nova com `pnpm restore:workspace /caminho/backup.zip /nova/pasta`. Veja o README para detalhes.
- Convites e links de recuperação expiram em 48 horas. Gere outro link quando necessário.
- O administrador pode desativar acessos. Alterar papel ou desativar invalida as sessões do integrante.
- Para recuperar o proprietário sem outro administrador, encerre o servidor e execute `pnpm recover:owner`. A senha é pedida sem aparecer no terminal.
- Arquivar não apaga a campanha. Restaure-a em Configurações; ela volta como rascunho.
- O banco anterior, as campanhas e os arquivos da primeira fase continuam preservados na pasta antiga. Nenhuma empresa fictícia é importada automaticamente.

Este produto atende um espaço de equipe com várias marcas. Não inclui isolamento SaaS entre organizações independentes, integração com ERP privado, SSO corporativo, MFA ou publicação automática nas redes. São integrações específicas que dependem dos sistemas e contas autorizados do cliente.


## Identidade Lumos Connect e demonstração — 31/10/2026

A interface usa a paleta encontrada em `lumos-connect-site-final/src/styles/variables.css`, no arquivo original do site da marca: verde `#4E6F5A`, verde escuro `#3B5645`, apoio `#DCE7DA`, menta `#C7DEDB`, creme `#F5F3EC` e texto `#2B3B36`. Botões, navegação, superfícies, indicadores do editor e favicon seguem essa identidade. Cores semânticas de erro e aviso permanecem reconhecíveis.

O perfil real da Lumos recebeu as cores corretas. A campanha **Norya — Aprender conecta | Demo Lumos** foi criada no espaço da equipe com textos de IA, revisão manual da mensagem, fotografia editorial e peças de Feed, Story e Banner. Instagram, LinkedIn, WhatsApp e E-mail têm mensagens próprias. A campanha foi salva e enviada para revisão independente; a exportação continua aguardando essa revisão.

O editor permite digitar o código HEX, além de escolher a cor visualmente. Valores incompletos não alteram a arte e são restaurados ao sair do campo. O prompt de imagem deixou de enviar o nome da marca e as diretrizes textuais como contexto visual, reduzindo o estímulo para o modelo desenhar letras. A imagem ainda precisa de inspeção humana.

O vídeo da apresentação é uma sequência editada de capturas reais da aplicação, com cortes e esperas reduzidas. Não é uma gravação contínua. O MP4 tem 1920×1080, H.264/AAC, aproximadamente 68 segundos, legendas no quadro e nenhuma narração. Nenhum plano pago foi habilitado nesta etapa.


## Arte pronta e retrato 4:5

O formato Retrato 4:5 (1080×1350) está disponível no editor e na exportação. Em Arte → Composição → **Arte pronta (imagem completa)**, o sistema oculta as camadas iniciais e encaixa o arquivo inteiro, sem cortar suas bordas. Envie o arquivo na aba Imagem. Imagens de proporção diferente recebem espaço de fundo, sem deformação.

Os textos que já estão dentro de um PNG/JPEG fazem parte do arquivo. Para alterá-los, substitua a imagem. Os campos da aba Texto continuam guardando o conteúdo e a legenda da campanha; camadas adicionais podem ser ativadas explicitamente. A revisão e o controle de versão também se aplicam a artes enviadas.
