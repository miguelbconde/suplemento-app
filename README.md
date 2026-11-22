# Suplemento

O *Suplemento* é uma curadoria semanal dos melhores textos publicados na web sobre literatura, artes, ciências humanas e ideias, apresentados em português. Herdeiro dos suplementos literários da imprensa brasileira, ele seleciona, traduz uma citação e resume cada texto, e leva o leitor direto ao original. Este repositório guarda o formato das edições, as edições publicadas e o código do app.

A edição sai toda quarta em [suplemento.substack.com](https://suplemento.substack.com).

## Estrutura

| Pasta | O que tem |
|---|---|
| `formato/` | O formato de cada edição: esquema JSON, exemplo, validador e documentação ([README](formato/README.md)). |
| `edicoes/` | Uma edição por arquivo, `AAAA-MM-DD.json`, com a data da quarta de publicação. |
| `app/` | O app (PWA), publicado pela Cloudflare a cada commit na `main`. Por enquanto, só uma página provisória. |

## Publicar uma edição

1. Salvar a edição em `edicoes/AAAA-MM-DD.json`.
2. Validar: `python formato/validar.py edicoes/AAAA-MM-DD.json` (requer `pip install jsonschema`).
3. Fazer o commit só se não houver erros. Avisos não bloqueiam.

## Publicação

A Cloudflare (Workers Static Assets) publica a pasta `app/` a cada commit na `main`, conforme `wrangler.jsonc`. O resto do repositório não vai para o site. Endereço: https://suplemento-app.mbconde.workers.dev/

## Princípios do app

- Uma edição por semana, sem feed ao vivo. A cada dia, a abertura mostra cinco destaques diferentes da edição, e a edição completa fica a um toque.
- No máximo uma notificação por dia, só se o leitor quiser.
- Sem anúncios, sem rastreadores de terceiros, sem rolagem infinita.
- Leitura offline: a edição é baixada inteira.

## Direitos

Resumos, abertura e seleção são da Redação Suplemento. As citações são trechos curtos dos textos recomendados, com indicação de autor e origem, para fins de crítica e divulgação (Lei 9.610/98, art. 46, III). Os textos originais pertencem aos seus autores e veículos.
