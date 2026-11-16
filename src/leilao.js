/* Sistema de leilão: hierarquia da rodada e determinação do vencedor. */
(function (root) {
  const L = (root.Leilao = root.Leilao || {});

  L.leilao = {
    /* Hierarquia da rodada (fraco -> forte): o naipe do iniciante vai para o topo, os outros mantêm a ordem. */
    hierarquia(naipeIniciante) {
      const base = L.REGRAS.hierarquiaPadrao;
      if (!base.includes(naipeIniciante)) throw new L.RegraViolada(`Naipe inválido: ${naipeIniciante}`);
      return base.filter((n) => n !== naipeIniciante).concat(naipeIniciante);
    },

    /* > 0 se a vence b. Valor numérico primeiro; naipe só desempata. */
    comparar(cartaA, cartaB, hierarquia) {
      const a = L.cartas.get(cartaA), b = L.cartas.get(cartaB);
      if (a.valor !== b.valor) return a.valor - b.valor;
      return hierarquia.indexOf(a.naipe) - hierarquia.indexOf(b.naipe);
    },

    /*
     * lances: { idJogador: idCarta }, ordem: ids na ordem da mesa a partir do iniciante.
     * Retorna { vencedor, hierarquia, classificacao: [{jogador, carta}], empateTotal }.
     */
    resolver(lances, ordem, config) {
      const inicianteCarta = lances[ordem[0]];
      const hierarquia = L.leilao.hierarquia(L.cartas.get(inicianteCarta).naipe);
      const lista = ordem.map((id, pos) => ({ jogador: id, carta: lances[id], pos }));
      let empateTotal = false;
      lista.sort((x, y) => {
        const c = L.leilao.comparar(y.carta, x.carta, hierarquia);
        if (c !== 0) return c;
        empateTotal = true;
        // PROVISÓRIO (empateTotal = 'mais-perto-do-iniciante')
        return x.pos - y.pos;
      });
      return {
        vencedor: lista[0].jogador,
        hierarquia,
        classificacao: lista.map(({ jogador, carta }) => ({ jogador, carta })),
        empateTotal,
        regraEmpate: empateTotal ? config.empateTotal : null,
      };
    },
  };
})(globalThis);
