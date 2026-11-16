/* Efeitos especiais: Chupacabra e Receita Federal. */
(function (root) {
  const L = (root.Leilao = root.Leilao || {});

  L.efeitos = {
    /*
     * Chupacabra: antes de entrar na coleção, devora o animal de maior pontuação do jogador.
     * Empate entre os maiores: sorteio. Coleção vazia: nada acontece.
     * Retorna o id devorado ou null.
     */
    chupacabra(estado, jogador) {
      const cfg = estado.config;
      const alvos = jogador.colecao.filter(
        (id) => cfg.chupacabraDevoraChupacabra === 'sim' || !L.cartas.ehChupacabra(id),
      );
      if (alvos.length === 0) return null;
      const max = Math.max(...alvos.map((id) => L.cartas.pontos(id, cfg)));
      const empatados = alvos.filter((id) => L.cartas.pontos(id, cfg) === max);
      const devorado = empatados.length === 1 ? empatados[0] : empatados[L.rng.inteiro(estado.rng, empatados.length)];
      jogador.colecao.splice(jogador.colecao.indexOf(devorado), 1);
      jogador.devorados.push(devorado);
      return { devorado, empatados: empatados.length };
    },

    /* Quem pode usar a Receita nesta rodada: quem ainda tem a carta e não é o vencedor. */
    elegiveisReceita(estado) {
      const r = estado.rodada;
      if (r.receita) return [];
      return r.ordem.filter((id) => id !== r.resultado.vencedor && L.jogadores.get(estado, id).receita);
    },

    /* Aplica a Receita de um jogador: descarta a carta e devolve o efeito ('anular' | 'prorrogar'). */
    usarReceita(estado, idJogador) {
      const r = estado.rodada;
      if (r.fase !== 'receita') throw new L.RegraViolada('A Receita só pode ser usada depois da revelação dos lances.');
      if (r.receita) throw new L.RegraViolada('Já foi usada uma Receita Federal nesta rodada.');
      const j = L.jogadores.get(estado, idJogador);
      if (!j.receita) throw new L.RegraViolada(`${j.nome} não tem mais Receita Federal.`);
      if (idJogador === r.resultado.vencedor) throw new L.RegraViolada('O vencedor não pode usar a Receita contra si mesmo.');
      const carta = j.receita;
      j.receita = null;
      estado.descarte.receitas.push(carta);
      const efeito = L.cartas.efeitoReceita(carta, estado.config);
      r.receita = { jogador: idJogador, carta, efeito };
      return r.receita;
    },
  };
})(globalThis);
