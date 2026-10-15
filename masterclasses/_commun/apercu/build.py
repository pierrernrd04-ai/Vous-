import json, re, sys, pathlib
root = pathlib.Path('/home/user/Vous-/masterclasses')
out = pathlib.Path(sys.argv[1]); tpl = pathlib.Path(sys.argv[2]).read_text()
CTA = re.compile(r'^\s*(\*\*)?\s*(\*\*Bouton\s*:?\*\*\s*:?|\*\*Bouton\*\*\s*:)?\s*\[?\s*Je commence pour 49\s*€\s*\]?\s*(\*\*)?\s*$', re.I)
def norm(md):
    lines=[]
    for l in md.split('\n'):
        if 'Je commence pour 49' in l and len(l) < 70: lines.append('\n{{CTA}}\n'); continue
        lines.append(l)
    md='\n'.join(lines)
    md=re.sub(r'\[((?:PRÉSENTATION|TÉMOIGNAGE)[^\]]*)\]', r'<mark class="ph">\1</mark>', md)
    md=re.sub(r'\[(CGV|Contact|Mentions légales)\]', r'<span class="lk">\1</span>', md)
    return md
def field(body, name):
    m=re.search(r'\*\*'+name+r'\s*:?\*\*\s*:?\s*(.+)', body)
    return m.group(1).strip() if m else None
cat = [l.split('\t') for l in (root/'_commun/catalogue.tsv').read_text().strip().split('\n')[1:]]
items=[]
for num, slug, titre, niche in cat:
    d = root/f'{num}-{slug}'
    fiche = json.loads((d/'fiche.json').read_text())
    pv = (d/'page-de-vente.md').read_text()
    parts = re.split(r'^## (\d)\.\s*(.+)$', pv, flags=re.M)
    pre = parts[0]; secs={}
    for i in range(1, len(parts), 3): secs[int(parts[i])] = (parts[i+1].strip(), parts[i+2])
    warn = None
    allwarn = pre + secs[1][1]
    m = re.search(r'^>\s*(.+(?:\n>.*)*)', allwarn, flags=re.M)
    if m: warn = re.sub(r'^>\s?', '', m.group(0), flags=re.M).strip()
    h = secs[1][1]
    title = field(h,'Titre')
    if not title:
        m = re.search(r'^#{1,3}\s+(.+)$', h, flags=re.M); title = m.group(1).strip() if m else titre
    sub = field(h,'Sous-titre')
    if not sub:
        for p in re.split(r'\n\s*\n', h):
            p=p.strip()
            if not p or p.startswith('#') or p.startswith('>') or 'Je commence' in p or 'Paiement' in p or p=='---': continue
            sub = p.strip('*').strip(); break
    rea = field(h,'Réassurance') or 'Accès immédiat · Accès à vie · Paiement sécurisé'
    sections = [{'n':n,'name':secs[n][0],'md':norm(secs[n][1].replace('\n---','\n'))} for n in sorted(secs) if n>1]
    grp = 'sport' if num in ('01','02','03','04','13','14') else ('ia' if num in ('05','06','07','08','09','10','11','12','16') else 'niche')
    items.append({'num':num,'slug':slug,'titre':titre,'niche':niche,'grp':grp,'sous_titre':fiche.get('sous_titre',''),
        'modules':fiche.get('modules',[]),'hero':{'title':title,'sub':sub,'rea':rea},'warn':warn,'sections':sections,
        'cours':norm((d/'formation.md').read_text()),'emails':norm((d/'emails.md').read_text())})
data = json.dumps(items, ensure_ascii=False).replace('</','<\\/')
out.write_text(tpl.replace('/*__DATA__*/[]', data))
print(len(items), out.stat().st_size)
