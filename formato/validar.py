"""Valida um arquivo de edição do Suplemento.

Uso: python validar.py edicoes/2026-11-25.json
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
        if v["secao"] == "repare" and v["acesso_fonte"] != "aberto":
            erros.append(f"{v['id']}: o texto do Repare tem de ser aberto")
        if "⟨" in json.dumps(v, ensure_ascii=False):
            avisos.append(f"{v['id']}: ainda tem campo a preencher")

    for veic, n in Counter(v["veiculo"] for v in verbetes).items():
        if n > 2: avisos.append(f"{veic}: {n} textos (máximo da casa: 2)")

    if verbetes:
        abertos = sum(v["acesso_fonte"] == "aberto" for v in verbetes)
        if abertos / len(verbetes) < 0.75:
            avisos.append(f"só {abertos} de {len(verbetes)} textos abertos (meta: 3/4)")
        fora = sum(v["regiao"] not in ("Europa Ocidental", "América do Norte") for v in verbetes)
        if fora / len(verbetes) < 0.40:
            avisos.append(f"só {fora} de {len(verbetes)} fora do eixo Europa Ocidental–América do Norte (piso: 40%)")

    dias = ed.get("destaques_por_dia", {})
    try:
        d0 = dt.date.fromisoformat(ed["data"])
        esperado = [str(d0 + dt.timedelta(n)) for n in range(7)]
        if sorted(dias) != esperado:
            erros.append(f"destaques_por_dia deve cobrir {esperado[0]} a {esperado[-1]}")
    except (KeyError, ValueError):
        pass
    vezes = Counter()
    for dia, lista in dias.items():
        for i in lista:
            if i not in ids: erros.append(f"destaque de {dia}: id inexistente {i}")
            vezes[i] += 1
    for i in ids:
        if vezes[i] == 0: avisos.append(f"{i} nunca aparece em destaque")

    for a in avisos: print("aviso:", a)
    for e in erros: print("ERRO:", e)
    print(f"{len(verbetes)} verbetes, {len(erros)} erro(s), {len(avisos)} aviso(s)")
    return 1 if erros else 0

if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
