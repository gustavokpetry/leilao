/* Jogadores automáticos (opcionais) — só decidem; quem valida é o motor. */
(function (root) {
  const L = (root.Leilao = root.Leilao || {});
  const forca = (id) => {
    const c = L.cartas.get(id);
    return c.valor * 4 + L.REGRAS.hierarquiaPadrao.indexOf(c.naipe);
  };
  const valorPremio = (e) => e.rodada.premio.reduce((s, id) => s + L.cartas.pontos(id, e.config), 0);

  L.bot = {
    escolherLance(e, idJogador, aleatorio = Math.random) {
      const mao = L.jogadores.get(e, idJogador).mao.slice().sort((a, b) => forca(a) - forca(b));
      const v = valorPremio(e);
      if (v <= 0) return mao[0];
      const alvo = Math.min(0.95, Math.max(0.05, v / 7 + (aleatorio() - 0.5) * 0.35));
      return mao[Math.round(alvo * (mao.length - 1))];
    },

    querReceita(e, idJogador, aleatorio = Math.random) {
      const v = valorPremio(e);
      if (v < 3) return false;
      const lider = L.pontuacao.classificacao(e)[0].id === e.rodada.resultado.vencedor;
      return aleatorio() < (v >= 5 ? 0.75 : lider ? 0.6 : 0.3);
    },
  };

  /* Armazenamento do estado da partida no navegador. */
  const CHAVE = 'leilao.partida.v1';
  const CHAVE_MESA = 'leilao.mesa.v1';
  const ls = () => { try { return root.localStorage || null; } catch (_) { return null; } };
  L.armazenamento = {
    salvar(estado) { try { ls() && ls().setItem(CHAVE, JSON.stringify(estado)); } catch (_) { /* cheio ou bloqueado */ } },
    carregar() {
      try {
        const e = JSON.parse((ls() && ls().getItem(CHAVE)) || 'null');
        return e && e.versao === 1 && e.fase === 'jogando' ? e : null;
      } catch (_) { return null; }
    },
    limpar() { try { ls() && ls().removeItem(CHAVE); } catch (_) {} },
    salvarMesa(m) { try { ls() && ls().setItem(CHAVE_MESA, JSON.stringify(m)); } catch (_) {} },
    carregarMesa() { try { return JSON.parse((ls() && ls().getItem(CHAVE_MESA)) || 'null'); } catch (_) { return null; } },
  };
})(globalThis);
