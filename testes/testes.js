/* Testes das regras. Rode com:  node testes/testes.js */
const path = require('path');
for (const f of ['data/catalogo.js', 'src/config.js', 'src/cartas.js', 'src/jogadores.js', 'src/leilao.js',
  'src/efeitos.js', 'src/pontuacao.js', 'src/motor.js', 'src/bot.js'])
  require(path.join(__dirname, '..', f));
const L = globalThis.Leilao;
const M = L.motor;

let ok = 0, falhas = 0;
function teste(nome, fn) {
  try { fn(); ok++; console.log('  ✓ ' + nome); }
  catch (err) { falhas++; console.log('  ✗ ' + nome + '\n      ' + err.message); }
}
function igual(a, b, msg) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg || ''} esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`);
}
function verdade(v, msg) { if (!v) throw new Error(msg || 'esperado verdadeiro'); }
function falha(fn, trecho) {
  try { fn(); } catch (err) {
    if (!(err instanceof L.RegraViolada)) throw err;
    if (trecho && !err.message.includes(trecho)) throw new Error(`mensagem inesperada: ${err.message}`);
    return;
  }
  throw new Error('deveria ter sido bloqueado');
}
const jogadores = (n, tipo = 'humano') => Array.from({ length: n }, (_, i) => ({ nome: `P${i + 1}`, tipo }));
const nova = (n, config, semente = 42) => M.novaPartida({ jogadores: jogadores(n), config, semente });

/* Prepara uma rodada controlada: mãos, prêmio e iniciante definidos à mão. */
function rodadaControlada(n, maos, premio, iniciante = 0, config) {
  let e = nova(n, Object.assign({ primeiroIniciante: 'jogador-1' }, config));
  e.jogadores.forEach((j, i) => { j.mao = maos[i].slice(); });
  e.baralhoAnimais.unshift(...e.rodada.premio);
  e.baralhoAnimais = e.baralhoAnimais.filter((id) => !premio.includes(id));
  e.rodada.premio = premio.slice();
  e.rodada.inicianteIdx = iniciante;
  e.rodada.ordem = L.jogadores.ordemDaMesa(e, iniciante);
  return e;
}
function jogarLances(e, lances) {
  e.rodada.ordem.forEach((id) => { e = M.lance(e, id, lances[L.jogadores.indice(e, id)]); });
  return e;
}

console.log('\nCatálogo');
teste('140 cartas válidas', () => {
  igual(L.CATALOGO.length, 140);
  igual(L.cartas.validarCatalogo(), []);
});
teste('60 cartas de dinheiro, 4 naipes de 1 a 15', () => {
  const d = L.cartas.porCategoria('dinheiro');
  igual(d.length, 60);
  for (const n of ['euro', 'dolar', 'real', 'kwanza'])
    igual(d.filter((c) => c.naipe === n).map((c) => c.valor).sort((a, b) => a - b), [...Array(15)].map((_, i) => i + 1), n);
});
teste('74 animais (2 Chupacabras) e 6 Receitas', () => {
  igual(L.cartas.porCategoria('animal').length, 74);
  igual(L.cartas.porCategoria('animal').filter((a) => a.efeito === 'devorar-maior').length, 2);
  igual(L.cartas.porCategoria('receita').length, 6);
});

console.log('\nPreparação');
for (const [n, por] of [[3, 20], [4, 15], [5, 12], [6, 10]]) {
  teste(`${n} jogadores recebem ${por} cartas e 1 Receita cada`, () => {
    const e = nova(n);
    igual(e.totalRodadas, por);
    const todas = e.jogadores.flatMap((j) => j.mao);
    e.jogadores.forEach((j) => igual(j.mao.length, por));
    igual(new Set(todas).size, 60, 'dinheiro único');
    igual(new Set(e.jogadores.map((j) => j.receita)).size, n, 'receitas únicas');
    igual(e.baralhoAnimais.length + e.rodada.premio.length, 74);
  });
}
teste('bloqueia 2 e 7 jogadores e nomes repetidos', () => {
  falha(() => nova(2));
  falha(() => nova(7));
  falha(() => M.novaPartida({ jogadores: [{ nome: 'A' }, { nome: 'a' }, { nome: 'B' }] }), 'repetido');
});

console.log('\nHierarquia e vencedor');
teste('hierarquia por naipe do iniciante (tabela do documento)', () => {
  igual(L.leilao.hierarquia('euro'), ['kwanza', 'real', 'dolar', 'euro']);
  igual(L.leilao.hierarquia('dolar'), ['kwanza', 'real', 'euro', 'dolar']);
  igual(L.leilao.hierarquia('real'), ['kwanza', 'dolar', 'euro', 'real']);
  igual(L.leilao.hierarquia('kwanza'), ['real', 'dolar', 'euro', 'kwanza']);
});
teste('valor numérico tem prioridade: Kwanza 9 vence Euro 8', () => {
  const r = L.leilao.resolver({ a: 'din-euro-08', b: 'din-kwanza-09' }, ['a', 'b'], L.configPadrao());
  igual(r.vencedor, 'b');
});
teste('desempate por naipe muda com o iniciante', () => {
  const lances = { a: 'din-real-07', b: 'din-euro-07', c: 'din-dolar-03' };
  igual(L.leilao.resolver(lances, ['a', 'b', 'c'], L.configPadrao()).vencedor, 'a', 'iniciante de Real');
  igual(L.leilao.resolver(lances, ['b', 'c', 'a'], L.configPadrao()).vencedor, 'b', 'iniciante de Euro');
  const l2 = { a: 'din-dolar-01', b: 'din-euro-05', c: 'din-dolar-05' };
  igual(L.leilao.resolver(l2, ['a', 'b', 'c'], L.configPadrao()).vencedor, 'c', 'Dólar mais forte que Euro');
  igual(L.leilao.resolver(l2, ['b', 'c', 'a'], L.configPadrao()).vencedor, 'b');
});
teste('a hierarquia muda a cada rodada', () => {
  let e = rodadaControlada(3, [['din-kwanza-01', 'din-euro-02'], ['din-euro-05', 'din-real-03'], ['din-real-05', 'din-dolar-04']], ['ani-87']);
  e = M.revelar(jogarLances(e, ['din-kwanza-01', 'din-euro-05', 'din-real-05']));
  igual(e.rodada.resultado.hierarquia[3], 'kwanza');
  igual(e.rodada.resultado.vencedor, 'j2', 'Kwanza forte, Euro > Real no resto');
  e = M.dispensarReceita(e);
  e = M.proximaRodada(e);
  igual(e.rodada.ordem[0], 'j2', 'rotação provisória');
  e = M.revelar(jogarLances(e, ['din-euro-02', 'din-real-03', 'din-dolar-04']));
  igual(e.rodada.resultado.hierarquia[3], 'real');
  igual(e.rodada.resultado.vencedor, 'j3');
});

console.log('\nLances e descarte');
teste('cartas usadas saem da mão e vão para o descarte', () => {
  let e = rodadaControlada(3, [['din-euro-01', 'din-euro-02'], ['din-real-01', 'din-real-02'], ['din-dolar-01', 'din-dolar-02']], ['ani-87']);
  e = M.revelar(jogarLances(e, ['din-euro-02', 'din-real-01', 'din-dolar-01']));
  igual(e.jogadores.map((j) => j.mao.length), [1, 1, 1]);
  igual(e.descarte.dinheiro.sort(), ['din-dolar-01', 'din-euro-02', 'din-real-01']);
});
teste('bloqueia carta fora da mão, carta repetida e segundo lance', () => {
  let e = rodadaControlada(3, [['din-euro-01', 'din-euro-02'], ['din-real-01'], ['din-dolar-01']], ['ani-87']);
  falha(() => M.lance(e, 'j1', 'din-real-01'), 'não está na mão');
  falha(() => M.lance(e, 'j1', 'ani-87'), 'dinheiro');
  e = M.lance(e, 'j1', 'din-euro-01');
  falha(() => M.lance(e, 'j1', 'din-euro-02'), 'já fez');
  falha(() => M.lance(e, 'j2', 'din-euro-01'), 'não está na mão');
});
teste('não revela nem avança antes de todos os lances', () => {
  let e = rodadaControlada(3, [['din-euro-01'], ['din-real-01'], ['din-dolar-01']], ['ani-87']);
  e = M.lance(e, 'j1', 'din-euro-01');
  falha(() => M.revelar(e), 'faltam');
  falha(() => M.proximaRodada(e), 'não terminou');
});
teste('ações não alteram o estado anterior', () => {
  const e = rodadaControlada(3, [['din-euro-01'], ['din-real-01'], ['din-dolar-01']], ['ani-87']);
  const antes = JSON.stringify(e);
  M.lance(e, 'j1', 'din-euro-01');
  igual(JSON.stringify(e), antes);
});

console.log('\nReceita Federal');
const maos3 = [['din-euro-01', 'din-euro-02', 'din-euro-03'], ['din-real-15', 'din-real-14', 'din-real-13'], ['din-dolar-01', 'din-dolar-02', 'din-dolar-03']];
function comReceitas(e, efeitos) {
  // j1, j2, j3 recebem Receitas com os efeitos pedidos
  const anula = ['rec-04', 'rec-05', 'rec-06'], prorroga = ['rec-01', 'rec-02', 'rec-03'];
  e.jogadores.forEach((j, i) => { j.receita = (efeitos[i] === 'anular' ? anula : prorroga)[i]; });
  return e;
}
teste('anular: animal descartado, vencedor não pontua, Receita descartada', () => {
  let e = comReceitas(rodadaControlada(3, maos3, ['ani-95']), ['anular', 'anular', 'anular']);
  e = M.revelar(jogarLances(e, ['din-euro-01', 'din-real-15', 'din-dolar-01']));
  igual(e.rodada.fase, 'receita');
  igual(M.elegiveisReceita(e), ['j1', 'j3'], 'vencedor não é elegível');
  falha(() => M.usarReceita(e, 'j2'), 'vencedor');
  e = M.usarReceita(e, 'j1');
  igual(e.jogadores[1].colecao, []);
  verdade(e.descarte.animais.includes('ani-95'));
  igual(e.jogadores[0].receita, null);
  verdade(e.descarte.receitas.includes('rec-04'));
  igual(L.pontuacao.total(e, e.jogadores[1]), 0);
});
teste('limite de uma Receita por rodada', () => {
  let e = comReceitas(rodadaControlada(3, maos3, ['ani-95']), ['anular', 'anular', 'anular']);
  e = M.revelar(jogarLances(e, ['din-euro-01', 'din-real-15', 'din-dolar-01']));
  e = M.usarReceita(e, 'j1');
  falha(() => M.usarReceita(e, 'j3'));
  igual(e.jogadores[2].receita, 'rec-06', 'j3 mantém a sua');
});
teste('não usa Receita já descartada em rodada seguinte', () => {
  let e = comReceitas(rodadaControlada(3, maos3, ['ani-95']), ['anular', 'anular', 'anular']);
  e = M.usarReceita(M.revelar(jogarLances(e, ['din-euro-01', 'din-real-15', 'din-dolar-01'])), 'j1');
  e = M.proximaRodada(e);
  e = M.revelar(jogarLances(e, ['din-euro-02', 'din-real-14', 'din-dolar-02']));
  igual(M.elegiveisReceita(e), ['j3']);
  falha(() => M.usarReceita(e, 'j1'), 'não tem mais');
});
teste('prorrogar: animal acumula e o próximo vencedor leva tudo', () => {
  let e = comReceitas(rodadaControlada(3, maos3, ['ani-95']), ['prorrogar', 'anular', 'anular']);
  e = M.usarReceita(M.revelar(jogarLances(e, ['din-euro-01', 'din-real-15', 'din-dolar-01'])), 'j1');
  igual(e.acumulado, ['ani-95']);
  e = M.proximaRodada(e);
  igual(e.rodada.premio.length, 2);
  igual(e.rodada.premio[0], 'ani-95');
  e = M.dispensarReceita(M.revelar(jogarLances(e, ['din-euro-02', 'din-real-14', 'din-dolar-02'])));
  verdade(e.jogadores[1].colecao.includes('ani-95'));
  igual(e.jogadores[1].colecao.length, 2);
});
teste('configuração "sempre-anular" ignora o texto da carta', () => {
  let e = comReceitas(rodadaControlada(3, maos3, ['ani-95'], 0, { efeitoReceita: 'sempre-anular' }), ['prorrogar', 'anular', 'anular']);
  e = M.usarReceita(M.revelar(jogarLances(e, ['din-euro-01', 'din-real-15', 'din-dolar-01'])), 'j1');
  igual(e.acumulado, []);
  verdade(e.descarte.animais.includes('ani-95'));
});
teste('modo secreto: dois interessados, só um usa (ordem da mesa)', () => {
  let e = comReceitas(rodadaControlada(3, maos3, ['ani-95'], 0, { momentoReceita: 'secreto' }), ['anular', 'anular', 'anular']);
  e = M.revelar(jogarLances(e, ['din-euro-01', 'din-real-15', 'din-dolar-01']));
  e = M.intencaoReceita(e, 'j3', true);
  igual(e.rodada.fase, 'receita', 'espera todos decidirem');
  e = M.intencaoReceita(e, 'j1', true);
  igual(e.rodada.receita.jogador, 'j1');
  igual(e.jogadores[2].receita, 'rec-06');
  igual(e.rodada.fase, 'resolvida');
});

console.log('\nChupacabra');
teste('devora o animal de maior pontuação', () => {
  let e = rodadaControlada(3, maos3, ['ani-chupacabra-1']);
  e.jogadores[1].colecao = ['ani-87', 'ani-95', 'ani-44'];
  e = M.dispensarReceita(M.revelar(jogarLances(e, ['din-euro-01', 'din-real-15', 'din-dolar-01'])));
  const j = e.jogadores[1];
  igual(j.devorados, ['ani-95']);
  igual(j.colecao.sort(), ['ani-44', 'ani-87', 'ani-chupacabra-1'].sort());
  igual(L.pontuacao.total(e, j), 1 + 3 - 5, 'devorado não pontua; Chupacabra vale -5 pela carta');
});
teste('coleção vazia: nada acontece', () => {
  let e = rodadaControlada(3, maos3, ['ani-chupacabra-1']);
  e = M.dispensarReceita(M.revelar(jogarLances(e, ['din-euro-01', 'din-real-15', 'din-dolar-01'])));
  igual(e.jogadores[1].devorados, []);
  igual(e.jogadores[1].colecao, ['ani-chupacabra-1']);
});
teste('empate entre maiores: sorteio entre os empatados', () => {
  const vistos = new Set();
  for (let s = 1; s <= 40; s++) {
    let e = rodadaControlada(3, maos3, ['ani-chupacabra-2']);
    e.rng.semente = s;
    e.jogadores[1].colecao = ['ani-87', 'ani-95', 'ani-94', 'ani-92'];
    e = M.dispensarReceita(M.revelar(jogarLances(e, ['din-euro-01', 'din-real-15', 'din-dolar-01'])));
    const d = e.jogadores[1].devorados[0];
    verdade(['ani-95', 'ani-94', 'ani-92'].includes(d), 'só animais de 5 pontos');
    vistos.add(d);
  }
  verdade(vistos.size > 1, 'o sorteio deve variar');
});
teste('não devora outro Chupacabra (provisório) e pontos zero opcionais', () => {
  let e = rodadaControlada(3, maos3, ['ani-chupacabra-2'], 0, { pontosChupacabra: 'zero' });
  e.jogadores[1].colecao = ['ani-chupacabra-1'];
  e = M.dispensarReceita(M.revelar(jogarLances(e, ['din-euro-01', 'din-real-15', 'din-dolar-01'])));
  igual(e.jogadores[1].devorados, []);
  igual(L.pontuacao.total(e, e.jogadores[1]), 0);
});

console.log('\nPartidas completas (bots, todas as fases)');
function partidaCompleta(n, semente, config) {
  let rnd = semente;
  const aleatorio = () => ((rnd = (rnd * 1103515245 + 12345) % 2147483648) / 2147483648);
  let e = M.novaPartida({ jogadores: jogadores(n, 'bot'), config, semente });
  let rodadas = 0;
  while (e.fase === 'jogando') {
    for (const id of e.rodada.ordem) e = M.lance(e, id, L.bot.escolherLance(e, id, aleatorio));
    e = M.revelar(e);
    if (e.rodada.fase === 'receita') {
      if (e.config.momentoReceita === 'secreto') {
        for (const id of M.elegiveisReceita(e)) if (e.rodada.fase === 'receita') e = M.intencaoReceita(e, id, L.bot.querReceita(e, id, aleatorio));
      } else {
        const quem = M.elegiveisReceita(e).find((id) => L.bot.querReceita(e, id, aleatorio));
        e = quem ? M.usarReceita(e, quem) : M.dispensarReceita(e);
      }
    }
    rodadas++;
    e = M.proximaRodada(e);
  }
  return { e, rodadas };
}
for (const n of [3, 4, 5, 6]) {
  teste(`${n} jogadores: ${L.REGRAS.cartasPorJogador[n]} rodadas, encerramento e contas fecham`, () => {
    for (let s = 1; s <= 25; s++) {
      const cfg = s % 2 ? {} : { momentoReceita: 'secreto', rotacaoIniciante: 'vencedor-anterior', prioridadeReceita: 'aleatorio' };
      const { e, rodadas } = partidaCompleta(n, s * 7919, cfg);
      igual(rodadas, L.REGRAS.cartasPorJogador[n]);
      igual(e.fase, 'encerrada');
      verdade(e.jogadores.every((j) => j.mao.length === 0));
      igual(e.descarte.dinheiro.length, 60);
      const animais = e.jogadores.flatMap((j) => j.colecao.concat(j.devorados)).length + e.descarte.animais.length + e.baralhoAnimais.length + e.acumulado.length;
      igual(animais, 74, 'nenhum animal some ou duplica');
      const usadas = e.descarte.receitas.length + e.jogadores.filter((j) => j.receita).length;
      igual(usadas, n);
      e.jogadores.forEach((j) => igual(j.pontosPorRodada.length, rodadas));
      const c = e.final.classificacao;
      for (let i = 1; i < c.length; i++) verdade(c[i - 1].pontos >= c[i].pontos, 'ordenado');
      igual(e.final.vencedores, c.filter((x) => x.pontos === c[0].pontos).map((x) => x.id));
      falha(() => M.proximaRodada(e), 'terminou');
    }
  });
}
teste('empate final: vencedores conjuntos', () => {
  const e = nova(3);
  e.jogadores[0].colecao = ['ani-95'];
  e.jogadores[1].colecao = ['ani-94'];
  e.jogadores[2].colecao = ['ani-87'];
  igual(L.pontuacao.vencedores(e), ['j1', 'j2']);
  const c = L.pontuacao.classificacao(e);
  igual(c.map((x) => x.posicao), [1, 1, 3]);
});
teste('reinício: nova partida depois de uma encerrada', () => {
  partidaCompleta(4, 99, {});
  const e = nova(4, {}, 100);
  igual(e.fase, 'jogando');
  igual(e.rodada.numero, 1);
});

console.log(`\n${ok} passaram, ${falhas} falharam\n`);
process.exit(falhas ? 1 : 0);
