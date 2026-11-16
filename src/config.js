/* Regras oficiais (fixas) e configurações PROVISÓRIAS (decisões ainda pendentes). */
(function (root) {
  const L = (root.Leilao = root.Leilao || {});

  L.REGRAS = {
    jogadoresMin: 3,
    jogadoresMax: 6,
    cartasPorJogador: { 3: 20, 4: 15, 5: 12, 6: 10 },
    // Hierarquia padrão, do mais fraco para o mais forte.
    hierarquiaPadrao: ['kwanza', 'real', 'dolar', 'euro'],
    naipes: {
      kwanza: { nome: 'Kwanza', simbolo: 'Kz' },
      real: { nome: 'Real', simbolo: 'R$' },
      dolar: { nome: 'Dólar', simbolo: 'US$' },
      euro: { nome: 'Euro', simbolo: '€' },
    },
    receitasPorRodada: 1,
    totais: { dinheiro: 60, animal: 74, receita: 6, chupacabra: 2 },
  };

  /*
   * CONFIGURAÇÕES PROVISÓRIAS — não são regras oficiais.
   * Cada chave lista as opções aceitas; a primeira opção de "opcoes" é só um rótulo, o padrão está em "padrao".
   */
  L.PROVISORIAS = {
    primeiroIniciante: {
      titulo: 'Quem inicia a 1ª rodada',
      pendencia: 'Rotação do jogador inicial',
      padrao: 'aleatorio',
      opcoes: { aleatorio: 'Sorteio', 'jogador-1': 'Primeiro jogador da lista' },
    },
    rotacaoIniciante: {
      titulo: 'Quem inicia as rodadas seguintes',
      pendencia: 'Rotação do jogador inicial',
      padrao: 'proximo-da-lista',
      opcoes: {
        'proximo-da-lista': 'Passa para o próximo jogador da lista',
        'vencedor-anterior': 'Quem venceu o leilão anterior (sem vencedor: próximo da lista)',
      },
    },
    empateTotal: {
      titulo: 'Empate em valor e naipe',
      pendencia: 'Empate completo',
      padrao: 'mais-perto-do-iniciante',
      opcoes: { 'mais-perto-do-iniciante': 'Vence quem está mais perto do iniciante na ordem da mesa' },
      observacao: 'Com 60 cartas únicas (um valor por naipe) esse empate não ocorre; a opção existe só por segurança.',
    },
    momentoReceita: {
      titulo: 'Como a Receita Federal é usada',
      pendencia: 'Momento de revelar a Receita Federal',
      padrao: 'publico',
      opcoes: {
        publico: 'Em público, após a revelação: o primeiro que acionar usa',
        secreto: 'Em segredo: cada um decide sozinho e a decisão é revelada depois',
      },
    },
    prioridadeReceita: {
      titulo: 'Se mais de um quiser usar a Receita (modo secreto)',
      pendencia: 'Uso simultâneo da Receita Federal',
      padrao: 'ordem-da-mesa',
      opcoes: {
        'ordem-da-mesa': 'Primeiro na ordem da mesa a partir do iniciante',
        aleatorio: 'Sorteio entre os interessados',
      },
    },
    efeitoReceita: {
      titulo: 'Efeito da Receita Federal',
      pendencia: 'Conflito entre cartas e documento de regras',
      padrao: 'conforme-carta',
      opcoes: {
        'conforme-carta': 'Conforme o texto de cada carta (3 anulam, 3 prorrogam)',
        'sempre-anular': 'Todas anulam, como no documento de regras',
      },
    },
    pontosChupacabra: {
      titulo: 'Pontos do Chupacabra',
      pendencia: 'A carta mostra -5; o documento não cita',
      padrao: 'conforme-carta',
      opcoes: { 'conforme-carta': 'Conforme a carta (-5)', zero: 'Zero pontos' },
    },
    chupacabraDevoraChupacabra: {
      titulo: 'Chupacabra pode devorar outro Chupacabra',
      pendencia: 'Não definido nas regras',
      padrao: 'nao',
      opcoes: { nao: 'Não: só devora animais comuns', sim: 'Sim: qualquer animal de maior pontuação' },
    },
  };

  L.configPadrao = function () {
    const c = {};
    for (const k in L.PROVISORIAS) c[k] = L.PROVISORIAS[k].padrao;
    return c;
  };
})(globalThis);
