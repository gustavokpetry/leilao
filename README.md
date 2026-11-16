# Jogo de Leilão — versão digital

Jogo de leilão para 3 a 6 jogadores no mesmo aparelho (cada pessoa vê a própria mão em sua vez). Cada vaga pode ser uma pessoa ou um bot.

## Como executar

- **Mais simples:** abra `dist/jogo-de-leilao.html` no navegador. É um arquivo único com tudo embutido; funciona offline (só as fontes vêm da internet, com alternativa local).
- **Versão modular (para editar):** abra `index.html` direto no navegador. Não precisa de servidor nem instalação.
- **Testes das regras:** `node testes/testes.js` (Node 17 ou mais novo).
- **Regerar o arquivo único** depois de editar: `python3 ferramentas/gerar_arquivo_unico.py` (precisa de Pillow).

A partida em andamento fica salva no navegador e pode ser retomada na tela inicial.

## Onde ficam as cartas

```
assets/cartas/dinheiro/  din-<naipe>-<valor>.webp   (60)
assets/cartas/animais/   ani-<número>.webp           (74)
assets/cartas/receita/   rec-<número>.webp           (6)
data/catalogo.js         dados de todas as 140 cartas
```

Para **substituir uma arte**, troque o arquivo (ou aponte o campo `imagem` para outro). Para **corrigir ou adicionar uma carta**, edite `data/catalogo.js`; a lógica do jogo não precisa mudar. Ao abrir, o jogo valida o catálogo (60 de dinheiro com 1 a 15 em cada naipe, 74 animais, 2 Chupacabras, 6 Receitas) e mostra o que estiver errado.

As imagens em `assets` são as artes originais redimensionadas para 480 px de largura (WebP). Se quiser usar os PNGs originais, coloque-os nas mesmas pastas e ajuste a extensão no catálogo.

## Estrutura

| Arquivo | Responsabilidade |
|---|---|
| `src/config.js` | Regras fixas e configurações provisórias |
| `src/cartas.js` | Catálogo, validação, embaralhamento (sorteio reprodutível) |
| `src/jogadores.js` | Criação de jogadores, distribuição, ordem da mesa |
| `src/leilao.js` | Hierarquia dos naipes e vencedor do leilão |
| `src/efeitos.js` | Chupacabra e Receita Federal |
| `src/pontuacao.js` | Pontos, classificação e vencedores |
| `src/motor.js` | Máquina de estados da partida e todas as validações |
| `src/bot.js` | Decisões dos bots e salvamento no navegador |
| `src/interface.js` + `estilos.css` | Apenas desenho e cliques; nenhuma regra |

## Configurações provisórias (não são regras oficiais)

Todas podem ser trocadas na tela inicial em "Regras provisórias" ou em `src/config.js`.

| Pendência | Padrão provisório | Alternativa |
|---|---|---|
| Quem inicia a 1ª rodada | Sorteio | Primeiro da lista |
| Quem inicia as seguintes | Próximo jogador da lista | Vencedor do leilão anterior |
| Empate em valor e naipe | Mais perto do iniciante | — (não acontece com 60 cartas únicas) |
| Momento da Receita | Público, após a revelação: vale quem acionar primeiro | Secreto: cada um decide sozinho |
| Dois querem a Receita (modo secreto) | Ordem da mesa a partir do iniciante | Sorteio |
| Efeito da Receita | Conforme o texto da carta | Todas anulam (documento) |
| Pontos do Chupacabra | -5, como na carta | Zero |
| Chupacabra devora Chupacabra | Não | Sim |

Também provisório, sem opção na tela: animais acumulados entram na coleção na ordem em que foram leiloados; acumulado na última rodada é descartado; Receitas não distribuídas (menos de 6 jogadores) ficam fora do jogo; o vencedor não pode usar a Receita contra si mesmo.

## Divergências encontradas nas cartas

1. **Receita Federal:** as cartas 01–03 dizem "Prorroga o leilão! … o item leiloado é acumulado para a próxima rodada"; as 04–06 dizem "Anula o leilão!". O documento de regras só descreve a anulação.
2. **Chupacabra:** a carta mostra **-5 pontos**; o documento não cita pontuação.
3. **Nomes de arquivo errados** (os pontos e nomes do catálogo seguem a imagem): `cabra_+2pts_22` é um gato +2; `cabra_+2pts_23` é cabra **+1**; `cao_+2pts_18` é coelho **+1**; `cao_+2pts_19/20/21` parecem gatos; `gamba_ou_mofeta_49` parece um husky; `sapo_37` é ganso; `porquinho_da_india_40` é sapo; `ovelha_+5pts_93` parece um carneiro; `animal_indefinido_96` é um cavalo. Essas cartas estão com `revisar: true` no catálogo.
