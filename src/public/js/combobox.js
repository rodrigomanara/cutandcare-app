// Minimal searchable single-select combobox (ARIA 1.2 combobox pattern).
//
// createCombobox(mount, { onSearch, onSelect, placeholder })
//   onSearch(term)  -> Promise<[{ id, label }]>
//   onSelect(item)  -> void          (item is null when cleared)
//
// Returns { setValue({id,label}), clear(), focus() }.

let idSeq = 0;

export function createCombobox(mount, { onSearch, onSelect, placeholder = 'Search…' } = {}) {
  const uid = `cbx-${++idSeq}`;
  mount.classList.add('combobox');
  mount.innerHTML = `
    <input type="text" class="combobox-input" role="combobox" aria-expanded="false"
           aria-autocomplete="list" aria-controls="${uid}-list" autocomplete="off"
           spellcheck="false" placeholder="${placeholder}" />
    <button type="button" class="combobox-clear" aria-label="Clear" hidden>&times;</button>
    <ul id="${uid}-list" class="combobox-list" role="listbox" hidden></ul>`;

  const input = mount.querySelector('.combobox-input');
  const clearBtn = mount.querySelector('.combobox-clear');
  const list = mount.querySelector('.combobox-list');

  let items = [];
  let active = -1;
  let selected = null;
  let seq = 0;
  let debounce;

  function open() {
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }
  function close() {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    active = -1;
  }

  function renderList() {
    if (!items.length) {
      list.innerHTML = `<li class="combobox-empty" role="presentation">No matches</li>`;
      open();
      return;
    }
    list.innerHTML = items
      .map(
        (it, i) =>
          `<li class="combobox-option" role="option" id="${uid}-opt-${i}" ` +
          `aria-selected="${i === active}">${escapeHtml(it.label)}</li>`,
      )
      .join('');
    open();
  }

  function setActive(i) {
    active = (i + items.length) % items.length;
    for (const [idx, el] of [...list.children].entries()) {
      el.setAttribute('aria-selected', String(idx === active));
    }
    list.children[active]?.scrollIntoView({ block: 'nearest' });
    input.setAttribute('aria-activedescendant', `${uid}-opt-${active}`);
  }

  function choose(i) {
    const item = items[i];
    if (!item) return;
    selected = item;
    input.value = item.label;
    clearBtn.hidden = false;
    close();
    onSelect?.(item);
  }

  function clear({ silent = false } = {}) {
    selected = null;
    input.value = '';
    items = [];
    clearBtn.hidden = true;
    close();
    if (!silent) onSelect?.(null);
  }

  input.addEventListener('input', () => {
    const term = input.value.trim();
    if (selected && input.value !== selected.label) {
      selected = null;
      onSelect?.(null);
    }
    clearBtn.hidden = input.value === '';
    clearTimeout(debounce);
    if (!term) {
      items = [];
      close();
      return;
    }
    const mine = ++seq;
    debounce = setTimeout(async () => {
      list.innerHTML = `<li class="combobox-empty" role="presentation">Searching…</li>`;
      open();
      try {
        const results = await onSearch(term);
        if (mine !== seq) return; // a newer query superseded this one
        items = results || [];
        active = -1;
        renderList();
      } catch {
        if (mine !== seq) return;
        list.innerHTML = `<li class="combobox-empty" role="presentation">Search failed</li>`;
      }
    }, 250);
  });

  input.addEventListener('keydown', (e) => {
    if (list.hidden && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      if (items.length) renderList();
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActive(active + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActive(active - 1);
        break;
      case 'Enter':
        if (!list.hidden && active >= 0) {
          e.preventDefault();
          choose(active);
        }
        break;
      case 'Escape':
        close();
        break;
      default:
        break;
    }
  });

  list.addEventListener('mousedown', (e) => {
    const li = e.target.closest('.combobox-option');
    if (!li) return;
    e.preventDefault();
    choose([...list.children].indexOf(li));
  });

  clearBtn.addEventListener('click', () => {
    clear();
    input.focus();
  });

  document.addEventListener('click', (e) => {
    if (!mount.contains(e.target)) close();
  });

  return {
    setValue(item) {
      selected = item;
      input.value = item?.label ?? '';
      clearBtn.hidden = !item;
    },
    clear: () => clear({ silent: true }),
    focus: () => input.focus(),
  };
}

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}
