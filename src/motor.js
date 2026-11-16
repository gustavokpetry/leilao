/*
 * Motor do jogo: máquina de estados pura. Cada ação recebe um estado e devolve um NOVO estado
 * (o original nunca é alterado). Toda regra é validada aqui, nunca na interface.
 *
 * Fases da rodada: 'lances' -> 'receita' (se alguém puder usar) -> 'resolvida'
 * Fases da partida: 'jogando' -> 'encerrada'
 */
(function (root) {
  const L = (root.Leilao = root.Leilao || {});
  const { RegraViolada } = L;
  const nomeDe = (e, id) => L.jogadores.get(e, id).nome;
  const descreveCarta = (id) => {
    const c = L.cartas.get(id);
    return c.categoria === 'dinheiro' ? `${L.REGRAS.naipes[c.naipe].simbolo} ${c.valor}` : c.nome;
  };

  function registrar(e, tipo, texto, dados) {
    e.log.push(Object.assign({ rodada: e.rodada ? e.rodada.numero : 0, tipo, texto }, dados || {}));
  }

  function exigirJogo(e) {
    if (e.fase !== 'jogando') throw new RegraViolada('A partida já terminou.');
  }

  function abrirRodada(e, inicianteIdx) {
    const numero = e.rodada ? e.rodada.numero + 1 : 1;
    const premio = e.acumulado.splice(0);
    if (e.baralhoAnimais.length) premio.push(e.baralhoAnimais.shift());
    e.rodada = {
      numero, inicianteIdx, ordem: L.jogadores.ordemDaMesa(e, inicianteIdx), premio,
      lances: {}, fase: 'lances', resultado: null, receita: null, intencoes: {}, desfecho: null,
    };
    const extra = premio.length > 1 ? ` (acumulado: ${premio.length} animais)` : '';
    registrar(e, 'rodada', `Rodada ${numero}: ${premio.map(descreveCarta).join(' + ') || 'sem prêmio'}${extra}. ${nomeDe(e, e.rodada.ordem[0])} inicia.`);
  }

  function resolverRodada(e) {
    const r = e.rodada;
    const venc = r.resultado.vencedor;
    if (r.receita) {
      const quem = nomeDe(e, r.receita.jogador);
      if (r.receita.efeito === 'prorrogar') {
        e.acumulado.push(...r.premio);
        r.desfecho = { tipo: 'prorrogado', animais: r.premio.slice() };
        registrar(e, 'receita', `${quem} usou a Receita Federal contra ${nomeDe(e, venc)}: leilão prorrogado, ${r.premio.map(descreveCarta).join(' + ')} vai para a próxima rodada.`, { jogador: r.receita.jogador, alvo: venc, efeito: 'prorrogar' });
      } else {
        e.descarte.animais.push(...r.premio);
        r.desfecho = { tipo: 'anulado', animais: r.premio.slice() };
        registrar(e, 'receita', `${quem} usou a Receita Federal contra ${nomeDe(e, venc)}: leilão anulado, ${r.premio.map(descreveCarta).join(' + ')} ${r.premio.length > 1 ? 'descartados' : 'descartado'}.`, { jogador: r.receita.jogador, alvo: venc, efeito: 'anular' });
      }
    } else {
      const j = L.jogadores.get(e, venc);
      const devoracoes = [];
      // Animais acumulados entram na ordem em que foram leiloados (provisório).
      for (const id of r.premio) {
        if (L.cartas.ehChupacabra(id)) {
          const d = L.efeitos.chupacabra(e, j);
          if (d) {
            devoracoes.push(d.devorado);
            const sorteio = d.empatados > 1 ? ` (sorteado entre ${d.empatados} empatados)` : '';
            registrar(e, 'chupacabra', `O Chupacabra devorou ${descreveCarta(d.devorado)} de ${j.nome}${sorteio}.`, { jogador: venc, devorado: d.devorado });
          } else {
            registrar(e, 'chupacabra', `O Chupacabra chegou à coleção vazia de ${j.nome}: nada foi devorado.`, { jogador: venc, devorado: null });
          }
        }
        j.colecao.push(id);
      }
      r.desfecho = { tipo: 'conquista', jogador: venc, animais: r.premio.slice(), devorados: devoracoes };
      if (r.premio.length) registrar(e, 'conquista', `${j.nome} arrematou ${r.premio.map(descreveCarta).join(' + ')}.`, { jogador: venc });
    }
    r.fase = 'resolvida';
    L.pontuacao.registrarRodada(e);
  }

  function talvezResolverIntencoes(e) {
    const r = e.rodada;
    const elegiveis = L.efeitos.elegiveisReceita(e);
    if (!elegiveis.every((id) => id in r.intencoes)) return;
    const interessados = elegiveis.filter((id) => r.intencoes[id]);
    if (interessados.length) {
      const escolhido = e.config.prioridadeReceita === 'aleatorio'
        ? interessados[L.rng.inteiro(e.rng, interessados.length)]
        : interessados[0]; // elegiveis já está na ordem da mesa
      if (interessados.length > 1)
        registrar(e, 'info', `${interessados.length} jogadores quiseram usar a Receita; vale a regra provisória de prioridade.`);
      L.efeitos.usarReceita(e, escolhido);
    }
    resolverRodada(e);
  }

  function encerrar(e) {
    if (e.acumulado.length) {
      registrar(e, 'descarte', `Fim da partida com ${e.acumulado.map(descreveCarta).join(' + ')} acumulado: ninguém recebe.`);
      e.descarte.animais.push(...e.acumulado.splice(0));
    }
    e.fase = 'encerrada';
    e.final = { classificacao: L.pontuacao.classificacao(e), vencedores: L.pontuacao.vencedores(e) };
    const nomes = e.final.vencedores.map((id) => nomeDe(e, id));
    registrar(e, 'fim', nomes.length > 1 ? `Empate no topo: ${nomes.join(' e ')} vencem juntos.` : `${nomes[0]} vence a partida.`);
  }

  L.motor = {
    novaPartida({ jogadores, config, semente }) {
      const problemas = L.cartas.validarCatalogo();
      if (problemas.length) throw new RegraViolada('Catálogo inválido: ' + problemas.join('; '));
      const cfg = Object.assign(L.configPadrao(), config || {});
      for (const k in L.PROVISORIAS)
        if (!(cfg[k] in L.PROVISORIAS[k].opcoes)) throw new RegraViolada(`Opção inválida para ${k}: ${cfg[k]}`);
      const e = {
        versao: 1, fase: 'jogando', config: cfg,
        rng: { semente: (semente ?? Math.floor(Math.random() * 2 ** 32)) >>> 0 },
        jogadores: L.jogadores.criar(jogadores),
        baralhoAnimais: [], acumulado: [], rodada: null, final: null, log: [],
        descarte: { dinheiro: [], animais: [], receitas: [] }, foraDoJogo: { receitas: [] },
      };
      e.totalRodadas = L.jogadores.distribuir(e);
      e.baralhoAnimais = L.rng.embaralhar(e.rng, L.cartas.porCategoria('animal').map((c) => c.id));
      registrar(e, 'inicio', `Partida com ${e.jogadores.length} jogadores, ${e.totalRodadas} cartas de dinheiro e 1 Receita Federal para cada.`);
      const primeiro = cfg.primeiroIniciante === 'jogador-1' ? 0 : L.rng.inteiro(e.rng, e.jogadores.length);
      abrirRodada(e, primeiro);
      return e;
    },

    lance(estado, idJogador, idCarta) {
      const e = structuredClone(estado);
      exigirJogo(e);
      const r = e.rodada;
      if (r.fase !== 'lances') throw new RegraViolada('Os lances desta rodada já foram revelados.');
      const j = L.jogadores.get(e, idJogador);
      if (idJogador in r.lances) throw new RegraViolada(`${j.nome} já fez seu lance nesta rodada.`);
      if (L.cartas.get(idCarta).categoria !== 'dinheiro') throw new RegraViolada('Só cartas de dinheiro valem como lance.');
      const pos = j.mao.indexOf(idCarta);
      if (pos === -1) throw new RegraViolada(`${descreveCarta(idCarta)} não está na mão de ${j.nome}.`);
      j.mao.splice(pos, 1);
      r.lances[idJogador] = idCarta;
      registrar(e, 'lance', `${j.nome} fez um lance.`, { jogador: idJogador });
      return e;
    },

    faltamLances(estado) {
      return estado.rodada.ordem.filter((id) => !(id in estado.rodada.lances));
    },

    revelar(estado) {
      const e = structuredClone(estado);
      exigirJogo(e);
      const r = e.rodada;
      if (r.fase !== 'lances') throw new RegraViolada('Os lances já foram revelados.');
      const faltam = L.motor.faltamLances(e);
      if (faltam.length) throw new RegraViolada(`Ainda faltam lances: ${faltam.map((id) => nomeDe(e, id)).join(', ')}.`);
      r.resultado = L.leilao.resolver(r.lances, r.ordem, e.config);
      e.descarte.dinheiro.push(...r.ordem.map((id) => r.lances[id]));
      const forte = L.REGRAS.naipes[r.resultado.hierarquia[3]].nome;
      registrar(e, 'revelacao', `Lances: ${r.ordem.map((id) => `${nomeDe(e, id)} ${descreveCarta(r.lances[id])}`).join(', ')}. Naipe mais forte: ${forte}.`);
      registrar(e, 'vencedor', `${nomeDe(e, r.resultado.vencedor)} deu o maior lance (${descreveCarta(r.lances[r.resultado.vencedor])}).`, { jogador: r.resultado.vencedor });
      if (L.efeitos.elegiveisReceita(e).length && r.premio.length) r.fase = 'receita';
      else resolverRodada(e);
      return e;
    },

    elegiveisReceita(estado) {
      return estado.rodada.fase === 'receita' ? L.efeitos.elegiveisReceita(estado) : [];
    },

    /* Modo público: o primeiro que acionar usa. */
    usarReceita(estado, idJogador) {
      const e = structuredClone(estado);
      exigirJogo(e);
      L.efeitos.usarReceita(e, idJogador);
      resolverRodada(e);
      return e;
    },

    /* Modo público: ninguém quis usar. */
    dispensarReceita(estado) {
      const e = structuredClone(estado);
      exigirJogo(e);
      if (e.rodada.fase !== 'receita') throw new RegraViolada('Não há decisão de Receita pendente.');
      resolverRodada(e);
      return e;
    },

    /* Modo secreto: cada elegível declara se quer usar; resolve quando todos declararem. */
    intencaoReceita(estado, idJogador, quer) {
      const e = structuredClone(estado);
      exigirJogo(e);
      const r = e.rodada;
      if (r.fase !== 'receita') throw new RegraViolada('Não há decisão de Receita pendente.');
      if (!L.efeitos.elegiveisReceita(e).includes(idJogador)) throw new RegraViolada(`${nomeDe(e, idJogador)} não pode usar a Receita nesta rodada.`);
      if (idJogador in r.intencoes) throw new RegraViolada(`${nomeDe(e, idJogador)} já decidiu.`);
      r.intencoes[idJogador] = !!quer;
      talvezResolverIntencoes(e);
      return e;
    },

    ehUltimaRodada(estado) {
      return estado.jogadores.every((j) => j.mao.length === 0);
    },

    proximaRodada(estado) {
      const e = structuredClone(estado);
      exigirJogo(e);
      const r = e.rodada;
      if (r.fase !== 'resolvida') throw new RegraViolada('A rodada atual ainda não terminou.');
      if (L.motor.ehUltimaRodada(e)) {
        encerrar(e);
        return e;
      }
      const n = e.jogadores.length;
      let idx = (r.inicianteIdx + 1) % n;
      if (e.config.rotacaoIniciante === 'vencedor-anterior' && r.desfecho.tipo === 'conquista')
        idx = L.jogadores.indice(e, r.desfecho.jogador);
      abrirRodada(e, idx);
      return e;
    },
  };
})(globalThis);
