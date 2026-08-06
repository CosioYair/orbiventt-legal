/* SAFE DOM CONSTRUCTION.
 *
 * The one rule this module exists to enforce: organizer content becomes a TEXT
 * NODE, never markup. Every element the renderer produces is built here, and
 * `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write` and inline
 * event-handler attributes appear nowhere in the invitation module tree. That
 * is a stronger guarantee than escaping, because there is no template string
 * for an escape to be forgotten in.
 *
 * `el()` deliberately accepts no `html` option. If a section ever needs richer
 * markup, it composes more elements — it does not gain a raw-HTML escape hatch.
 *
 * The helpers take the document as an explicit argument (defaulting to the
 * global one) so the exact file the site serves can be exercised under
 * `node --test` against a minimal DOM, with no bundler and no jsdom dependency.
 */

/** Attributes an element may receive. Anything not listed is dropped — this is
 *  what keeps a config value from ever becoming `onclick` or `srcdoc`. */
const ALLOWED_ATTRS = {
    id: true,
    class: true,
    href: true,
    src: true,
    alt: true,
    title: true,
    type: true,
    role: true,
    tabindex: true,
    target: true,
    rel: true,
    download: true,
    loading: true,
    decoding: true,
    width: true,
    height: true,
    datetime: true,
    hidden: true,
    'aria-label': true,
    'aria-hidden': true,
    'aria-live': true,
    'aria-labelledby': true,
    'aria-describedby': true,
    'data-section': true,
    'data-unit': true,
    /* Both are RENDERER-COMPUTED and closed: `data-slot` is one of the six
     * interlude slot names from the contract's own list, `data-parity` is
     * "even" or "odd" derived from that slot's fixed index. Neither is ever an
     * organizer value, and a `data-*` attribute cannot execute — the allowlist
     * exists to stop config text reaching `onclick`, `src` or `srcdoc`, and
     * these reach a CSS selector. */
    'data-slot': true,
    'data-parity': true,
};

function doc(d) {
    return d || (typeof document !== 'undefined' ? document : null);
}

/**
 * Create an element.
 *
 * @param {string} tag
 * @param {object} [opts]
 *   class    {string}            class attribute
 *   text     {string}            textContent (never parsed as HTML)
 *   attrs    {object}            allowlisted attributes only
 *   children {Array<Node|null>}  appended in order; null/undefined skipped
 *   document {Document}          test seam
 */
export function el(tag, opts) {
    const options = opts || {};
    const d = doc(options.document);
    if (!d) throw new Error('el(): no document available');

    const node = d.createElement(tag);

    if (options.class) node.setAttribute('class', String(options.class));

    if (options.attrs) {
        for (const name of Object.keys(options.attrs)) {
            const value = options.attrs[name];
            if (value === null || value === undefined || value === false) continue;
            if (!Object.prototype.hasOwnProperty.call(ALLOWED_ATTRS, name)) continue;
            node.setAttribute(name, value === true ? '' : String(value));
        }
    }

    if (options.text !== undefined && options.text !== null) {
        node.textContent = String(options.text);
    }

    if (options.children) {
        for (const child of options.children) {
            if (child) node.appendChild(child);
        }
    }

    return node;
}

/** Set text content. The single entry point for organizer copy. */
export function setText(node, value) {
    if (!node) return node;
    node.textContent = value === null || value === undefined ? '' : String(value);
    return node;
}

/**
 * Render a multi-line paragraph as one <p> per block, so a body message keeps
 * its intended breaks without a single character of markup being generated.
 */
export function paragraphs(text, opts) {
    const options = opts || {};
    const blocks = String(text || '').split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
    return blocks.map((block) => el('p', {
        class: options.class,
        text: block,
        document: options.document,
    }));
}

/** Remove every child of a node. */
export function clear(node) {
    if (!node) return node;
    while (node.firstChild) node.removeChild(node.firstChild);
    return node;
}

/**
 * An external link. `href` MUST already have passed `security.safeExternalUrl`
 * (or `safeMapUrl`); this helper only applies the presentation contract —
 * new tab, no opener, and an accessible "opens externally" hint.
 */
export function externalLink(href, label, opts) {
    const options = opts || {};
    return el('a', {
        class: options.class,
        text: label,
        attrs: {
            href: href,
            target: '_blank',
            rel: 'noopener noreferrer',
            'aria-label': options.ariaLabel || null,
        },
        document: options.document,
    });
}

/** Visually hidden text that assistive technology still announces. */
export function srOnly(text, opts) {
    const options = opts || {};
    return el('span', { class: 'inv-sr-only', text: text, document: options.document });
}
