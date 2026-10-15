"""Construit la boutique en une page : vitrine, pages de vente, paiement Stripe/PayPal
et espace élève dont chaque cours est chiffré (AES-GCM) avec son code d'accès.

    python3 masterclasses/_commun/boutique/build_boutique.py boutique.html

Après paiement, Stripe ou PayPal redirige l'acheteur vers <URL boutique>#<NN>-<code> :
la page déchiffre alors le cours NN. Sans code, le cours reste illisible, même dans le code source.
"""
import base64, json, os, re, sys, pathlib
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

HERE = pathlib.Path(__file__).resolve().parent
COMMUN = HERE.parent
ROOT = COMMUN.parent
ITERATIONS = 150_000

sys.path.insert(0, str(COMMUN / 'apercu'))


def norm(md):
    lines = []
    for line in md.split('\n'):
        if 'Je commence pour 49' in line and len(line) < 70:
            lines.append('\n{{CTA}}\n')
            continue
        lines.append(line)
    md = '\n'.join(lines)
    # Les emplacements à compléter n'apparaissent pas aux acheteurs.
    md = re.sub(r'^.*\[(?:PRÉSENTATION|TÉMOIGNAGE)[^\]]*\].*$\n?', '', md, flags=re.M)
    md = re.sub(r'\[(CGV|Contact|Mentions légales)\]', r'\1', md)
    return md


def field(body, name):
    m = re.search(r'\*\*' + name + r'\s*:?\*\*\s*:?\s*(.+)', body)
    return m.group(1).strip() if m else None


def encrypt(text, code):
    salt, iv = os.urandom(16), os.urandom(12)
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=ITERATIONS)
    ct = AESGCM(kdf.derive(code.encode())).encrypt(iv, text.encode(), None)
    b64 = lambda b: base64.b64encode(b).decode()
    return {'salt': b64(salt), 'iv': b64(iv), 'ct': b64(ct)}


def build(out_path):
    codes = json.loads((COMMUN / 'codes-acces.json').read_text())
    links = json.loads((COMMUN / 'liens-paiement.json').read_text())
    cat = [l.split('\t') for l in (COMMUN / 'catalogue.tsv').read_text().strip().split('\n')[1:]]
    items = []
    for num, slug, titre, niche in cat:
        d = ROOT / f'{num}-{slug}'
        fiche = json.loads((d / 'fiche.json').read_text())
        pv = (d / 'page-de-vente.md').read_text()
        parts = re.split(r'^## (\d)\.\s*(.+)$', pv, flags=re.M)
        secs = {int(parts[i]): (parts[i + 1].strip(), parts[i + 2]) for i in range(1, len(parts), 3)}
        m = re.search(r'^>\s*(.+(?:\n>.*)*)', parts[0] + secs[1][1], flags=re.M)
        warn = re.sub(r'^>\s?', '', m.group(0), flags=re.M).strip() if m else None
        h = secs[1][1]
        title = field(h, 'Titre')
        if not title:
            m = re.search(r'^#{1,3}\s+(.+)$', h, flags=re.M)
            title = m.group(1).strip() if m else titre
        sub = field(h, 'Sous-titre')
        if not sub:
            for p in re.split(r'\n\s*\n', h):
                p = p.strip()
                if p and not p.startswith(('#', '>')) and 'Je commence' not in p and 'Paiement' not in p and p != '---':
                    sub = p.strip('*').strip()
                    break
        sections = [{'n': n, 'name': secs[n][0], 'md': norm(secs[n][1].replace('\n---', '\n'))}
                    for n in sorted(secs) if 1 < n < 9 and n != 7]
        grp = 'sport' if num in ('01', '02', '03', '04', '13', '14') else (
            'ia' if num in ('05', '06', '07', '08', '09', '10', '11', '12', '16') else 'niche')
        pay = links.get(num, {})
        items.append({
            'num': num, 'slug': slug, 'titre': titre, 'niche': niche, 'grp': grp,
            'modules': fiche.get('modules', []), 'hero': {'title': title, 'sub': sub}, 'warn': warn,
            'sections': sections, 'stripe': pay.get('stripe', '').strip(), 'paypal': pay.get('paypal', '').strip(),
            'cours': encrypt((d / 'formation.md').read_text(), codes[num]),
        })
    tpl = (HERE / 'boutique.template.html').read_text()
    data = json.dumps({'iterations': ITERATIONS, 'items': items}, ensure_ascii=False).replace('</', '<\\/')
    pathlib.Path(out_path).write_text(tpl.replace('/*__DATA__*/{}', data))
    print(f'{len(items)} masterclasses, {pathlib.Path(out_path).stat().st_size // 1024} Ko, '
          f'{sum(1 for i in items if i["stripe"] or i["paypal"])} avec un lien de paiement')


if __name__ == '__main__':
    build(sys.argv[1] if len(sys.argv) > 1 else 'boutique.html')
