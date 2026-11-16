"""
Gera dist/jogo-de-leilao.html: um único arquivo com CSS, JS e imagens embutidas.
Uso:  python3 ferramentas/gerar_arquivo_unico.py      (requer Pillow)
"""
import base64, io, os, re, json
from PIL import Image, ImageChops

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LARGURA = 360


def ler(rel):
    return open(os.path.join(RAIZ, rel), encoding='utf-8').read()


def imagens_do_catalogo():
    caminhos = re.findall(r'"imagem": "([^"]+)"', ler('data/catalogo.js'))
    mapa, unicas = {}, []  # unicas: (Image pequena para comparar, data uri)
    for rel in caminhos:
        im = Image.open(os.path.join(RAIZ, rel)).convert('RGB')
        im = im.resize((LARGURA, round(im.height * LARGURA / im.width)), Image.LANCZOS)
        mini = im.resize((48, 69))
        # Cartas visualmente idênticas compartilham a mesma imagem no arquivo único.
        # Dinheiro nunca é deduplicado (os números são pequenos demais na miniatura).
        repetida = None if '/dinheiro/' in rel else next(
            (uri for m, uri in unicas if max(b for _, b in ImageChops.difference(m, mini).getextrema()) < 18), None)
        if repetida:
            mapa[rel] = repetida
            continue
        buf = io.BytesIO()
        im.save(buf, 'WEBP', quality=72, method=6)
        uri = 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode()
        unicas.append((mini, uri))
        mapa[rel] = uri
    return mapa, len(unicas)


def main():
    html = ler('index.html')
    html = html.replace('<link rel="stylesheet" href="estilos.css">', '<style>\n' + ler('estilos.css') + '\n</style>')

    def inline(m):
        return '<script>\n' + ler(m.group(1)) + '\n</script>'
    html = re.sub(r'<script src="([^"]+)"></script>', inline, html)
    mapa, n = imagens_do_catalogo()
    imgs = '<script>globalThis.Leilao.IMAGENS = ' + json.dumps(mapa) + ';</script>'
    html = html.replace('<script>Leilao.iniciarInterface();</script>', imgs + '\n<script>Leilao.iniciarInterface();</script>')
    os.makedirs(os.path.join(RAIZ, 'dist'), exist_ok=True)
    destino = os.path.join(RAIZ, 'dist', 'jogo-de-leilao.html')
    open(destino, 'w', encoding='utf-8').write(html)
    print(f'{destino}: {os.path.getsize(destino) / 1e6:.1f} MB, {n} imagens únicas para {len(mapa)} cartas')


if __name__ == '__main__':
    main()
