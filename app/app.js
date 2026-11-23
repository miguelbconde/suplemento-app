/* Suplemento — app v1
 * Lê as edições em JSON (formato 1.0, ver /formato no repositório) e monta
 * quatro telas: Hoje (cinco destaques do dia), Edição, Verbete e Guardados.
 * Sem dependências, sem rastreadores. Rotas por hash: #/, #/edicao, #/v/<id>, #/guardados.
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
  var ed = null;          // edição corrente
  var hojeIds = [];       // destaques do dia
  var hojeData = null;    // data (AAAA-MM-DD) do cardápio mostrado

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
  function semMarcas(s) { return String(s || '').replace(/\*+/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); }

  function hojeISO() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  }
  function somaDias(iso, n) {
    var d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function dataLonga(iso, comDia) {
    var d = new Date(iso + 'T12:00:00Z');
    var o = { timeZone: 'UTC', day: 'numeric', month: 'long' };
    if (comDia) o.weekday = 'long';
    var s = new Intl.DateTimeFormat('pt-BR', o).format(d);
    return s.charAt(0).toUpperCase() + s.slice(1);
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

  function botaoTema() {
    var noite = document.documentElement.dataset.tema === 'noite';
    return '<button type="button" class="icone" data-acao="tema" aria-label="' + (noite ? 'Modo diurno' : 'Modo noturno') + '">' + (noite ? ICONES.sol : ICONES.lua) + '</button>';
  }
  function pintarBarra() {
    var cor = document.documentElement.dataset.tema === 'noite' ? '#0D121D' : '#F4F0E6';
    document.querySelectorAll('meta[name="theme-color"]').forEach(function (m) { m.setAttribute('content', cor); });
  }
  pintarBarra();
  function trocarTema() {
    var noite = document.documentElement.dataset.tema !== 'noite';
    if (noite) document.documentElement.dataset.tema = 'noite'; else delete document.documentElement.dataset.tema;
    try { localStorage.setItem('suplemento:tema', noite ? 'noite' : 'dia'); } catch (e) {}
    pintarBarra();
    var b = document.querySelector('[data-acao="tema"]');
    if (b) b.outerHTML = botaoTema();
  }

  /* ---------- dados ---------- */

  function buscar(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(url + ': ' + r.status);
      return r.json();
    });
  }

  function verbete(id) { return ed && ed.verbetes.filter(function (v) { return v.id === id; })[0]; }
  function secao(id) { return ed && ed.secoes.filter(function (s) { return s.id === id; })[0]; }

  function escolherDia() {
    var dias = ed.destaques_por_dia || {};
    var datas = Object.keys(dias).sort();
    var hoje = hojeISO();
    if (EXEMPLO) {
      // no exemplo, o dia da semana de hoje escolhe o cardápio correspondente da edição
      var dow = new Date(hoje + 'T12:00:00Z').getUTCDay();          // 0 = domingo
      hojeData = somaDias(ed.data, (dow - 3 + 7) % 7);              // edição sai na quarta
    } else if (dias[hoje]) {
      hojeData = hoje;
    } else {
      hojeData = hoje < datas[0] ? datas[0] : datas[datas.length - 1];
    }
    hojeIds = (dias[hojeData] || []).filter(verbete);
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

  function telaVazia() {
    var hoje = hojeISO();
    var dow = new Date(hoje + 'T12:00:00Z').getUTCDay();
    var quarta = somaDias(hoje, ((3 - dow + 7) % 7) || 7);
    app.innerHTML =
      cabeca(dataLonga(hoje, true), '') +
      '<div class="vazio"><p>O primeiro número do app sai na quarta, ' + esc(dataLonga(quarta)) + '.</p>' +
      '<p class="discreto">Enquanto isso, a edição sai toda quarta em <a href="https://suplemento.substack.com">suplemento.substack.com</a>.</p></div>';
  }

  function cabeca(dataTxt, numTxt) {
    return '<header class="cabeca">' +
      '<div class="linha-data"><span>' + esc(dataTxt) + '</span><span class="topo-dir">' + (numTxt ? '<span>' + esc(numTxt) + '</span>' : '') + botaoTema() + '</span></div>' +
      '<h1>Suplemento</h1><p class="lema">“Quem desconfia, fica sábio”</p><div class="fio-duplo"></div></header>';
  }

  function telaHoje() {
    navAtiva('hoje');
    var itens = hojeIds.map(function (id, i) {
      var v = verbete(id), s = secao(v.secao);
      return '<a class="item-dia" href="#/v/' + v.id + '">' +
        '<span class="num" aria-hidden="true">' + (i + 1) + '</span>' +
        '<div class="corpo"><span class="rubrica">' + esc(s ? s.nome : '') + '</span>' +
        '<p class="citacao-lista">“' + md(v.citacao) + '”</p>' +
        '<span class="meta">' + linhaMeta(v) + '</span></div></a>';
    }).join('');
    app.innerHTML =
      cabeca(dataLonga(hojeData, true), 'Nº ' + ed.numero) +
      '<section class="secao-dia"><div class="titulo"><h2>Cinco leituras para hoje</h2>' +
      '<span class="meta">de ' + ed.verbetes.length + ' na edição</span></div>' + itens + '</section>' +
      '<a class="chamada-edicao" href="#/edicao"><span class="rubrica" style="color:var(--cinza)">A edição inteira</span>' +
      '<span class="grande">Nº ' + ed.numero + ' · ' + esc(ed.titulo) + ' →</span></a>' +
      '<p class="rodape-dia">Amanhã, outras cinco. A edição não sai daqui.</p>';
  }

  function telaVerbete(id) {
    var v = verbete(id);
    if (!v) { location.hash = '#/'; return; }
    navAtiva(null);
    var s = secao(v.secao);
    var noDia = hojeIds.indexOf(id);
    var ordem = ed.verbetes.map(function (x) { return x.id; });
    var pos, proxId, rotuloProx;
    if (noDia >= 0) {
      pos = (noDia + 1) + ' de ' + hojeIds.length;
      proxId = hojeIds[noDia + 1];
      rotuloProx = proxId ? 'A seguir, ' + (noDia + 2) + ' de ' + hojeIds.length : null;
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
      prox = '<a class="seguinte" href="#/v/' + p.id + '"><span class="rubrica" style="color:var(--cinza)">' + rotuloProx + '</span>' +
        '<span class="citacao-lista">“' + md(p.citacao) + '” →</span><span class="meta">' + linhaMeta(p) + '</span></a>';
    }
    app.innerHTML =
      '<div class="topo"><a class="voltar" href="' + (noDia >= 0 ? '#/' : '#/edicao') + '">' + ICONES.voltar + (noDia >= 0 ? 'Hoje' : 'Edição') + '</a>' +
      '<div class="topo-dir"><span>' + pos + '</span>' + botaoTema() + '</div></div>' +
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
    window.scrollTo(0, 0);
  }

  function telaEdicao() {
    navAtiva('edicao');
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
          return '<a class="item-edicao" href="#/v/' + v.id + '"><p class="citacao-lista">“' + md(v.citacao) + '”</p>' +
            '<span class="meta">' + linhaMeta(v) + '</span></a>';
        }).join('') + '</section>';
    }).join('');
    app.innerHTML =
      '<div class="topo"><a class="voltar" href="#/">' + ICONES.voltar + 'Hoje</a><div class="topo-dir"><span>' + esc(dataLonga(ed.data, true)) + '</span>' + botaoTema() + '</div></div>' +
      '<div class="capa-edicao"><span class="rubrica" style="color:var(--cinza)">Nº ' + ed.numero + '</span>' +
      '<h1>' + esc(ed.titulo) + '</h1><div class="fio-duplo"></div>' +
      '<p class="abertura">' + md(ed.abertura) + '</p></div>' +
      '<nav class="indice" aria-label="Seções da edição">' + chips + '</nav>' + blocos +
      '<footer class="colofao"><p class="lema">“Quem desconfia, fica sábio”</p>' +
      '<p>Riobaldo, em <em>Grande sertão: veredas</em>, de Guimarães Rosa (Nova Fronteira, 2006, p. 125).</p>' +
      '<p>As citações são traduzidas pela redação: trechos curtos, com autor e origem, para fins de crítica e divulgação (Lei 9.610/98, art. 46, III).</p>' +
      '<p>Como fazemos: a curadoria das fontes, a escolha dos textos e a edição e redação finais de cada número são feitas pela nossa redação. Na listagem, resumo e tradução iniciais de textos publicados na semana, contamos com uma ajuda da inteligência artificial.</p>' +
      '<p>Expediente: Redação Suplemento</p></footer>';
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

  function telaGuardados() {
    navAtiva('guardados');
    var g = lerGuardados();
    var corpo = g.length ? g.map(function (x) {
      var atual = ed && verbete(x.id);
      var destino = atual ? '#/v/' + x.id : x.url;
      var fora = atual ? '' : ' target="_blank" rel="noopener"';
      return '<a class="item-edicao" href="' + esc(destino) + '"' + fora + '><p class="citacao-lista">“' + md(x.citacao) + '”</p>' +
        '<span class="meta">' + esc(x.meta) + ' · Nº ' + x.numero + '</span></a>';
    }).join('') : '<div class="vazio"><p>Nada guardado ainda.</p><p class="discreto">Toque em “Guardar” num verbete para voltar a ele quando quiser, mesmo depois que a edição mudar.</p></div>';
    app.innerHTML = '<div class="topo"><a class="voltar" href="#/">' + ICONES.voltar + 'Hoje</a><div class="topo-dir">' + botaoTema() + '</div></div>' +
      '<div class="capa-edicao"><h1>Guardados</h1><div class="fio-duplo"></div></div>' +
      '<section class="bloco" style="padding-top:8px">' + corpo + '</section>';
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
    if (acao === 'tema') trocarTema();
    if (acao === 'guardar' && v) {
      var g = lerGuardados(), i = g.map(function (x) { return x.id; }).indexOf(id);
      if (i >= 0) { g.splice(i, 1); aviso('Tirado dos guardados'); }
      else {
        g.unshift({ id: id, numero: ed.numero, citacao: v.citacao, url: v.url, meta: semMarcas(quem(v) ? quem(v) + ' · ' + v.veiculo : v.veiculo) });
        aviso('Guardado');
      }
      gravarGuardados(g);
      b.setAttribute('aria-pressed', i < 0);
      b.querySelector('span').textContent = i < 0 ? 'Guardado' : 'Guardar';
    }
    if (acao === 'partilhar' && v) {
      var texto = '“' + semMarcas(v.citacao) + '” — ' + semMarcas(v.veiculo) + ', no Suplemento';
      var url = location.origin + location.pathname + location.search + '#/v/' + id;
      if (navigator.share) navigator.share({ title: 'Suplemento', text: texto, url: url }).catch(function () {});
      else if (navigator.clipboard) navigator.clipboard.writeText(texto + '\n' + url).then(function () { aviso('Link copiado'); });
    }
  });

  /* ---------- rotas ---------- */

  function rotear() {
    delete app.dataset.verbete;
    var h = location.hash.replace(/^#\/?/, '');
    if (h.indexOf('guardados') === 0) return telaGuardados();
    if (!ed) return telaVazia();
    if (h.indexOf('v/') === 0) return telaVerbete(h.slice(2));
    if (h.indexOf('edicao') === 0) { telaEdicao(); window.scrollTo(0, 0); return; }
    telaHoje(); window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', rotear);

  // Enquanto não houver edição publicada, o endereço principal mostra o nº 2 como prévia.
  function carregar(base) {
    return buscar(base + 'index.json').then(function (idx) {
      var lista = (idx.edicoes || []).slice().sort();
      if (!lista.length) return null;
      return buscar(base + lista[lista.length - 1] + '.json');
    });
  }
  carregar(BASE).then(function (e) {
    if (e || EXEMPLO) return e;
    EXEMPLO = true; BASE = 'exemplo/';
    document.body.classList.add('previa');
    return carregar(BASE);
  }).then(function (e) {
    ed = e;
    if (ed) escolherDia();
    rotear();
  }).catch(function () {
    app.innerHTML = cabeca(dataLonga(hojeISO(), true), '') + '<div class="vazio"><p>Não consegui carregar a edição agora.</p><p class="discreto">Confira a conexão e tente de novo.</p></div>';
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
})();
