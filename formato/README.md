# Formato da edição do Suplemento (1.0, 22/11/2026)

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
| `verbetes` | Um objeto por texto recomendado (ver abaixo). |
| `lancamentos`, `prazos`, `notas` | Listas curtas, cada item com `url` e `rotulo_link` (o texto do link: "ler", "edital", "Euronews"). As notas têm `titulo`, a abertura em negrito ("Chile."). Os prazos têm `nova_na_semana` para as chamadas que entraram na semana. O mural completo de editais terá arquivo próprio. |
| `destaques_por_dia` | A home do app: de quarta a terça, até 5 ids de verbete por dia, na ordem de exibição. |

O lema, o rodapé, o expediente e a linha "Todas as chamadas abertas da área estão na página Editais e prazos" são fixos e ficam na configuração do app, não em cada edição. As marcas de língua e acesso (*[Em inglês]*, *[paywall]*) também não vão no resumo: são geradas a partir de `lingua`, `nota_acesso` e `acesso_fonte`.

Exemplo completo: [`app/exemplo/2026-11-18.json`](../app/exemplo/2026-11-18.json), o nº 2.

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
- o texto do Repare é aberto;
- os destaques cobrem os sete dias, de quarta a terça, e só citam verbetes que existem.

Avisos, que só sinalizam:

- campos ainda a preencher;
- mais de 2 textos do mesmo veículo;
- menos de 3/4 dos textos abertos;
- menos de 40% fora do eixo Europa Ocidental–América do Norte;
- verbetes que nunca aparecem em destaque.

## Em aberto

- **A regra de repetição dos destaques.** São 35 vagas na semana para cerca de 15 a 20 verbetes. O exemplo apenas percorre a edição em ordem, cinco por dia, e começa a quarta pelo Repare.
- **Onde fica o conteúdo dos assinantes.** O repositório e o site são públicos. Quando o app passar a ser pago, as seções `assinantes` saem do arquivo público e vão para um serviço com login (Workers e KV ou D1 da Cloudflare). O campo `acesso` de cada seção já marca o corte.
