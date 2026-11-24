"""Valida um arquivo de edição do Suplemento.

Uso: python formato/validar.py app/edicoes/2026-11-25.json
Confere o esquema (edicao.schema.json, na mesma pasta) e as regras da casa
que um esquema não expressa. Erros impedem a publicação; avisos, não.
"""
import json, sys, datetime as dt
from collections import Counter
from pathlib import Path

def main(caminho):
    ed = json.loads(Path(caminho).read_text(encoding="utf-8"))
    erros, avisos = [], []

    try:
        import jsonschema
        esquema = json.loads((Path(__file__).parent / "edicao.schema.json").read_text(encoding="utf-8"))
        for e in jsonschema.Draft202012Validator(esquema).iter_errors(ed):
            erros.append(f"esquema: {'/'.join(map(str, e.path)) or '(raiz)'}: {e.message}")
    except ImportError:
        avisos.append("jsonschema não instalado: só as regras da casa foram conferidas (pip install jsonschema)")

    secoes = {s["id"] for s in ed.get("secoes", [])}
    verbetes = ed.get("verbetes", [])
    ids = [v["id"] for v in verbetes]

    for i, n in Counter(ids).items():
        if n > 1: erros.append(f"id repetido: {i}")
    pref = f"n{ed.get('numero')}-"
    for v in verbetes:
        if not v["id"].startswith(pref): erros.append(f"{v['id']}: id não começa com {pref}")
        if v["secao"] not in secoes: erros.append(f"{v['id']}: seção '{v['secao']}' não declarada")
        if v["secao"] == "repare" and v.get("papel") != "tambem" and v["acesso_fonte"] != "aberto":
            erros.append(f"{v['id']}: o texto do Repare tem de ser aberto")

    for veic, n in Counter(v["veiculo"] for v in verbetes).items():
        if n > 2: avisos.append(f"{veic}: {n} textos (máximo da casa: 2)")

    if verbetes:
        abertos = sum(v["acesso_fonte"] == "aberto" for v in verbetes)
        if abertos / len(verbetes) < 0.75:
            avisos.append(f"só {abertos} de {len(verbetes)} textos abertos (meta: 3/4)")
        fora = sum(v["regiao"] not in ("Europa Ocidental", "América do Norte") for v in verbetes)
        if fora / len(verbetes) < 0.40:
            avisos.append(f"só {fora} de {len(verbetes)} fora do eixo Europa Ocidental–América do Norte (piso: 40%)")

    # formato 1.1: tópicos de 1 a 3 textos
    topicos = ed.get("topicos")
    if ed.get("formato") == "1.1" and not topicos:
        erros.append("formato 1.1 sem tópicos")
    tids = []
    if topicos:
        por_id = {v["id"]: v for v in verbetes}
        tids = [t["id"] for t in topicos]
        for i, n in Counter(tids).items():
            if n > 1: erros.append(f"tópico repetido: {i}")
        tpref = f"n{ed.get('numero')}-t"
        onde = Counter()
        for t in topicos:
            if not t["id"].startswith(tpref): erros.append(f"{t['id']}: id não começa com {tpref}")
            if t["secao"] not in secoes: erros.append(f"{t['id']}: seção '{t['secao']}' não declarada")
            for k, vid in enumerate(t["verbetes"]):
                onde[vid] += 1
                v = por_id.get(vid)
                if not v:
                    erros.append(f"{t['id']}: verbete inexistente {vid}"); continue
                if v["secao"] != t["secao"]: erros.append(f"{vid}: seção diferente da do tópico {t['id']}")
                if k == 0 and v.get("papel") == "tambem": erros.append(f"{vid}: o primeiro texto de {t['id']} tem de ser o principal")
                if k > 0 and v.get("papel") != "tambem": erros.append(f"{vid}: em {t['id']}, só o primeiro texto é principal (use papel 'tambem')")
        for vid in ids:
            if onde[vid] == 0: erros.append(f"{vid}: fora de todos os tópicos")
            elif onde[vid] > 1: erros.append(f"{vid}: em mais de um tópico")
        contados = [t for t in topicos if t["secao"] in ("repare", "para-ler-ja", "livros", "a-contrapelo", "para-ler-com-calma")]
        if len(contados) > 14: avisos.append(f"{len(contados)} tópicos nas 5 seções (máximo da casa: 14)")
        if len(verbetes) > 20: avisos.append(f"{len(verbetes)} textos (teto da casa: 20)")
        multi = sum(len(t["verbetes"]) > 1 for t in topicos)
        if multi > 4: avisos.append(f"{multi} tópicos com mais de um texto (máximo da casa: 4)")
    elif any(v.get("papel") == "tambem" for v in verbetes):
        erros.append("verbete 'tambem' numa edição sem tópicos")

    dias = ed.get("destaques_por_dia", {})
    try:
        d0 = dt.date.fromisoformat(ed["data"])
        esperado = [str(d0 + dt.timedelta(n)) for n in range(7)]
        if sorted(dias) != esperado:
            erros.append(f"destaques_por_dia deve cobrir {esperado[0]} a {esperado[-1]}")
    except (KeyError, ValueError):
        pass
    vezes = Counter()
    validos = tids if topicos else ids
    for dia, lista in dias.items():
        for i in lista:
            if i not in validos:
                erros.append(f"destaque de {dia}: id inexistente {i}" + (" (no formato 1.1, use ids de tópico)" if topicos and i in ids else ""))
            vezes[i] += 1
    for i in validos:
        if vezes[i] == 0: avisos.append(f"{i} nunca aparece em destaque")
    if topicos:
        for dia, lista in sorted(dias.items()):
            if len(lista) != 3: avisos.append(f"destaques de {dia}: {len(lista)} tópicos (a casa usa 3 por dia; na versão gratuita vale o primeiro, de quarta a terça, sem sábado e domingo)")

    def pendentes(x, caminho=""):
        if isinstance(x, dict):
            for k, y in x.items(): yield from pendentes(y, f"{caminho}/{k}")
        elif isinstance(x, list):
            for k, y in enumerate(x): yield from pendentes(y, f"{caminho}/{k}")
        elif isinstance(x, str) and "⟨" in x:
            yield caminho
    for c in pendentes(ed):
        avisos.append(f"a preencher: {c}")

    for a in avisos: print("aviso:", a)
    for e in erros: print("ERRO:", e)
    print(f"{len(verbetes)} verbetes" + (f" em {len(topicos)} tópicos" if topicos else "") + f", {len(erros)} erro(s), {len(avisos)} aviso(s)")
    return 1 if erros else 0

if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
