# Formato da edição do Suplemento (1.1, 24/11/2026)

Cada edição é um arquivo JSON, `app/edicoes/AAAA-MM-DD.json`, com a data da quarta de publicação. É a **fonte única**: o app lê este arquivo, e o HTML para o Substack é gerado a partir dele. Depois de publicado, o arquivo não muda, salvo correção, que fica no histórico do repositório.

Arquivos desta pasta:

- `edicao.schema.json`: as regras do formato (JSON Schema).
- `validar.py`: confere o esquema e as regras da casa. Uso: `python formato/validar.py app/edicoes/2026-11-25.json`.

## O que vai no arquivo

| Campo | O que é |
|---|---|
| `numero`, `data`, `titulo`, `subtitulo`, `url_substack` | Identificação da edição. O título vai sem "Nº N ·". |
| `abertura` | Texto da redação, de 3 a 5 linhas. |
| `secoes` | As seções na ordem da edição, cada uma com `acesso`: `aberto` (aparece no Substack gratuito) ou `assinantes` (só no app). |
| `topicos` | **1.1.** Os tópicos na ordem da edição (ver abaixo). |
| `verbetes` | Um objeto por texto recomendado (ver abaixo). |
| `lancamentos`, `prazos`, `notas` | Listas curtas, cada item com `url` e `rotulo_link` (o texto do link: "ler", "edital", "Euronews"). As notas têm `titulo`, a abertura em negrito ("Chile."). Os prazos têm `nova_na_semana` para as chamadas que entraram na semana. O mural completo de editais terá arquivo próprio. |
| `destaques_por_dia` | A home do app: de quarta a terça, os ids na ordem de exibição. No 1.1, **3 tópicos por dia** (`n3-t01`); o primeiro de cada dia útil (quarta, quinta, sexta, segunda e terça) é o destaque da versão gratuita, que não muda no sábado e no domingo. No 1.0, até 5 verbetes por dia. |

O lema, o rodapé, o expediente e a linha "Todas as chamadas abertas da área estão na página Editais e prazos" são fixos e ficam na configuração do app, não em cada edição. As marcas de língua e acesso (*[Em inglês]*, *[paywall]*) também não vão no resumo: são geradas a partir de `lingua`, `nota_acesso` e `acesso_fonte`.

Exemplos: [`app/exemplo/2026-11-18.json`](../app/exemplo/2026-11-18.json), o nº 2 como saiu (formato 1.0); [`exemplo-topicos.json`](exemplo-topicos.json), o mesmo nº 2 reorganizado em tópicos só para demonstrar o 1.1 (títulos de tópico e linhas "E também" são de demonstração, não foram publicados).

### Tópicos (1.1, desde o nº 3)

A edição se organiza em **até 14 tópicos**, distribuídos pelas 5 seções (Repare, Para ler já, Livros, A contrapelo, Para ler com calma), com **até 20 textos**. A Estante acadêmica também é um tópico, fora da conta; Notas e Lançamentos e prazos não usam tópicos. Cada tópico reúne de 1 a 3 textos sobre o mesmo assunto:

- `id`: `n3-t01`, `n3-t02`… Fixo depois de publicado.
- `secao`: a seção do tópico; todos os seus verbetes ficam nela.
- `titulo`: o nome do tópico, da redação, de 2 a 6 palavras ("A crítica, para quê").
- `verbetes`: os ids, o **principal** primeiro.

O principal é um verbete completo (citação e resumo). Os outros levam `papel: "tambem"` e uma `linha` no lugar de citação e resumo: até 25 palavras, dizendo o que é e por que ler, com o nome central em negrito. As marcas de língua e acesso continuam saindo de `lingua`, `nota_acesso` e `acesso_fonte`. Cada texto segue sendo um verbete com id próprio, endereço fixo e lugar no registro; as metas da casa (veículos, acesso, eixo) contam texto por texto.

No app, a tela Hoje mostra 3 **tópicos** por dia; a Edição agrupa cada seção por tópico, com o título do tópico, o principal e a faixa "E também"; a tela de um texto "E também" mostra a linha e leva de volta ao principal. O `na_mesma_semana` do 1.0 continua lido, mas no 1.1 o complemento do Repare entra como "E também".

### Verbete

- `id`: `n2-01`, `n2-02`… Fixo depois de publicado, porque o app guarda o que o leitor salvou.
- `secao`, `citacao` (em português, sem aspas), `resumo`.
- `conferencia`: o trecho original da citação. **Uso interno**: nunca aparece no app nem no Substack.
- `autor`, `assinatura` (como a autoria aparece ao leitor quando `autor` não basta, como nas entrevistas: "Georges Didi-Huberman, em conversa com Sara Cohen"), `figura`, `veiculo`, `veiculo_complemento` (afiliação ou tradutor), `url`.
- `lingua`: só as seis de recomendação (`pt en es fr it de`). O esquema recusa outras. `lingua_original` quando o texto é versão de um original em outra língua.
- `acesso_fonte`: `aberto`, `parcial` ou `paywall`. Refere-se ao texto original, não ao Suplemento. Detalhe opcional em `nota_acesso`.
- `area`, `regiao` (as mesmas regiões do registro), `regiao_obs`.
- `na_mesma_semana`: o complemento do Repare, quando houver.

O resumo aceita só **negrito** (nomes de pessoas centrais), *itálico* (veículos, obras, palavras estrangeiras) e [links](url), que são as convenções tipográficas da casa.

## O que o validador confere

Erros, que impedem a publicação:

- o arquivo segue o esquema;
- os ids não se repetem e começam pelo número da edição;
- cada verbete está numa seção declarada;
- no 1.1: cada verbete está em um, e só um, tópico; o primeiro texto do tópico é o principal e os outros têm `papel: "tambem"`; verbete e tópico estão na mesma seção;
- o texto do Repare é aberto;
- os destaques cobrem os sete dias, de quarta a terça, e só citam tópicos (1.1) ou verbetes (1.0) que existem.

Avisos, que só sinalizam:

- campos ainda a preencher;
- mais de 2 textos do mesmo veículo;
- menos de 3/4 dos textos abertos;
- menos de 40% fora do eixo Europa Ocidental–América do Norte;
- tópicos (ou verbetes, no 1.0) que nunca aparecem em destaque;
- no 1.1: mais de 14 tópicos nas 5 seções, mais de 20 textos, mais de 4 tópicos com mais de um texto, dia com número de destaques diferente de 3.

## Em aberto

- **A regra de repetição dos destaques.** São 21 vagas na semana (3 por dia) para até 15 tópicos (14 mais a Estante): todos aparecem ao menos uma vez e uns seis voltam num segundo dia. A versão gratuita mostra 1 por dia útil (5 na semana): o primeiro de cada dia. Falta decidir quais tópicos repetem e quais vão para a gratuita (a sugestão é o Repare na quarta). O exemplo do 1.1 percorre os tópicos em ordem, três por dia.
- **Onde fica o conteúdo dos assinantes.** O repositório e o site são públicos. Quando o app passar a ser pago, as seções `assinantes` saem do arquivo público e vão para um serviço com login (Workers e KV ou D1 da Cloudflare). O campo `acesso` de cada seção já marca o corte.
