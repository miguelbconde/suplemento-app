# -*- coding: utf-8 -*-
"""Gera o corpo do post do Substack (do lema ao expediente) a partir do JSON da edição (formato 1.1)."""
import json, re, sys, html, datetime as dt

LING = {'en':'inglês','es':'espanhol','fr':'francês','it':'italiano','de':'alemão'}
MES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']

def md(s):
    s = html.escape(s, quote=False)
    s = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', s)
    s = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', s)
    s = re.sub(r'(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])', r'<em>\1</em>', s)
    return s

def marca(v):
    partes = []
    if v['lingua'] != 'pt': partes.append('Em ' + LING[v['lingua']])
    if v.get('lingua_original'): partes.append('original em ' + v['lingua_original'])
    if v['acesso_fonte'] == 'parcial' and v.get('nota_acesso'): partes.append(v['nota_acesso'])
    out = []
    if partes: out.append('<em>[' + html.escape('; '.join(partes)[0].upper() + '; '.join(partes)[1:]) + ']</em>')
    if v['acesso_fonte'] == 'paywall': out.append('<em>[paywall]</em>')
    return ' '.join(out)

def fonte(v):
    s = '<em>' + html.escape(v['veiculo']) + '</em>'
    if v.get('veiculo_complemento'): s += ' (' + html.escape(v['veiculo_complemento']) + ')'
    return s + ' → <a href="' + v['url'] + '">link</a>'

def principal(v):
    m = marca(v)
    return ('<blockquote><p>“' + md(v['citacao']) + '”</p></blockquote>\n'
            '<p>' + md(v['resumo']) + (' ' + m if m else '') + ' — ' + fonte(v) + '</p>\n')

def tambem(v, i=0):
    m = marca(v)
    rot = ['E também','E ainda','E mais'][min(i,2)]
    return '<p><strong>' + rot + ':</strong> ' + md(v['linha']) + (' ' + m if m else '') + ' — ' + fonte(v) + '</p>\n'

def data_br(iso):
    d = dt.date.fromisoformat(iso); return f'{d.day}/{d.month}'

def main(src, dst):
    E = json.load(open(src, encoding='utf-8'))
    V = {v['id']: v for v in E['verbetes']}
    out = ['<p style="text-align:center"><em>“Quem desconfia, fica sábio”</em></p>\n',
           '<p>' + md(E['abertura']) + '</p>\n',
           '<p><em>Para quem lê com gosto: o Suplemento toda quarta, no seu e-mail. De graça.</em></p>\n',
           '<p>[BOTÃO DE INSCRIÇÃO AQUI]</p>\n']
    for s in E['secoes']:
        sid = s['id']
        if sid == 'lancamentos-e-prazos':
            out.append('<h2>' + s['nome'] + '</h2>\n')
            if E.get('lancamentos'):
                for l in E['lancamentos']:
                    out.append('<p>' + md(l['texto']) + ' → <a href="' + l['url'] + '">' + html.escape(l.get('rotulo_link','ler')) + '</a></p>\n')
            novas = [p for p in E['prazos'] if p.get('nova_na_semana')]
            resto = sorted([p for p in E['prazos'] if not p.get('nova_na_semana')], key=lambda p: p['prazo'])
            def li(p):
                pr = 'fluxo contínuo' if p['prazo'] == 'fluxo contínuo' else data_br(p['prazo'])
                return '<li><strong>' + md(p['promotor']) + '</strong>, ' + md(p['nome']) + ': <strong>' + pr + '</strong>. <a href="' + p['url'] + '">' + html.escape(p.get('rotulo_link','edital')) + '</a></li>\n'
            out.append('<p><strong>Prazos.</strong> Entraram na semana:</p>\n<ul>\n' + ''.join(li(p) for p in novas) + '</ul>\n')
            out.append('<p>Vencem nos próximos 15 dias:</p>\n<ul>\n' + ''.join(li(p) for p in resto) + '</ul>\n')
            out.append('<p>Todas as chamadas abertas da área estão na página <a href="https://suplemento.substack.com/p/editais-e-prazos">Editais e prazos</a>.</p>\n')
            continue
        if sid == 'notas':
            out.append('<h2>' + s['nome'] + '</h2>\n<ul>\n')
            for n in E['notas']:
                out.append('<li><strong>' + md(n['titulo']) + '</strong> ' + md(n['texto']) + ' → <a href="' + n['url'] + '">' + html.escape(n['rotulo_link']) + '</a></li>\n')
            out.append('</ul>\n'); continue
        tops = [t for t in E['topicos'] if t['secao'] == sid]
        if not tops: continue
        out.append('<h2>' + s['nome'] + '</h2>\n')
        if s.get('linha_do_fio'): out.append('<p><em>' + md(s['linha_do_fio']) + '</em></p>\n')
        for t in tops:
            if len(tops) > 1 or sid not in ('repare','para-ler-com-calma','estante-academica'):
                out.append('<h3>' + md(t['titulo']) + '</h3>\n')
            k = 0
            for vid in t['verbetes']:
                v = V[vid]
                if v.get('papel') == 'tambem':
                    out.append(tambem(v, k)); k += 1
                else:
                    out.append(principal(v))
    out.append('<hr>\n<p style="text-align:center">Gostou? <strong>Compartilhe com quem também lê com gosto.</strong></p>\n<hr>\n')
    out.append('<p><small>“Quem desconfia, fica sábio” é uma frase dita por Riobaldo no <em>Grande sertão: veredas</em>, de Guimarães Rosa. A frase aparece na página 125 da edição comemorativa dos 50 anos do livro, publicada em 2006 pela editora Nova Fronteira.</small></p>\n')
    out.append('<p><small>As citações são trechos curtos, traduzidos pela redação, sempre com autor e origem, para fins de crítica e divulgação (Lei 9.610/98, art. 46, III). Os textos pertencem a seus autores e veículos; o <em>Suplemento</em> só aponta o caminho.</small></p>\n')
    out.append('<p><small><strong>Como fazemos:</strong> a curadoria das fontes, a escolha dos textos e a edição e redação finais de cada número são feitas pela nossa redação. Na listagem, resumo e tradução iniciais de textos publicados na semana, contamos com uma ajuda da inteligência artificial.</small></p>\n')
    out.append('<p><small><strong>Expediente:</strong> Redação Suplemento</small></p>\n')
    open(dst, 'w', encoding='utf-8').write(''.join(out))

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
