/* Gerenciamento de jogadores: criação, distribuição e ordem da mesa. */
(function (root) {
  const L = (root.Leilao = root.Leilao || {});
  const { RegraViolada } = L;

  L.jogadores = {
    criar(lista) {
      const R = L.REGRAS;
      if (!Array.isArray(lista) || lista.length < R.jogadoresMin || lista.length > R.jogadoresMax)
        throw new RegraViolada(`O jogo aceita de ${R.jogadoresMin} a ${R.jogadoresMax} jogadores.`);
      const nomes = new Set();
      return lista.map((j, i) => {
        const nome = String(j.nome || '').trim() || `Jogador ${i + 1}`;
        if (nomes.has(nome.toLowerCase())) throw new RegraViolada(`Nome repetido: ${nome}`);
        nomes.add(nome.toLowerCase());
        return {
          id: `j${i + 1}`, nome, tipo: j.tipo === 'bot' ? 'bot' : 'humano',
          mao: [], receita: null, colecao: [], devorados: [], pontosPorRodada: [],
        };
      });
    },

    /* Distribui as 60 cartas de dinheiro igualmente e uma Receita para cada jogador. */
    distribuir(estado) {
      const n = estado.jogadores.length;
      const porJogador = L.REGRAS.cartasPorJogador[n];
      const dinheiro = L.rng.embaralhar(estado.rng, L.cartas.porCategoria('dinheiro').map((c) => c.id));
      if (dinheiro.length !== porJogador * n) throw new RegraViolada('Distribuição de dinheiro desigual.');
      const receitas = L.rng.embaralhar(estado.rng, L.cartas.porCategoria('receita').map((c) => c.id));
      estado.jogadores.forEach((j, i) => {
        j.mao = dinheiro.slice(i * porJogador, (i + 1) * porJogador).sort(L.cartas.ordemNaMao);
        j.receita = receitas[i];
      });
      // Receitas não distribuídas (partidas com menos de 6) ficam fora do jogo.
      estado.foraDoJogo.receitas = receitas.slice(n);
      return porJogador;
    },

    get(estado, id) {
      const j = estado.jogadores.find((p) => p.id === id);
      if (!j) throw new RegraViolada(`Jogador desconhecido: ${id}`);
      return j;
    },
    indice(estado, id) { return estado.jogadores.findIndex((p) => p.id === id); },

    /* Ordem da mesa começando pelo iniciante da rodada. */
    ordemDaMesa(estado, inicianteIdx) {
      const n = estado.jogadores.length;
      return Array.from({ length: n }, (_, k) => estado.jogadores[(inicianteIdx + k) % n].id);
    },
  };
})(globalThis);
