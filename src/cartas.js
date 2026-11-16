/* Gerenciamento de cartas: catálogo, validação, baralhos e sorteio determinístico. */
(function (root) {
  const L = (root.Leilao = root.Leilao || {});

  class RegraViolada extends Error {
    constructor(msg) { super(msg); this.name = 'RegraViolada'; }
  }
  L.RegraViolada = RegraViolada;

  // Gerador mulberry32: o estado fica salvo na partida, então tudo é reprodutível.
  L.rng = {
    proximo(estado) {
      let t = (estado.semente = (estado.semente + 0x6d2b79f5) >>> 0);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    inteiro(estado, max) { return Math.floor(L.rng.proximo(estado) * max); },
    embaralhar(estado, lista) {
      const a = lista.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = L.rng.inteiro(estado, i + 1);
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
  };

  let indice = null;
  L.cartas = {
    indice() {
      if (!indice) {
        indice = {};
        for (const c of L.CATALOGO) indice[c.id] = c;
      }
      return indice;
    },
    get(id) {
      const c = L.cartas.indice()[id];
      if (!c) throw new RegraViolada(`Carta desconhecida: ${id}`);
      return c;
    },
    porCategoria(cat) { return L.CATALOGO.filter((c) => c.categoria === cat); },
    ehChupacabra(id) { return L.cartas.get(id).efeito === 'devorar-maior'; },

    pontos(id, config) {
      const c = L.cartas.get(id);
      if (c.efeito === 'devorar-maior' && config && config.pontosChupacabra === 'zero') return 0;
      return c.pontos || 0;
    },

    efeitoReceita(id, config) {
      if (config && config.efeitoReceita === 'sempre-anular') return 'anular';
      return L.cartas.get(id).efeito;
    },

    /* Confere se o catálogo tem exatamente o que as regras exigem. Retorna lista de problemas. */
    validarCatalogo() {
      const p = [];
      const T = L.REGRAS.totais;
      const ids = new Set();
      for (const c of L.CATALOGO) {
        if (ids.has(c.id)) p.push(`ID repetido: ${c.id}`);
        ids.add(c.id);
        if (!c.imagem) p.push(`${c.id} sem imagem`);
      }
      const din = L.cartas.porCategoria('dinheiro');
      if (din.length !== T.dinheiro) p.push(`Esperado ${T.dinheiro} cartas de dinheiro, há ${din.length}`);
      for (const n of L.REGRAS.hierarquiaPadrao) {
        const vals = din.filter((c) => c.naipe === n).map((c) => c.valor).sort((a, b) => a - b);
        if (vals.join() !== Array.from({ length: 15 }, (_, i) => i + 1).join()) p.push(`Naipe ${n} não tem 1 a 15`);
      }
      const ani = L.cartas.porCategoria('animal');
      if (ani.length !== T.animal) p.push(`Esperado ${T.animal} animais, há ${ani.length}`);
      for (const a of ani) if (typeof a.pontos !== 'number') p.push(`${a.id} sem pontuação (pendente de configuração)`);
      const ch = ani.filter((a) => a.efeito === 'devorar-maior').length;
      if (ch !== T.chupacabra) p.push(`Esperado ${T.chupacabra} Chupacabras, há ${ch}`);
      const rec = L.cartas.porCategoria('receita');
      if (rec.length !== T.receita) p.push(`Esperado ${T.receita} Receitas, há ${rec.length}`);
      for (const r of rec) if (!['anular', 'prorrogar'].includes(r.efeito)) p.push(`${r.id} com efeito desconhecido`);
      return p;
    },

    /* Força relativa padrão, só para ordenar a mão na tela. */
    ordemNaMao(a, b) {
      const ca = L.cartas.get(a), cb = L.cartas.get(b);
      const h = L.REGRAS.hierarquiaPadrao;
      return h.indexOf(ca.naipe) - h.indexOf(cb.naipe) || ca.valor - cb.valor;
    },
  };
})(globalThis);
