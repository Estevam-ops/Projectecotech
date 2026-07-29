# EcoTech IFTM UPT

Site demonstrativo para um projeto escolar de coleta de resíduos eletrônicos. A proposta conecta comunidade, escolas, IFTM UPT e Cooperu para registrar, acompanhar e divulgar a destinação correta dos aparelhos.

## Funcionalidades

- Página pública com explicação do fluxo de coleta e impacto do projeto.
- Área restrita demonstrativa com login local.
- Cadastro de aparelhos com ID único por resíduo eletrônico.
- Geração de QR Code para etiquetas de identificação.
- Ranking por escola, sala/turma e aluno para apoiar a premiação.
- Totalizador de quantidade de aparelhos e peso arrecadado.
- Impressão de etiquetas e geração de relatório em PDF pelo navegador.

## Como executar

Abra o arquivo `index.html` em um navegador moderno ou sirva a pasta com qualquer servidor estático.

```bash
python3 -m http.server 8080
```

Depois acesse `http://localhost:8080`.


## Como o QR Code funciona

1. A equipe cadastra o aparelho na área restrita com tipo, peso, escola, sala, aluno e status.
2. O sistema gera um ID único no formato `ECO-AAAAMMDDHHMMSS-CODIGO`, combinando data/hora com um trecho aleatório.
3. A biblioteca `qrcodejs` transforma esse ID em uma imagem de QR Code.
4. A etiqueta impressa deve ser colada no aparelho ou na caixa de transporte.
5. Ao escanear o QR Code com a câmera do celular, aparece o ID do item; a equipe usa esse ID para localizar o registro na tabela e acompanhar o caminho até IFTM UPT, Cooperu e desmantelamento.

Neste protótipo, o QR Code guarda apenas o ID do aparelho. Em uma versão com back-end, ele também poderia apontar para uma página de consulta, por exemplo `/residuos/ECO-20260727090000-A1B2C`.

## Se o CSS não aparecer

O HTML já carrega o arquivo de estilos com `<link rel="stylesheet" href="styles.css" />`. Se a página abrir sem cores, layout ou botões estilizados, normalmente é por um destes motivos:

- `index.html` e `styles.css` precisam estar na mesma pasta. Se mover um arquivo, atualize o caminho do `href`.
- O nome precisa ser exatamente `styles.css`, com `s` no final e letras minúsculas. Em alguns sistemas, `Styles.css` ou `style.css` são arquivos diferentes.
- Depois de alterar o CSS, use atualização forçada no navegador (`Ctrl + F5`) para limpar cache.
- Se estiver usando VS Code, abra a pasta do projeto e rode um servidor local, por exemplo `python3 -m http.server 8080`, então acesse `http://localhost:8080`.
- A imagem de fundo vem da internet; se a rede bloquear o Unsplash, a página ainda fica estilizada, mas pode aparecer sem a foto de fundo.

## Login demonstrativo

- E-mail: `admin@ecotech.local`
- Senha: `ecotech`

Os registros são salvos no `localStorage` do navegador, pois este protótipo não possui back-end.
