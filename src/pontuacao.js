/* Sistema de pontuação: soma da coleção atual, classificação e vencedores. */
(function (root) {
  const L = (root.Leilao = root.Leilao || {});

  L.pontuacao = {
    /* Só conta o que está na coleção: devorados e descartados ficam de fora por construção. */
    total(estado, jogador) {
      return jogador.colecao.reduce((s, id) => s + L.cartas.pontos(id, estado.config), 0);
    },

    /* Classificação com posições compartilhadas em caso de empate. */
    classificacao(estado) {
      const lista = estado.jogadores
        .map((j) => ({ id: j.id, nome: j.nome, pontos: L.pontuacao.total(estado, j), animais: j.colecao.length }))
        .sort((a, b) => b.pontos - a.pontos);
      let pos = 0;
      lista.forEach((x, i) => {
        if (i === 0 || x.pontos !== lista[i - 1].pontos) pos = i + 1;
        x.posicao = pos;
      });
      return lista;
    },

    /* Empate no topo = vencedores conjuntos (não há regra oficial de desempate). */
    vencedores(estado) {
      const c = L.pontuacao.classificacao(estado);
      return c.filter((x) => x.pontos === c[0].pontos).map((x) => x.id);
    },

    registrarRodada(estado) {
      for (const j of estado.jogadores) j.pontosPorRodada.push(L.pontuacao.total(estado, j));
    },
  };
})(globalThis);
