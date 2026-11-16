/* Interface: só desenha o estado e encaminha ações ao motor. Nenhuma regra mora aqui. */
(function (root) {
  const L = root.Leilao;
  const M = L.motor;
  const CORES = ['#e2b44b', '#e8836b', '#7fb6e0', '#b79ce0', '#7fd1a8', '#d9c7a0'];
  const NOMES_PADRAO = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Fábio'];

  const mesaSalva = L.armazenamento.carregarMesa();
  const app = {
    tela: 'inicio',
    estado: null,
    salvo: L.armazenamento.carregar(),
    setup: mesaSalva || {
      n: 4,
      jogadores: NOMES_PADRAO.map((nome, i) => ({ nome, tipo: i === 0 ? 'humano' : 'bot' })),
      config: L.configPadrao(),
    },
    maoAberta: null, selecionada: null, decisaoAberta: null,
    aba: 'eventos', modal: null, abaModal: 'regras', avisos: [], revelada: 0, toast: null,
  };
  app.setup.config = Object.assign(L.configPadrao(), app.setup.config);

  /* ---------- utilitários ---------- */
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const src = (id) => { const c = L.cartas.get(id); return (L.IMAGENS && L.IMAGENS[c.imagem]) || c.imagem; };
  const nomeCarta = (id) => {
    const c = L.cartas.get(id);
    return c.categoria === 'dinheiro' ? `${L.REGRAS.naipes[c.naipe].nome} ${c.valor}` : c.nome;
  };
  const carta = (id, extra = '') => `<div class="carta ${extra}"><img src="${src(id)}" alt="${esc(nomeCarta(id))}"></div>`;
  const pts = (n) => (n > 0 ? `+${n}` : `${n}`) + (Math.abs(n) === 1 ? ' ponto' : ' pontos');
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
  const jog = (id) => L.jogadores.get(app.estado, id);
  const cor = (id) => CORES[L.jogadores.indice(app.estado, id) % CORES.length];
  const ponto = (id) => `<span class="ponto" style="background:${cor(id)}"></span>`;
  const humanos = () => app.estado.jogadores.filter((j) => j.tipo === 'humano');
  const soUmHumano = () => humanos().length <= 1;
  const efeitoTexto = (idRec) =>
    L.cartas.efeitoReceita(idRec, app.estado.config) === 'prorrogar'
      ? 'Prorroga: o animal acumula para a próxima rodada.'
      : 'Anula: o animal é descartado.';

  /* ---------- ações ---------- */
  function agir(fn) {
    const antes = app.estado.log.length;
    try {
      app.estado = fn(app.estado);
    } catch (err) {
      mostrarToast(err instanceof L.RegraViolada ? err.message : 'Erro inesperado: ' + err.message);
      if (!(err instanceof L.RegraViolada)) console.error(err);
      return render();
    }
    for (const ev of app.estado.log.slice(antes)) {
      if (ev.tipo === 'chupacabra') app.avisos.push({ tipo: 'chupacabra', ev });
      if (ev.tipo === 'receita') app.avisos.push({ tipo: 'receita', ev, carta: app.estado.rodada.receita && app.estado.rodada.receita.carta });
    }
    if (app.estado.fase === 'encerrada') { app.tela = 'final'; L.armazenamento.limpar(); }
    else L.armazenamento.salvar(app.estado);
    render();
    agendarBots();
  }

  function mostrarToast(msg) {
    app.toast = msg;
    clearTimeout(mostrarToast.t);
    mostrarToast.t = setTimeout(() => { app.toast = null; render(); }, 3200);
  }

  let timerBot = null;
  function agendarBots() {
    clearTimeout(timerBot);
    const e = app.estado;
    if (!e || e.fase !== 'jogando' || app.avisos.length) return;
    const r = e.rodada;
    if (r.fase === 'lances') {
      const bot = M.faltamLances(e).find((id) => jog(id).tipo === 'bot');
      if (bot) timerBot = setTimeout(() => agir((s) => M.lance(s, bot, L.bot.escolherLance(s, bot))), 350);
    } else if (r.fase === 'receita') {
      const eleg = M.elegiveisReceita(e);
      const bots = eleg.filter((id) => jog(id).tipo === 'bot');
      if (e.config.momentoReceita === 'secreto') {
        const b = bots.find((id) => !(id in r.intencoes));
        if (b) timerBot = setTimeout(() => agir((s) => M.intencaoReceita(s, b, L.bot.querReceita(s, b))), 400);
      } else if (app.botsDecidiram !== r.numero) {
        // Público: os bots decidem uma vez, com uma pausa para os humanos também poderem agir.
        app.botsDecidiram = r.numero;
        const quem = bots.find((id) => L.bot.querReceita(e, id));
        const soBots = eleg.every((id) => jog(id).tipo === 'bot');
        if (quem) timerBot = setTimeout(() => agir((s) => M.usarReceita(s, quem)), 1600);
        else if (soBots) timerBot = setTimeout(() => agir((s) => M.dispensarReceita(s)), 1200);
      }
    }
  }

  function iniciar(mesmaMesa) {
    const s = app.setup;
    try {
      app.estado = M.novaPartida({ jogadores: s.jogadores.slice(0, s.n), config: s.config });
    } catch (err) { mostrarToast(err.message); return render(); }
    L.armazenamento.salvarMesa(s);
    L.armazenamento.salvar(app.estado);
    Object.assign(app, { tela: 'jogo', maoAberta: null, selecionada: null, decisaoAberta: null, avisos: [], revelada: 0, modal: null });
    render();
    agendarBots();
  }

  /* ---------- tela inicial ---------- */
  function telaInicio() {
    const s = app.setup;
    const prov = L.PROVISORIAS;
    const linhas = s.jogadores.slice(0, s.n).map((j, i) => `
      <li><span class="ponto" style="background:${CORES[i]}"></span>
        <input aria-label="Nome do jogador ${i + 1}" data-campo="nome" data-i="${i}" value="${esc(j.nome)}" maxlength="18">
        <div class="segmento" role="group" aria-label="Tipo do jogador ${i + 1}">
          <button data-acao="tipo" data-i="${i}" data-v="humano" aria-pressed="${j.tipo === 'humano'}">Pessoa</button>
          <button data-acao="tipo" data-i="${i}" data-v="bot" aria-pressed="${j.tipo === 'bot'}">Bot</button>
        </div></li>`).join('');
    const cfgs = Object.keys(prov).map((k) => `
      <div class="cfg"><label for="cfg-${k}">${esc(prov[k].titulo)}</label>
        <select id="cfg-${k}" data-campo="cfg" data-k="${k}">
          ${Object.entries(prov[k].opcoes).map(([v, t]) => `<option value="${v}" ${s.config[k] === v ? 'selected' : ''}>${esc(t)}</option>`).join('')}
        </select>
        <small>Pendência: ${esc(prov[k].pendencia)}${prov[k].observacao ? '. ' + esc(prov[k].observacao) : ''}</small></div>`).join('');
    const salvo = app.salvo ? `
      <div class="salvo"><span>Há uma partida em andamento (rodada ${app.salvo.rodada.numero} de ${app.salvo.totalRodadas}).</span>
        <span><button class="btn btn-ouro" data-acao="continuar">Continuar partida</button>
        <button class="btn-texto" data-acao="descartar-salvo">Descartar</button></span></div>` : '';
    return `
    <main class="inicio">
      <section class="vitrine">
        <h1>Jogo de Leilão</h1>
        <p>Dê lances em quatro moedas, arremate os animais que valem mais e cuidado com a Receita Federal e o Chupacabra.</p>
        <div class="leque" aria-hidden="true">
          ${carta('din-kwanza-09')}${carta('ani-96')}${carta('din-euro-15')}${carta('rec-04')}
        </div>
      </section>
      <section class="preparo" aria-labelledby="t-mesa">
        <h2 id="t-mesa">Monte a mesa</h2>
        <div class="linha-campo"><span>Jogadores</span>
          <div class="segmento" role="group" aria-label="Quantidade de jogadores">
            ${[3, 4, 5, 6].map((n) => `<button data-acao="n" data-v="${n}" aria-pressed="${s.n === n}">${n}</button>`).join('')}
          </div></div>
        <p class="mudo" style="margin:-8px 0 12px;font-size:.9rem">${L.REGRAS.cartasPorJogador[s.n]} cartas de dinheiro e 1 Receita Federal para cada jogador.</p>
        <ol class="nomes">${linhas}</ol>
        <details class="provisorias">
          <summary>Regras provisórias (${Object.keys(prov).length})</summary>
          <p>Estes pontos ainda não têm regra oficial. Os valores abaixo são escolhas provisórias e podem ser trocados.</p>
          ${cfgs}
        </details>
        <div class="acoes-inicio">
          <button class="btn btn-ouro btn-grande" data-acao="iniciar">Iniciar partida</button>
          <button class="btn" data-acao="abrir-regras">Ler as regras</button>
        </div>
        ${salvo}
      </section>
    </main>`;
  }

  /* ---------- partida ---------- */
  function painelJogadores() {
    const e = app.estado, r = e.rodada;
    const classif = L.pontuacao.classificacao(e);
    const pos = Object.fromEntries(classif.map((c) => [c.id, c.posicao]));
    return e.jogadores.map((j) => {
      const fez = j.id in r.lances;
      const iniciante = r.ordem[0] === j.id;
      let estado = '';
      if (r.fase === 'lances') estado = fez ? '<span class="estado-lance feito">Lance feito</span>' : '<span class="estado-lance pendente">Escolhendo</span>';
      const ativo = (app.maoAberta === j.id || app.decisaoAberta === j.id) ? ' ativo' : '';
      return `<div class="jog${ativo}">
        <div class="jog-topo">${ponto(j.id)}<span class="jog-nome">${esc(j.nome)}</span><span class="jog-pontos num">${L.pontuacao.total(e, j)}</span></div>
        <div class="jog-info">
          <span>${pos[j.id]}º lugar</span><span>${plural(j.colecao.length, 'animal', 'animais')}</span><span>${plural(j.mao.length, 'carta', 'cartas')}</span>
          ${j.devorados.length ? `<span style="color:var(--chupa)">${j.devorados.length} devorado${j.devorados.length > 1 ? 's' : ''}</span>` : ''}
        </div>
        <div class="jog-info">
          ${j.receita ? '<span class="etiqueta azul">Receita disponível</span>' : '<span class="etiqueta">Receita usada</span>'}
          ${iniciante ? '<span class="etiqueta ouro">Inicia</span>' : ''}
          ${j.tipo === 'bot' ? '<span class="etiqueta">Bot</span>' : ''}
        </div>
        ${estado}
      </div>`;
    }).join('');
  }

  function cambio() {
    const e = app.estado, r = e.rodada;
    const hier = r.resultado ? r.resultado.hierarquia : L.REGRAS.hierarquiaPadrao;
    const placas = hier.map((n, i) => `${i ? '<span class="menor" aria-hidden="true">&lt;</span>' : ''}
      <div class="placa ${i === 3 ? 'forte' : ''}"><b>${L.REGRAS.naipes[n].simbolo}</b><span>${L.REGRAS.naipes[n].nome}</span></div>`).join('');
    const ini = jog(r.ordem[0]).nome;
    const nota = r.resultado
      ? `${esc(ini)} iniciou com ${L.REGRAS.naipes[hier[3]].nome}: é o naipe mais forte nesta rodada. O valor sempre decide primeiro; o naipe só desempata.`
      : `Ordem padrão. Na revelação, o naipe da carta de ${esc(ini)} vira o mais forte desta rodada.`;
    return `<div class="cambio"><div class="cambio-titulo">Câmbio da rodada · do mais fraco ao mais forte</div>
      <div class="cambio-placas" aria-label="Hierarquia: ${hier.map((n) => L.REGRAS.naipes[n].nome).join(' menor que ')}">${placas}</div>
      <p class="cambio-nota">${nota}</p></div>`;
  }

  function vitrineLeilao() {
    const e = app.estado, r = e.rodada;
    const total = r.premio.reduce((s, id) => s + L.cartas.pontos(id, e.config), 0);
    const temChupa = r.premio.some((id) => L.cartas.ehChupacabra(id));
    const nomes = r.premio.map(nomeCarta).join(' + ') || 'Sem prêmio';
    let detalhe = r.premio.length > 1 ? `Prêmio acumulado de ${r.premio.length} animais.` : 'Em leilão nesta rodada.';
    if (temChupa) detalhe += ' Quem arrematar o Chupacabra perde seu animal de maior pontuação.';
    return `<div class="vitrine-leilao">
      <div class="premio">${r.premio.map((id) => carta(id)).join('') || '<div class="vaga" style="width:140px">Sem animais</div>'}</div>
      <div class="premio-texto">
        <h2>${esc(nomes)}</h2>
        <div class="pts">${pts(total)}</div>
        <p>${detalhe}</p>
        ${cambio()}
      </div></div>`;
  }

  function slots() {
    const e = app.estado, r = e.rodada;
    const animar = r.resultado && app.revelada !== r.numero;
    const html = r.ordem.map((id, i) => {
      const j = jog(id);
      let corpo, tag = i === 0 ? 'Define o naipe' : '', cls = '';
      if (!r.resultado) corpo = id in r.lances ? '<div class="verso" role="img" aria-label="Lance escondido"></div>' : '<div class="vaga">aguardando</div>';
      else {
        corpo = carta(r.lances[id], animar ? 'virar' : '');
        if (id === r.resultado.vencedor) { cls = 'vencedor'; tag = 'Maior lance'; } else cls = 'perdeu';
      }
      return `<div class="slot ${cls}" style="${animar ? `animation-delay:${i * 90}ms` : ''}">${corpo}
        <div class="slot-nome">${ponto(id)}<span>${esc(j.nome)}</span></div><div class="slot-tag">${tag}</div></div>`;
    }).join('');
    if (animar) app.revelada = r.numero;
    return `<div class="lances" aria-label="Lances da rodada">${html}</div>`;
  }

  function painelMao(id) {
    const j = jog(id);
    const sel = app.selecionada && j.mao.includes(app.selecionada) ? app.selecionada : null;
    return `<div class="mao-topo"><h3>Mão de ${esc(j.nome)} · ${j.mao.length} cartas</h3>
        <div class="minha-receita">${j.receita ? carta(j.receita) + `<span>Sua Receita Federal. ${efeitoTexto(j.receita)}</span>` : '<span>Você já usou sua Receita Federal.</span>'}</div></div>
      <div class="mao" role="group" aria-label="Escolha a carta do lance">
        ${j.mao.map((c) => `<button data-acao="selecionar" data-c="${c}" aria-pressed="${sel === c}" aria-label="${esc(nomeCarta(c))}">${carta(c)}</button>`).join('')}
      </div>
      <div class="mao-rodape"><span>${sel ? `Lance escolhido: <b>${esc(nomeCarta(sel))}</b>` : 'Toque em uma carta para escolher o lance.'}</span>
        <span class="botoes">
          ${soUmHumano() ? '' : '<button class="btn-texto" data-acao="esconder">Esconder mão</button>'}
          <button class="btn btn-ouro" data-acao="confirmar-lance" data-j="${id}" ${sel ? '' : 'disabled'}>Confirmar lance</button>
        </span></div>`;
  }

  function areaAcao() {
    const e = app.estado, r = e.rodada;
    if (r.fase === 'lances') {
      const faltam = M.faltamLances(e);
      if (!faltam.length)
        return `<h3>Todos deram seus lances</h3><p>As cartas serão mostradas ao mesmo tempo.</p>
          <div class="botoes"><button class="btn btn-ouro btn-grande" data-acao="revelar">Revelar lances</button></div>`;
      const proximo = faltam.find((id) => jog(id).tipo === 'humano');
      if (!proximo) return '<h3>Os bots estão escolhendo…</h3>';
      if (soUmHumano() || app.maoAberta === proximo) return painelMao(proximo);
      return `<div class="cortina"><h3>Vez de ${esc(jog(proximo).nome)}</h3>
        <p>Passe o aparelho. Os outros jogadores não devem olhar a tela.</p>
        <button class="btn btn-ouro btn-grande" data-acao="abrir-mao" data-j="${proximo}">Mostrar a mão de ${esc(jog(proximo).nome)}</button></div>`;
    }
    if (r.fase === 'receita') {
      const venc = jog(r.resultado.vencedor);
      const eleg = M.elegiveisReceita(e);
      const premio = r.premio.map(nomeCarta).join(' + ');
      if (e.config.momentoReceita === 'secreto') {
        const pend = eleg.filter((id) => jog(id).tipo === 'humano' && !(id in r.intencoes));
        if (!pend.length) return '<h3>Aguardando as decisões…</h3>';
        const id = pend[0], j = jog(id);
        if (soUmHumano() || app.decisaoAberta === id)
          return `<h3>${esc(j.nome)}, decida em segredo</h3>
            <div class="receita-escolha">${carta(j.receita)}<div>
              <p>${esc(venc.nome)} venceu o leilão de ${esc(premio)}. ${efeitoTexto(j.receita)} Se mais de uma pessoa quiser, vale a regra provisória de prioridade.</p>
              <div class="botoes"><button class="btn btn-receita" data-acao="intencao" data-j="${id}" data-v="1">Usar a Receita</button>
              <button class="btn" data-acao="intencao" data-j="${id}" data-v="0">Não usar</button></div></div></div>`;
        return `<div class="cortina"><h3>Decisão secreta de ${esc(j.nome)}</h3><p>Só ${esc(j.nome)} deve olhar a tela agora.</p>
          <button class="btn btn-receita btn-grande" data-acao="abrir-decisao" data-j="${id}">Mostrar a decisão de ${esc(j.nome)}</button></div>`;
      }
      const hum = eleg.filter((id) => jog(id).tipo === 'humano');
      const nBots = eleg.length - hum.length;
      return `<h3>${esc(venc.nome)} venceu. Alguém usa a Receita Federal?</h3>
        <p>Antes da entrega de ${esc(premio)}, quem ainda tem a Receita pode invalidar o leilão. Só uma pode ser usada por rodada: vale quem acionar primeiro.${nBots ? ` ${nBots === 1 ? 'Um bot também pode' : 'Bots também podem'} acionar.` : ''}</p>
        <div class="botoes">
          ${hum.map((id) => `<button class="btn btn-receita" data-acao="usar-receita" data-j="${id}">${esc(jog(id).nome)} usa a Receita</button>`).join('')}
          ${hum.length ? `<button class="btn" data-acao="dispensar">Ninguém usa: entregar o prêmio</button>` : '<span class="mudo">Os bots estão decidindo…</span>'}
        </div>`;
    }
    // resolvida
    const d = r.desfecho;
    let titulo, texto = '';
    if (d.tipo === 'conquista') {
      const j = jog(d.jogador);
      const ganho = d.animais.reduce((s, id) => s + L.cartas.pontos(id, e.config), 0);
      titulo = d.animais.length ? `${esc(j.nome)} arrematou ${esc(d.animais.map(nomeCarta).join(' + '))}` : 'Rodada sem prêmio';
      texto = d.animais.length ? `${pts(ganho)} na coleção.` : '';
      if (d.devorados.length) texto += ` O Chupacabra devorou ${esc(d.devorados.map(nomeCarta).join(' e '))}.`;
    } else if (d.tipo === 'anulado') {
      titulo = 'Leilão anulado pela Receita Federal';
      texto = `${esc(d.animais.map(nomeCarta).join(' + '))} ${d.animais.length > 1 ? 'foram descartados' : 'foi descartado'}. Ninguém pontua.`;
    } else {
      titulo = 'Leilão prorrogado pela Receita Federal';
      texto = `${esc(d.animais.map(nomeCarta).join(' + '))} volta na próxima rodada junto com um novo animal.`;
    }
    const ultima = M.ehUltimaRodada(e);
    if (ultima && e.acumulado.length) texto += ' Como era a última rodada, o acumulado será descartado.';
    return `<h3>${titulo}</h3><p>${texto}</p>
      <div class="botoes"><button class="btn btn-ouro btn-grande" data-acao="proxima">${ultima ? 'Ver resultado final' : 'Próxima rodada'}</button></div>`;
  }

  function grafico(e) {
    const W = 280, H = 150, P = 22;
    const n = Math.max(1, e.totalRodadas);
    const todos = e.jogadores.flatMap((j) => j.pontosPorRodada).concat(0);
    const max = Math.max(5, ...todos), min = Math.min(0, ...todos);
    const x = (i) => P + (i / n) * (W - P - 6);
    const y = (v) => H - P - ((v - min) / (max - min)) * (H - P - 8);
    const linhas = e.jogadores.map((j) => {
      const p = [0].concat(j.pontosPorRodada).map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
      return `<polyline points="${p}" fill="none" stroke="${cor(j.id)}" stroke-width="2.2" stroke-linejoin="round"/>`;
    }).join('');
    return `<svg class="grafico" viewBox="0 0 ${W} ${H}" role="img" aria-label="Pontuação por rodada">
      <line x1="${P}" y1="${y(0)}" x2="${W - 6}" y2="${y(0)}" stroke="var(--linha)"/>
      <text x="2" y="${y(max) + 4}">${max}</text><text x="2" y="${y(0) + 4}">0</text>${min < 0 ? `<text x="2" y="${y(min) + 4}">${min}</text>` : ''}
      <text x="${P}" y="${H - 4}">rodada 0</text><text x="${W - 50}" y="${H - 4}">rodada ${n}</text>
      ${linhas}</svg>`;
  }

  function registro() {
    const e = app.estado;
    let corpo;
    if (app.aba === 'eventos') {
      corpo = `<ol class="eventos" reversed>${e.log.filter((ev) => ev.tipo !== 'lance').slice().reverse().map((ev) =>
        `<li class="ev-${ev.tipo}"><span class="r">Rodada ${ev.rodada}</span>${esc(ev.texto)}</li>`).join('')}</ol>`;
    } else {
      const c = L.pontuacao.classificacao(e);
      corpo = `<div style="overflow:auto">${grafico(e)}
        <table class="classif"><thead><tr><th>#</th><th>Jogador</th><th class="d">Animais</th><th class="d">Pontos</th></tr></thead><tbody>
        ${c.map((x) => `<tr><td>${x.posicao}º</td><td>${ponto(x.id)} ${esc(x.nome)}</td><td class="d num">${x.animais}</td><td class="d num"><b>${x.pontos}</b></td></tr>`).join('')}
        </tbody></table></div>`;
    }
    return `<aside class="registro painel">
      <div class="abas" role="tablist">
        <button role="tab" aria-selected="${app.aba === 'eventos'}" data-acao="aba" data-v="eventos">Eventos</button>
        <button role="tab" aria-selected="${app.aba === 'pontos'}" data-acao="aba" data-v="pontos">Pontuação</button>
      </div>${corpo}</aside>`;
  }

  function telaJogo() {
    const e = app.estado, r = e.rodada;
    return `<div class="jogo">
      <header class="barra">
        <h1>Jogo de Leilão</h1>
        <span class="rodada num">Rodada ${r.numero} de ${e.totalRodadas}</span>
        <span class="mudo num monte">${plural(e.baralhoAnimais.length, 'animal', 'animais')} no monte</span>
        <span class="espaco"></span>
        <button class="btn-texto" data-acao="abrir-regras">Regras</button>
        <button class="btn-texto" data-acao="sair">Sair</button>
      </header>
      <aside class="jogadores" aria-label="Jogadores">${painelJogadores()}</aside>
      <section class="palco">
        ${vitrineLeilao()}
        ${slots()}
        <div class="acao" aria-live="polite">${areaAcao()}</div>
      </section>
      ${registro()}
    </div>`;
  }

  /* ---------- tela final ---------- */
  function telaFinal() {
    const e = app.estado;
    const { classificacao, vencedores } = e.final;
    const nomes = vencedores.map((id) => jog(id).nome);
    const titulo = nomes.length > 1 ? `Empate: ${nomes.join(' e ')}` : `${nomes[0]} vence`;
    const sub = nomes.length > 1
      ? `Vencedores conjuntos com ${classificacao[0].pontos} pontos. Não há regra oficial de desempate.`
      : `${classificacao[0].pontos} pontos em ${e.totalRodadas} rodadas.`;
    const especiais = e.log.filter((ev) => ev.tipo === 'receita' || ev.tipo === 'chupacabra' || (ev.tipo === 'descarte'));
    const ranking = classificacao.map((x) => {
      const j = jog(x.id);
      return `<div class="rank ${vencedores.includes(x.id) ? 'campeao' : ''}">
        <div class="rank-pos">${x.posicao}º</div>
        <div><div class="rank-nome">${ponto(x.id)} ${esc(x.nome)}</div>
          <div class="colecao">${j.colecao.map((id) => carta(id)).join('')}${j.devorados.map((id) => carta(id, 'devorado')).join('')}</div>
          <div class="mudo" style="font-size:.82rem;margin-top:4px">${plural(j.colecao.length, 'animal', 'animais')}${j.devorados.length ? ` · ${j.devorados.length} devorado(s) pelo Chupacabra (apagados)` : ''} · Receita ${j.receita ? 'não usada' : 'usada'}</div></div>
        <div class="rank-pts num">${x.pontos}<small>pontos</small></div></div>`;
    }).join('');
    return `<main class="final">
      <header class="final-cab"><h1>${esc(titulo)}</h1><p>${esc(sub)}</p></header>
      <section class="ranking" aria-label="Classificação final">${ranking}</section>
      <div class="duas">
        <section class="painel"><h2>Pontuação por rodada</h2>${grafico(e)}</section>
        <section class="painel"><h2>Eventos especiais</h2>
          ${especiais.length ? `<ol class="eventos">${especiais.map((ev) => `<li class="ev-${ev.tipo}"><span class="r">Rodada ${ev.rodada}</span>${esc(ev.texto)}</li>`).join('')}</ol>` : '<p class="mudo">Nenhuma Receita usada e nenhum Chupacabra arrematado.</p>'}
        </section>
      </div>
      <div class="acoes-final">
        <button class="btn btn-ouro btn-grande" data-acao="revanche">Jogar de novo com a mesma mesa</button>
        <button class="btn btn-grande" data-acao="nova-mesa">Montar nova mesa</button>
      </div>
    </main>`;
  }

  /* ---------- modais e avisos ---------- */
  function avisoAtual() {
    const a = app.avisos[0];
    if (!a) return '';
    if (a.tipo === 'chupacabra') {
      const j = jog(a.ev.jogador);
      return `<div class="fundo-modal"><div class="modal aviso chupa" role="alertdialog" aria-labelledby="av-t">
        <h2 id="av-t">Chupacabra!</h2>
        <p>${esc(a.ev.texto)}</p>
        <div class="aviso-cartas">${carta(a.ev.devorado ? 'ani-chupacabra-1' : 'ani-chupacabra-2')}${a.ev.devorado ? carta(a.ev.devorado, 'devorado') : ''}</div>
        <button class="btn btn-ouro" data-acao="fechar-aviso" autofocus>Continuar</button></div></div>`;
    }
    return `<div class="fundo-modal"><div class="modal aviso rec" role="alertdialog" aria-labelledby="av-t">
      <h2 id="av-t">Receita Federal</h2>
      <p>${esc(a.ev.texto)}</p>
      <div class="aviso-cartas">${a.carta ? carta(a.carta, 'carimbo') : ''}</div>
      <button class="btn btn-ouro" data-acao="fechar-aviso" autofocus>Continuar</button></div></div>`;
  }

  function modalRegras() {
    const prov = L.PROVISORIAS;
    const cfg = app.estado ? app.estado.config : app.setup.config;
    let corpo;
    if (app.abaModal === 'regras') {
      corpo = `
        <p>Jogo competitivo para 3 a 6 jogadores. Vence quem terminar com mais pontos em animais.</p>
        <h3>Preparação</h3>
        <p>As 60 cartas de dinheiro (Euro, Dólar, Real e Kwanza, de 1 a 15) são divididas igualmente: 20 cartas com 3 jogadores, 15 com 4, 12 com 5 e 10 com 6. Cada jogador recebe 1 Receita Federal. Os 74 animais são embaralhados.</p>
        <h3>Leilão</h3>
        <ol><li>Um animal é apresentado como prêmio.</li><li>Cada jogador escolhe em segredo uma carta de dinheiro. Um lance por rodada.</li>
        <li>Os lances são revelados ao mesmo tempo.</li><li>Vence o maior valor. Em valores iguais, desempata o naipe.</li>
        <li>O vencedor recebe o animal, a menos que a Receita Federal invalide o leilão.</li><li>Todas as cartas de dinheiro usadas são descartadas.</li></ol>
        <h3>Hierarquia dos naipes</h3>
        <p>Padrão: Kwanza &lt; Real &lt; Dólar &lt; Euro. O naipe da carta de quem inicia a rodada vira o mais forte; os outros mantêm a ordem. Vale só para aquela rodada. O valor numérico sempre vem antes do naipe.</p>
        <h3>Receita Federal</h3>
        <p>Depois da revelação, quem ainda tem a Receita pode usá-la contra o vencedor. Só uma por rodada. A carta usada é descartada. O documento de regras diz que o leilão é anulado e o animal descartado; três das seis cartas, porém, dizem que o leilão é prorrogado e o animal acumula para a próxima rodada (veja as regras provisórias).</p>
        <h3>Chupacabra</h3>
        <p>Há 2 Chupacabras. Quem arremata um perde o animal de maior pontuação que já tinha (sorteio em caso de empate). Sem animais, nada acontece. A carta mostra -5 pontos.</p>
        <h3>Fim</h3>
        <p>A partida termina quando todos usam todas as cartas de dinheiro. Animais devorados ou descartados não pontuam. Empate no topo: vencedores conjuntos.</p>`;
    } else if (app.abaModal === 'provisorias') {
      corpo = `<p>Decisões ainda pendentes. Nada aqui é regra oficial. ${app.estado ? 'Valores desta partida:' : 'Você pode trocá-los na tela inicial.'}</p>
        <ul>${Object.keys(prov).map((k) => `<li><b>${esc(prov[k].titulo)}:</b> ${esc(prov[k].opcoes[cfg[k]])}. <span class="mudo">Pendência: ${esc(prov[k].pendencia)}.</span></li>`).join('')}
        <li><b>Prêmio acumulado com Chupacabra:</b> os animais entram na coleção na ordem em que foram leiloados. <span class="mudo">Pendência: não definido.</span></li>
        <li><b>Acumulado na última rodada:</b> se a última rodada for prorrogada, os animais acumulados são descartados. <span class="mudo">Pendência: não definido.</span></li>
        <li><b>Receitas sobrando:</b> com menos de 6 jogadores, as Receitas não distribuídas ficam fora do jogo, sorteadas no início.</li></ul>`;
    } else {
      const ani = L.CATALOGO;
      const rev = ani.filter((c) => c.revisar);
      corpo = `<p>${ani.length} cartas no catálogo. ${rev.length} têm observações de conferência (dados lidos na imagem diferentes do nome do arquivo, ou não citados nas regras) e estão marcadas em dourado.</p>
        <div class="cat-grade">${ani.filter((c) => c.categoria !== 'dinheiro').map((c) => `
          <div class="cat-item ${c.revisar ? 'revisar' : ''}">${carta(c.id)}<b>${esc(c.nome)}</b>
            <small>${c.categoria === 'animal' ? pts(L.cartas.pontos(c.id, cfg)) : esc(c.efeito)} · ${esc(c.id)}</small>
            ${c.nota ? `<small>${esc(c.nota)}</small>` : ''}</div>`).join('')}</div>`;
    }
    return `<div class="fundo-modal" data-acao="fechar-modal-fundo"><div class="modal" role="dialog" aria-labelledby="m-t" aria-modal="true">
      <div class="modal-cab"><h2 id="m-t">Regras</h2><button class="btn-texto" data-acao="fechar-modal">Fechar</button></div>
      <div class="modal-corpo"><div class="abas" role="tablist">
        ${[['regras', 'Regras oficiais'], ['provisorias', 'Provisórias'], ['cartas', 'Animais e Receitas']].map(([v, t]) =>
          `<button role="tab" aria-selected="${app.abaModal === v}" data-acao="aba-modal" data-v="${v}">${t}</button>`).join('')}
      </div>${corpo}</div></div></div>`;
  }

  function modalSair() {
    return `<div class="fundo-modal"><div class="modal aviso" role="alertdialog" aria-labelledby="s-t">
      <h2 id="s-t">Sair da partida?</h2><p>A partida fica salva e pode ser retomada na tela inicial.</p>
      <div class="botoes" style="justify-content:center;display:flex;gap:10px">
        <button class="btn" data-acao="fechar-modal">Voltar ao jogo</button>
        <button class="btn btn-ouro" data-acao="confirmar-sair">Sair</button></div></div></div>`;
  }

  /* ---------- renderização ---------- */
  const raiz = () => document.getElementById('app');
  function render() {
    let html = app.tela === 'inicio' ? telaInicio() : app.tela === 'jogo' ? telaJogo() : telaFinal();
    if (app.tela !== 'inicio' && app.avisos.length) html += avisoAtual();
    if (app.modal === 'regras') html += modalRegras();
    if (app.modal === 'sair') html += modalSair();
    if (app.toast) html += `<div class="toast" role="status">${esc(app.toast)}</div>`;
    raiz().innerHTML = html;
    const foco = raiz().querySelector('[autofocus]');
    if (foco) foco.focus();
  }

  function clique(ev) {
    const alvo = ev.target.closest('[data-acao]');
    if (!alvo) return;
    const a = alvo.dataset.acao, v = alvo.dataset.v, j = alvo.dataset.j;
    if (a === 'fechar-modal-fundo' && ev.target !== alvo) return;
    const s = app.setup;
    switch (a) {
      case 'n': s.n = +v; break;
      case 'tipo': s.jogadores[+alvo.dataset.i].tipo = v; break;
      case 'iniciar': return iniciar();
      case 'continuar':
        Object.assign(app, { estado: app.salvo, tela: 'jogo', avisos: [], revelada: app.salvo.rodada.numero });
        render(); return agendarBots();
      case 'descartar-salvo': L.armazenamento.limpar(); app.salvo = null; break;
      case 'abrir-regras': app.modal = 'regras'; break;
      case 'fechar-modal': case 'fechar-modal-fundo': app.modal = null; break;
      case 'aba-modal': app.abaModal = v; break;
      case 'aba': app.aba = v; break;
      case 'abrir-mao': app.maoAberta = j; app.selecionada = null; break;
      case 'esconder': app.maoAberta = null; app.selecionada = null; break;
      case 'selecionar': app.selecionada = alvo.dataset.c; break;
      case 'confirmar-lance': {
        const c = app.selecionada;
        app.maoAberta = null; app.selecionada = null;
        return agir((e) => M.lance(e, j, c));
      }
      case 'revelar': return agir((e) => M.revelar(e));
      case 'usar-receita': clearTimeout(timerBot); return agir((e) => M.usarReceita(e, j));
      case 'dispensar': clearTimeout(timerBot); return agir((e) => M.dispensarReceita(e));
      case 'abrir-decisao': app.decisaoAberta = j; break;
      case 'intencao': app.decisaoAberta = null; return agir((e) => M.intencaoReceita(e, j, v === '1'));
      case 'proxima': return agir((e) => M.proximaRodada(e));
      case 'fechar-aviso': app.avisos.shift(); render(); return agendarBots();
      case 'sair': app.modal = 'sair'; break;
      case 'confirmar-sair':
        clearTimeout(timerBot);
        Object.assign(app, { modal: null, tela: 'inicio', salvo: app.estado, estado: null });
        break;
      case 'revanche': return iniciar(true);
      case 'nova-mesa': Object.assign(app, { tela: 'inicio', estado: null, salvo: null }); break;
    }
    render();
  }

  function entrada(ev) {
    const t = ev.target;
    if (t.dataset.campo === 'nome') { app.setup.jogadores[+t.dataset.i].nome = t.value; L.armazenamento.salvarMesa(app.setup); }
    if (t.dataset.campo === 'cfg') { app.setup.config[t.dataset.k] = t.value; L.armazenamento.salvarMesa(app.setup); }
  }

  function teclado(ev) {
    if (ev.key === 'Escape' && app.modal) { app.modal = null; render(); }
  }

  L.iniciarInterface = function () {
    const problemas = L.cartas.validarCatalogo();
    if (problemas.length) {
      raiz().innerHTML = `<main class="final"><h1>Catálogo com problemas</h1><ul>${problemas.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></main>`;
      return;
    }
    document.addEventListener('click', clique);
    document.addEventListener('input', entrada);
    document.addEventListener('change', entrada);
    document.addEventListener('keydown', teclado);
    render();
  };
})(globalThis);
