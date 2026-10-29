// Export d'une page en Markdown.

function inline(node) {
  let out = '';
  for (const n of node.childNodes) {
    if (n.nodeType === Node.TEXT_NODE) {
      out += n.textContent.replace(/ /g, ' ');
      continue;
    }
    if (n.nodeType !== Node.ELEMENT_NODE) continue;
    const inner = inline(n);
    switch (n.tagName) {
      case 'B': out += inner.trim() ? `**${inner}**` : inner; break;
      case 'I': out += inner.trim() ? `*${inner}*` : inner; break;
      case 'S': out += inner.trim() ? `~~${inner}~~` : inner; break;
      case 'MARK': out += inner.trim() ? `==${inner}==` : inner; break;
      case 'CODE': out += `\`${inner}\``; break;
      case 'BR': out += '  \n'; break;
      case 'UL':
      case 'OL': break; // listes imbriquées traitées par list()
      default: out += inner;
    }
  }
  return out;
}

function list(el, depth = 0) {
  const lines = [];
  let i = 1;
  for (const li of el.children) {
    if (li.tagName !== 'LI') continue;
    const pad = '  '.repeat(depth);
    const bullet = el.tagName === 'OL' ? `${i++}.` : el.classList.contains('todo') ? `- [${li.dataset.done ? 'x' : ' '}]` : '-';
    lines.push(`${pad}${bullet} ${inline(li).trim()}`);
    for (const sub of li.children) if (sub.tagName === 'UL' || sub.tagName === 'OL') lines.push(list(sub, depth + 1));
  }
  return lines.join('\n');
}

export function toMarkdown(title, html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  const parts = [`# ${title || 'Sans titre'}`];
  for (const el of tpl.content.children) {
    const text = inline(el).trim();
    switch (el.tagName) {
      case 'H1': parts.push(`## ${text}`); break;
      case 'H2': parts.push(`### ${text}`); break;
      case 'H3': parts.push(`#### ${text}`); break;
      case 'UL':
      case 'OL': parts.push(list(el)); break;
      case 'BLOCKQUOTE': parts.push(text.split('\n').map((l) => `> ${l}`).join('\n')); break;
      case 'DIV': parts.push(`> ✦ ${text}`); break;
      case 'HR': parts.push('---'); break;
      default: if (text) parts.push(text);
    }
  }
  return `${parts.join('\n\n')}\n`;
}
