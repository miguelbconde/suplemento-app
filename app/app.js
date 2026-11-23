/* Suplemento — app v1.1
 * Lê as edições em JSON (formato 1.0, ver /formato no repositório).
 * Telas: Hoje (cinco destaques do dia), Edição, Verbete, Guardados, Edições anteriores e Sobre.
 * Sem dependências, sem rastreadores.
 *
 * Rotas (hash):
 *   #/                      hoje, edição mais recente
 *   #/edicao                edição mais recente inteira
 *   #/v/<id>                verbete da edição mais recente
 *   #/n/<data>              edição de uma data (AAAA-MM-DD), endereço fixo
 *   #/n/<data>/v/<id>       verbete de uma edição, endereço fixo (é o que se compartilha)
 *   #/dia/<data>            os cinco destaques de outro dia da semana
 *   #/arquivo  #/guardados  #/sobre
 */
(function () {
  'use strict';

  var FUSO = 'America/Sao_Paulo';
  var params = new URLSearchParams(location.search);
  var EXEMPLO = params.has('exemplo');
  if (EXEMPLO) document.documentElement.classList.add('exemplo');
  var BASE = EXEMPLO ? 'exemplo/' : 'edicoes/';
  var LINGUAS = { pt: 'português', en: 'inglês', es: 'espanhol', fr: 'francês', it: 'italiano', de: 'alemão' };
  var app = document.getElementById('app');

  var lista = [];         // edições publicadas: [{data, numero, titulo}], da mais recente para a mais antiga
  var cache = {};         // data -> edição carregada
  var atual = null;       // edição mais recente
  var ed = null;          // edição em vista
  var hojeIds = [];       // destaques do dia (só da edição mais recente)
  var hojeData = null;    // data (AAAA-MM-DD) do cardápio de hoje
  var diaVisto = null;    // dia escolhido na faixa dos dias
  var idsVistos = [];     // destaques do dia escolhido

  /* ---------- utilidades ---------- */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  // Markdown restrito do formato: **negrito**, *itálico*, [link](url)
  function md(s) {
    var h = esc(s);
    h = h.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    h = h.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    h = h.replace(/\*(.+?)\*/g, '<em>$1</em>');
    return h;
  }
  // resumo dentro de um item que já é link: sem links internos
  function mdTexto(s) { return md(String(s || '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')); }
  function semMarcas(s) { return String(s || '').replace(/\*+/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); }

  function hojeISO() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  }
  function somaDias(iso, n) {
    var d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function dataLonga(iso, comDia, comAno) {
    var d = new Date(iso + 'T12:00:00Z');
    var o = { timeZone: 'UTC', day: 'numeric', month: 'long' };
    if (comDia) o.weekday = 'long';
    if (comAno) o.year = 'numeric';
    var s = new Intl.DateTimeFormat('pt-BR', o).format(d);
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function dataCurta(iso) {
    var s = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso + 'T12:00:00Z'));
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function diaSemana(iso) {
    return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', weekday: 'long' }).format(new Date(iso + 'T12:00:00Z')).replace('-feira', '');
  }
  function ddmm(iso) { return iso.slice(8, 10) + '/' + iso.slice(5, 7); }

  var guardadosChave = 'suplemento:guardados';
  function lerGuardados() { try { return JSON.parse(localStorage.getItem(guardadosChave)) || []; } catch (e) { return []; } }
  function gravarGuardados(l) { try { localStorage.setItem(guardadosChave, JSON.stringify(l)); } catch (e) {} }

  var avisoT;
  function aviso(txt) {
    var el = document.getElementById('aviso');
    el.textContent = txt; el.classList.add('visivel');
    clearTimeout(avisoT); avisoT = setTimeout(function () { el.classList.remove('visivel'); }, 2200);
  }

  var ICONES = {
    voltar: '<svg width="10" height="16" viewBox="0 0 10 16" aria-hidden="true"><path d="M8 2 2 8l6 6" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    lua: '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M14.5 11.2A6.5 6.5 0 0 1 6.8 3.5a6.5 6.5 0 1 0 7.7 7.7z" fill="none" stroke-width="1.5" stroke-linejoin="round"/></svg>',
    sol: '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="3.4" fill="none" stroke-width="1.5"/><path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.7 3.7l1.4 1.4M12.9 12.9l1.4 1.4M3.7 14.3l1.4-1.4M12.9 5.1l1.4-1.4" stroke-width="1.5" stroke-linecap="round"/></svg>',
    fora: '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M4 2h8v8M12 2 2 12" fill="none" stroke-width="1.5" stroke-linecap="round"/></svg>',
    guardar: '<svg width="12" height="16" viewBox="0 0 12 16" aria-hidden="true"><path d="M1.5 1.5h9v13L6 11l-4.5 3.5z" fill="none" stroke-width="1.4" stroke-linejoin="round"/></svg>',
    partilhar: '<svg width="14" height="16" viewBox="0 0 14 16" aria-hidden="true"><path d="M7 10V1.5M3.5 5 7 1.5 10.5 5M2 8v6.5h10V8" fill="none" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  // Três modos, lado a lado: papel, azulejo (claro, padrão) e noite
  var TEMAS = ['papel', 'azulejo', 'noite'];
  var NOMES_TEMA = { azulejo: 'Modo azulejo', papel: 'Modo papel', noite: 'Modo noturno' };
  var CORES_BARRA = { azulejo: '#FFFFFF', papel: '#F4F0E6', noite: '#0D121D' };
  ICONES.papel = '<svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true"><path d="M4 2.5h7l3 3v10H4z M11 2.5v3h3 M6.5 9h5M6.5 12h5" fill="none" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  var ICONE_TEMA = { papel: ICONES.papel, azulejo: ICONES.sol, noite: ICONES.lua };
  function temaAtual() { return document.documentElement.dataset.tema || 'azulejo'; }
  function botaoTema() {
    var t = temaAtual();
    return '<span class="modos" role="group" aria-label="Modo de leitura">' + TEMAS.map(function (x) {
      return '<button type="button" data-acao="tema" data-tema="' + x + '" aria-pressed="' + (x === t) + '" aria-label="' + NOMES_TEMA[x] + '">' + ICONE_TEMA[x] + '</button>';
    }).join('') + '</span>';
  }
  function pintarBarra() {
    var cor = CORES_BARRA[temaAtual()];
    document.querySelectorAll('meta[name="theme-color"]').forEach(function (m) { m.setAttribute('content', cor); });
  }
  pintarBarra();
  function trocarTema(t) {
    if (!t || t === temaAtual()) return;
    if (t === 'azulejo') delete document.documentElement.dataset.tema; else document.documentElement.dataset.tema = t;
    try { localStorage.setItem('suplemento:tema', t); } catch (e) {}
    pintarBarra();
    document.querySelectorAll('.modos button').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.tema === t); });
  }

  /* ---------- dados ---------- */

  function buscar(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(url + ': ' + r.status);
      return r.json();
    });
  }
  function carregarEdicao(data) {
    if (cache[data]) return Promise.resolve(cache[data]);
    return buscar(BASE + data + '.json').then(function (e) { cache[data] = e; return e; });
  }

  function verbete(id) { return ed && ed.verbetes.filter(function (v) { return v.id === id; })[0]; }
  function secao(id) { return ed && ed.secoes.filter(function (s) { return s.id === id; })[0]; }
  function ehAtual() { return ed && atual && ed.data === atual.data; }
  function rotaVerbete(id) { return ehAtual() ? '#/v/' + id : '#/n/' + ed.data + '/v/' + id; }
  function rotaEdicao() { return ehAtual() ? '#/edicao' : '#/n/' + ed.data; }

  function escolherDia() {
    var dias = atual.destaques_por_dia || {};
    var datas = Object.keys(dias).sort();
    var hoje = hojeISO();
    if (EXEMPLO) {
      // no exemplo, o dia da semana de hoje escolhe o cardápio correspondente da edição
      var dow = new Date(hoje + 'T12:00:00Z').getUTCDay();          // 0 = domingo
      hojeData = somaDias(atual.data, (dow - 3 + 7) % 7);           // a edição sai na quarta
    } else if (dias[hoje]) {
      hojeData = hoje;
    } else {
      hojeData = hoje < datas[0] ? datas[0] : datas[datas.length - 1];
    }
    hojeIds = idsDoDia(hojeData);
    diaVisto = hojeData; idsVistos = hojeIds;
  }
  function idsDoDia(d) {
    var ids = atual.verbetes.map(function (v) { return v.id; });
    return ((atual.destaques_por_dia || {})[d] || []).filter(function (id) { return ids.indexOf(id) >= 0; });
  }
  function rotaDia() { return diaVisto === hojeData ? '#/' : '#/dia/' + diaVisto; }
  function faixaDias() {
    var datas = Object.keys(atual.destaques_por_dia || {}).sort();
    return '<nav class="dias" aria-label="Dias da edição">' + datas.map(function (d) {
      var sem = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', weekday: 'short' }).format(new Date(d + 'T12:00:00Z')).replace('.', '');
      return '<a href="' + (d === hojeData ? '#/' : '#/dia/' + d) + '"' + (d === diaVisto ? ' aria-current="true"' : '') + (d === hojeData ? ' class="hoje"' : '') +
        ' aria-label="' + esc(dataLonga(d, true)) + (d === hojeData ? ', hoje' : '') + '">' + sem + '<b>' + Number(d.slice(8)) + '</b></a>';
    }).join('') + '</nav>';
  }

  function marcas(v) {
    var l = [];
    if (v.lingua !== 'pt') l.push('em ' + LINGUAS[v.lingua] + (v.lingua_original ? ' (original em ' + esc(v.lingua_original) + ')' : ''));
    else if (v.lingua_original) l.push('traduzido do ' + esc(v.lingua_original));
    if (v.acesso_fonte === 'parcial') l.push(v.nota_acesso ? esc(v.nota_acesso) : 'acesso limitado');
    if (v.acesso_fonte === 'paywall') l.push('para assinantes do veículo');
    return l;
  }
  function veiculoHTML(v) {
    return '<em>' + esc(v.veiculo) + '</em>' + (v.veiculo_complemento ? ' (' + esc(v.veiculo_complemento) + ')' : '');
  }
  function quem(v) { return v.assinatura || (v.autor && v.autor !== '—' ? v.autor : ''); }
  function linhaMeta(v) {
    var p = [];
    if (quem(v)) p.push('<span class="nome">' + esc(quem(v)) + '</span>');
    p.push(veiculoHTML(v));
    return p.concat(marcas(v)).join(' · ');
  }

  /* ---------- telas ---------- */

  function navAtiva(rota) {
    document.querySelectorAll('.navegacao a').forEach(function (a) {
      if (a.dataset.rota === rota) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }
  function topo(voltarHref, voltarTxt, direita) {
    return '<div class="topo"><a class="voltar" href="' + voltarHref + '">' + ICONES.voltar + esc(voltarTxt) + '</a>' +
      '<div class="topo-dir">' + (direita ? '<span>' + direita + '</span>' : '') + botaoTema() + '</div></div>';
  }
  function cabeca(dataTxt, numTxt) {
    return '<header class="cabeca">' +
      '<div class="linha-data"><span>' + esc(dataTxt) + '</span><span class="topo-dir">' + (numTxt ? '<span>' + esc(numTxt) + '</span>' : '') + botaoTema() + '</span></div>' +
      '<h1>Suplemento</h1><p class="lema">“Quem desconfia, fica sábio”</p><div class="fio-duplo"></div></header>';
  }
  function pe() {
    return '<p class="links-pe"><a href="#/arquivo">Edições anteriores</a><span aria-hidden="true"> · </span><a href="#/sobre">Sobre o Suplemento</a></p>';
  }

  function telaVazia() {
    var hoje = hojeISO();
    var dow = new Date(hoje + 'T12:00:00Z').getUTCDay();
    var quarta = somaDias(hoje, ((3 - dow + 7) % 7) || 7);
    app.innerHTML =
      cabeca(dataCurta(hoje), '') +
      '<div class="vazio"><p>O primeiro número do app sai na quarta, ' + esc(dataLonga(quarta)) + '.</p>' +
      '<p class="discreto">Enquanto isso, a edição sai toda quarta em <a href="https://suplemento.substack.com">suplemento.substack.com</a>.</p></div>' + pe();
  }

  function telaHoje(dia) {
    navAtiva('hoje');
    ed = atual;
    diaVisto = dia && atual.destaques_por_dia && atual.destaques_por_dia[dia] ? dia : hojeData;
    idsVistos = idsDoDia(diaVisto);
    var ehHoje = diaVisto === hojeData;
    var itens = idsVistos.map(function (id, i) {
      var v = verbete(id), s = secao(v.secao);
      return '<a class="item-dia' + (v.secao === 'repare' ? ' em-destaque' : '') + '" href="#/v/' + v.id + '">' +
        '<span class="num" aria-hidden="true">' + (i + 1) + '</span>' +
        '<div class="corpo"><span class="rubrica">' + esc(s ? s.nome : '') + '</span>' +
        '<p class="citacao-lista">“' + md(v.citacao) + '”</p>' +
        '<p class="resumo-lista">' + mdTexto(v.resumo) + '</p>' +
        '<span class="meta">' + linhaMeta(v) + '</span></div></a>';
    }).join('');
    app.innerHTML =
      cabeca(dataCurta(hojeISO()), 'Nº ' + ed.numero) + faixaDias() +
      '<section class="secao-dia"><div class="titulo"><h2>' + (ehHoje ? 'Cinco leituras para hoje' : 'As cinco de ' + diaSemana(diaVisto)) + '</h2>' +
      (ehHoje ? '<span class="meta">de ' + ed.verbetes.length + ' na edição</span>' : '') + '</div>' + itens + '</section>' +
      '<a class="chamada-edicao" href="#/edicao"><span class="rubrica" style="color:var(--cinza)">A edição inteira</span>' +
      '<span class="grande">Nº ' + ed.numero + ' · ' + esc(ed.titulo) + ' →</span></a>' +
      '<p class="rodape-dia">' + (ehHoje ? 'Amanhã, outras cinco. A edição não sai daqui.' : '<a href="#/">Voltar às cinco de hoje</a>') + '</p>' + pe();
  }

  function telaVerbete(id) {
    var v = verbete(id);
    if (!v) { location.replace(rotaEdicao()); return; }
    navAtiva(null);
    var s = secao(v.secao);
    var noDia = ehAtual() ? idsVistos.indexOf(id) : -1;
    var ordem = ed.verbetes.map(function (x) { return x.id; });
    var pos, proxId, rotuloProx;
    if (noDia >= 0) {
      pos = (noDia + 1) + ' de ' + idsVistos.length;
      proxId = idsVistos[noDia + 1];
      rotuloProx = proxId ? 'A seguir, ' + (noDia + 2) + ' de ' + idsVistos.length : null;
    } else {
      var k = ordem.indexOf(id);
      pos = (k + 1) + ' de ' + ordem.length;
      proxId = ordem[k + 1];
      rotuloProx = proxId ? 'A seguir na edição' : null;
    }
    var guardado = lerGuardados().some(function (g) { return g.id === id; });
    var lingua = LINGUAS[v.lingua] + (v.lingua_original ? ', original em ' + esc(v.lingua_original) : '');
    var acesso = v.acesso_fonte === 'aberto' ? 'aberto' : v.acesso_fonte === 'paywall' ? 'para assinantes do veículo' : (v.nota_acesso ? esc(v.nota_acesso) : 'acesso limitado');
    var mesma = v.na_mesma_semana ? '<div class="mesma-semana"><strong>Na mesma semana.</strong> ' + md(v.na_mesma_semana.texto) +
      ' <a href="' + esc(v.na_mesma_semana.url) + '" target="_blank" rel="noopener">Ler em <em>' + esc(v.na_mesma_semana.veiculo) + '</em> →</a></div>' : '';
    var prox = '';
    if (proxId) {
      var p = verbete(proxId);
      prox = '<a class="seguinte" href="' + rotaVerbete(p.id) + '"><span class="rubrica" style="color:var(--cinza)">' + rotuloProx + '</span>' +
        '<span class="citacao-lista">“' + md(p.citacao) + '” →</span><span class="meta">' + linhaMeta(p) + '</span></a>';
    }
    var voltar = noDia >= 0 ? [rotaDia(), diaVisto === hojeData ? 'Hoje' : diaSemana(diaVisto).replace(/^./, function (c) { return c.toUpperCase(); })] : [rotaEdicao(), ehAtual() ? 'Edição' : 'Nº ' + ed.numero];
    var antiga = ehAtual() ? '' : '<p class="aviso-antiga">Da edição nº ' + ed.numero + ', de ' + esc(dataLonga(ed.data, false, true)) + '.</p>';
    app.innerHTML =
      topo(voltar[0], voltar[1], pos) + antiga +
      '<article class="verbete"><span class="rubrica">' + esc(s ? s.nome : '') + '</span>' +
      '<div class="citacao-bloco"><span class="aspas" aria-hidden="true">“</span><p class="citacao">' + md(v.citacao) + '</p></div>' +
      '<div class="assinatura"><span>' + (quem(v) ? '<span class="nome">' + esc(quem(v)) + '</span>' : veiculoHTML(v)) + '</span></div>' +
      '<p class="resumo">' + md(v.resumo) + '</p>' + mesma +
      '<dl class="ficha"><dt>Onde</dt><dd>' + veiculoHTML(v) + '</dd><dt>Língua</dt><dd>' + lingua + '</dd><dt>Acesso</dt><dd>' + acesso + '</dd></dl>' +
      '<a class="botao-principal" href="' + esc(v.url) + '" target="_blank" rel="noopener">Ler em <em>' + esc(v.veiculo) + '</em>' + ICONES.fora + '</a>' +
      '<div class="botoes"><button type="button" class="botao" data-acao="guardar" aria-pressed="' + guardado + '">' + ICONES.guardar + '<span>' + (guardado ? 'Guardado' : 'Guardar') + '</span></button>' +
      '<button type="button" class="botao" data-acao="partilhar">' + ICONES.partilhar + 'Compartilhar</button></div></article>' +
      prox +
      '<p class="nota-legal">Citação traduzida pela redação. Trecho curto, com autor e origem, para crítica e divulgação.</p>';
    app.dataset.verbete = id;
    document.title = semMarcas(v.citacao).slice(0, 60) + ' — Suplemento';
  }

  function telaEdicao() {
    navAtiva(ehAtual() ? 'edicao' : null);
    var chips = ed.secoes.map(function (s) {
      return '<button type="button" data-ir="' + s.id + '">' + esc(s.nome) + '</button>';
    }).join('');
    var blocos = ed.secoes.map(function (s) {
      if (s.id === 'lancamentos-e-prazos') return blocoLancamentos(s);
      if (s.id === 'notas') return blocoNotas(s);
      var vs = ed.verbetes.filter(function (v) { return v.secao === s.id; });
      if (!vs.length) return '';
      return '<section class="bloco" id="s-' + s.id + '"><div class="bloco-cab"><h2>' + esc(s.nome) + '</h2>' +
        '<span class="meta">' + vs.length + (vs.length === 1 ? ' texto' : ' textos') + '</span></div>' +
        (s.linha_do_fio ? '<p class="fio-semana">' + md(s.linha_do_fio) + '</p>' : '') +
        vs.map(function (v) {
          return '<a class="item-edicao' + (v.secao === 'repare' ? ' em-destaque' : '') + '" href="' + rotaVerbete(v.id) + '"><p class="citacao-lista">“' + md(v.citacao) + '”</p>' +
            '<p class="resumo-lista">' + mdTexto(v.resumo) + '</p>' +
            '<span class="meta">' + linhaMeta(v) + '</span></a>';
        }).join('') + '</section>';
    }).join('');
    var voltar = ehAtual() ? ['#/', 'Hoje'] : ['#/arquivo', 'Edições anteriores'];
    app.innerHTML =
      topo(voltar[0], voltar[1]) +
      '<div class="capa-edicao"><span class="rubrica" style="color:var(--cinza)">Nº ' + ed.numero + ' · ' + esc(dataLonga(ed.data, false, true)) + '</span>' +
      '<h1>' + esc(ed.titulo) + '</h1><div class="fio-duplo"></div>' +
      '<p class="abertura">' + md(ed.abertura) + '</p></div>' +
      '<nav class="indice" aria-label="Seções da edição">' + chips + '</nav>' + blocos +
      '<footer class="colofao"><p class="lema">“Quem desconfia, fica sábio”</p>' +
      '<p>Riobaldo, em <em>Grande sertão: veredas</em>, de Guimarães Rosa (Nova Fronteira, 2006, p. 125).</p>' +
      '<p>As citações são traduzidas pela redação: trechos curtos, com autor e origem, para fins de crítica e divulgação (Lei 9.610/98, art. 46, III).</p>' +
      '<p>Como fazemos: a curadoria das fontes, a escolha dos textos e a edição e redação finais de cada número são feitas pela nossa redação. Na listagem, resumo e tradução iniciais de textos publicados na semana, contamos com uma ajuda da inteligência artificial.</p>' +
      '<p>Expediente: Redação Suplemento</p></footer>' + pe();
    document.title = 'Nº ' + ed.numero + ' · ' + ed.titulo + ' — Suplemento';
  }

  function blocoLancamentos(s) {
    var l = (ed.lancamentos || []).map(function (x) {
      return '<p class="linha">' + md(x.texto) + (x.url && x.url.indexOf('⟨') < 0 ? ' <a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.rotulo_link || 'ler') + ' →</a>' : '') + '</p>';
    }).join('');
    var p = (ed.prazos || []).map(function (x) {
      var data = x.prazo === 'fluxo contínuo' ? 'contínuo' : ddmm(x.prazo);
      return '<li><span class="data">' + data + '</span><span>' + md(x.promotor) + ', ' + md(x.nome) +
        ' <a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.rotulo_link || 'ver') + ' →</a></span></li>';
    }).join('');
    return '<section class="bloco" id="s-' + s.id + '"><div class="bloco-cab"><h2>' + esc(s.nome) + '</h2></div>' + l +
      (p ? '<h3 class="subtitulo-bloco">Prazos</h3><ul class="prazos">' + p + '</ul>' : '') +
      '<a class="link-rubrica" href="https://suplemento.substack.com/p/editais-e-prazos" target="_blank" rel="noopener">Todas as chamadas abertas →</a></section>';
  }

  function blocoNotas(s) {
    var n = (ed.notas || []).map(function (x) {
      var link = x.url && x.url.indexOf('⟨') < 0 ? ' <a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.rotulo_link || 'ler') + ' →</a>' : '';
      return '<p class="linha"><strong>' + md(x.titulo) + '</strong> ' + md(x.texto) + link + '</p>';
    }).join('');
    return '<section class="bloco" id="s-' + s.id + '"><div class="bloco-cab"><h2>' + esc(s.nome) + '</h2></div>' + n + '</section>';
  }

  function telaArquivo() {
    navAtiva(null);
    var itens = lista.map(function (x, i) {
      return '<a class="item-edicao" href="' + (i === 0 ? '#/edicao' : '#/n/' + x.data) + '">' +
        '<span class="rubrica" style="color:var(--cinza)">Nº ' + esc(x.numero) + (i === 0 ? ' · a desta semana' : '') + '</span>' +
        '<p class="citacao-lista" style="font-style:normal">' + esc(x.titulo) + '</p>' +
        '<span class="meta">' + esc(dataLonga(x.data, true, true)) + '</span></a>';
    }).join('');
    app.innerHTML = topo('#/', 'Hoje') +
      '<div class="capa-edicao"><h1>Edições anteriores</h1><div class="fio-duplo"></div>' +
      '<p class="abertura discreto">Cada edição fica aqui, inteira, com endereço próprio. Um texto compartilhado continua abrindo depois que a semana passa.</p></div>' +
      '<section class="bloco" style="padding-top:8px">' + (itens || '<div class="vazio"><p>Ainda não há edições anteriores.</p></div>') + '</section>' + pe();
    document.title = 'Edições anteriores — Suplemento';
  }

  function telaSobre() {
    navAtiva(null);
    app.innerHTML = topo('#/', 'Hoje') +
      '<div class="capa-edicao"><span class="rubrica" style="color:var(--cinza)">Sobre</span><h1>Suplemento</h1><div class="fio-duplo"></div></div>' +
      '<section class="sobre">' +
      '<p class="destaque">O melhor da semana em livros, artes e ideias, lido a partir do Brasil.</p>' +
      '<p>Toda quarta, o <em>Suplemento</em> reúne os textos mais instigantes publicados na semana em revistas, jornais, blogs e periódicos, daqui e do mundo: ensaios, críticas, entrevistas, um artigo acadêmico. Cada texto chega com uma citação traduzida e um resumo curto, em português, e um toque leva ao original.</p>' +
      '<p>A ideia vem de longe. Os suplementos literários da imprensa brasileira, como o Suplemento Literário d’<em>O Estado de S. Paulo</em>, planejado por Antonio Candido, o Suplemento Dominical do <em>Jornal do Brasil</em>, o <em>Suplemento Literário de Minas Gerais</em>, criado por Murilo Rubião, o <em>Folhetim</em> e o <em>Mais!</em>, puseram gerações de leitores em dia com o que se pensava e se escrevia. O <em>Suplemento</em> quer ser a versão contemporânea desse gesto: seleção exigente, hierarquia, vontade de formar repertório. E atenção às vozes que ainda circulam pouco por aqui.</p>' +
      '<h2>Como fazemos</h2>' +
      '<p>A curadoria das fontes, a escolha dos textos e a edição e redação finais de cada número são feitas pela nossa redação. Na listagem, resumo e tradução iniciais de textos publicados na semana, contamos com uma ajuda da inteligência artificial.</p>' +
      '<p>Recomendamos textos em português, inglês, espanhol, francês, italiano e alemão, as línguas que conseguimos ler e conferir. Só citamos o que lemos.</p>' +
      '<h2>Citações</h2>' +
      '<p>As citações são trechos curtos, traduzidos pela redação, sempre com autor e origem, para fins de crítica e divulgação (Lei 9.610/98, art. 46, III). Os textos pertencem a seus autores e veículos; o <em>Suplemento</em> só aponta o caminho.</p>' +
      '<h2>Privacidade</h2>' +
      '<p>Este app não tem anúncios nem rastreadores, e não pede cadastro. O que você guarda e o modo de leitura que escolhe ficam só no seu aparelho. <a href="privacidade.html">Política de privacidade</a></p>' +
      '<h2>O lema</h2>' +
      '<p>“Quem desconfia, fica sábio” é uma frase dita por Riobaldo no <em>Grande sertão: veredas</em>, de Guimarães Rosa. A frase aparece na página 125 da edição comemorativa dos 50 anos do livro, publicada em 2006 pela editora Nova Fronteira.</p>' +
      '<h2>Contato</h2>' +
      '<p>O <em>Suplemento</em> também sai toda quarta por e-mail, de graça, em <a href="https://suplemento.substack.com" target="_blank" rel="noopener">suplemento.substack.com</a>. Para falar com a redação, basta responder a qualquer edição.</p>' +
      '<p class="discreto">Expediente: Redação Suplemento</p>' +
      '</section>' + pe();
    document.title = 'Sobre — Suplemento';
  }

  function telaGuardados() {
    navAtiva('guardados');
    var g = lerGuardados();
    var corpo = g.length ? g.map(function (x) {
      var destino = x.data ? '#/n/' + x.data + '/v/' + x.id : (atual && atual.verbetes.some(function (v) { return v.id === x.id; }) ? '#/v/' + x.id : x.url);
      var fora = destino === x.url ? ' target="_blank" rel="noopener"' : '';
      return '<a class="item-edicao" href="' + esc(destino) + '"' + fora + '><p class="citacao-lista">“' + md(x.citacao) + '”</p>' +
        '<span class="meta">' + esc(x.meta) + ' · Nº ' + x.numero + '</span></a>';
    }).join('') : '<div class="vazio"><p>Nada guardado ainda.</p><p class="discreto">Toque em “Guardar” num verbete para voltar a ele quando quiser, mesmo depois que a edição mudar.</p></div>';
    app.innerHTML = topo('#/', 'Hoje') +
      '<div class="capa-edicao"><h1>Guardados</h1><div class="fio-duplo"></div></div>' +
      '<section class="bloco" style="padding-top:8px">' + corpo + '</section>';
    document.title = 'Guardados — Suplemento';
  }

  /* ---------- ações ---------- */

  app.addEventListener('click', function (e) {
    var b = e.target.closest('[data-acao],[data-ir]');
    if (!b) return;
    if (b.dataset.ir) {
      var alvo = document.getElementById('s-' + b.dataset.ir);
      if (alvo) alvo.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    var acao = b.dataset.acao, id = app.dataset.verbete, v = verbete(id);
    if (acao === 'tema') trocarTema(b.dataset.tema);
    if (acao === 'guardar' && v) {
      var g = lerGuardados(), i = g.map(function (x) { return x.id; }).indexOf(id);
      if (i >= 0) { g.splice(i, 1); aviso('Tirado dos guardados'); }
      else {
        g.unshift({ id: id, data: ed.data, numero: ed.numero, citacao: v.citacao, url: v.url, meta: semMarcas(quem(v) ? quem(v) + ' · ' + v.veiculo : v.veiculo) });
        aviso('Guardado');
      }
      gravarGuardados(g);
      b.setAttribute('aria-pressed', i < 0);
      b.querySelector('span').textContent = i < 0 ? 'Guardado' : 'Guardar';
    }
    if (acao === 'partilhar' && v) {
      var texto = '“' + semMarcas(v.citacao) + '” — ' + semMarcas(v.veiculo) + ', no Suplemento';
      // endereço fixo: continua valendo depois que a edição muda
      var url = location.origin + location.pathname + location.search + '#/n/' + ed.data + '/v/' + id;
      if (navigator.share) navigator.share({ title: 'Suplemento', text: texto, url: url }).catch(function () {});
      else if (navigator.clipboard) navigator.clipboard.writeText(texto + '\n' + url).then(function () { aviso('Link copiado'); });
    }
  });

  /* ---------- rotas ---------- */

  function rotear() {
    delete app.dataset.verbete;
    document.title = 'Suplemento';
    var h = location.hash.replace(/^#\/?/, '');
    var m;
    if (h.indexOf('guardados') === 0) { telaGuardados(); return window.scrollTo(0, 0); }
    if (h.indexOf('sobre') === 0) { telaSobre(); return window.scrollTo(0, 0); }
    if (!atual) { telaVazia(); return; }
    if (h.indexOf('arquivo') === 0) { telaArquivo(); return window.scrollTo(0, 0); }
    if ((m = h.match(/^n\/(\d{4}-\d{2}-\d{2})(?:\/v\/([\w-]+))?/))) {
      var existe = lista.some(function (x) { return x.data === m[1]; });
      if (!existe) { location.replace('#/arquivo'); return; }
      return carregarEdicao(m[1]).then(function (e) {
        ed = e;
        if (m[2]) telaVerbete(m[2]); else telaEdicao();
        window.scrollTo(0, 0);
      }).catch(function () {
        app.innerHTML = topo('#/', 'Hoje') + '<div class="vazio"><p>Não consegui abrir essa edição agora.</p><p class="discreto">Confira a conexão e tente de novo.</p></div>';
      });
    }
    ed = atual;
    if (h.indexOf('v/') === 0) telaVerbete(h.slice(2));
    else if (h.indexOf('edicao') === 0) telaEdicao();
    else if ((m = h.match(/^dia\/(\d{4}-\d{2}-\d{2})/))) telaHoje(m[1]);
    else telaHoje();
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', rotear);

  // index.json: {"edicoes": [{"data": "AAAA-MM-DD", "numero": N, "titulo": "..."}]} (aceita também só as datas)
  function carregarLista(base) {
    return buscar(base + 'index.json').then(function (idx) {
      return (idx.edicoes || []).map(function (x) { return typeof x === 'string' ? { data: x, numero: '', titulo: '' } : x; })
        .sort(function (a, b) { return a.data < b.data ? 1 : -1; });
    });
  }
  // Enquanto não houver edição publicada, o endereço principal mostra o nº 2 como prévia.
  carregarLista(BASE).then(function (l) {
    if (l.length || EXEMPLO) return l;
    EXEMPLO = true; BASE = 'exemplo/';
    document.body.classList.add('previa');
    return carregarLista(BASE);
  }).then(function (l) {
    lista = l;
    if (!lista.length) return null;
    return carregarEdicao(lista[0].data);
  }).then(function (e) {
    atual = e; ed = e;
    if (atual) {
      lista[0].numero = lista[0].numero || atual.numero;
      lista[0].titulo = lista[0].titulo || atual.titulo;
      escolherDia();
    }
    rotear();
  }).catch(function () {
    app.innerHTML = cabeca(dataCurta(hojeISO()), '') + '<div class="vazio"><p>Não consegui carregar a edição agora.</p><p class="discreto">Confira a conexão e tente de novo.</p></div>';
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
})();
