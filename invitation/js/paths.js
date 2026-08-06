/* DEPLOYMENT-PATH RESOLUTION.
 *
 * The same invitation module is served from two different roots:
 *
 *   DEV   https://orbiventt.com/invitation/
 *   PROD  https://orbiventt.com/invitation/
 *
 * Nothing in the module tree may contain either of those strings. Every asset,
 * stylesheet and template path is instead resolved RELATIVE to the URL of the
 * module asking for it (`import.meta.url`), which the browser already knows.
 * The result is correct under both roots — and under any future one — with no
 * environment-specific value, no `<base>` dependency inside the JS, and nothing
 * for a promotion script to rewrite.
 *
 * The functions take the module URL as an argument rather than reading
 * `import.meta.url` directly so both deployment roots can be exercised in a
 * test with no browser and no server.
 */

/**
 * Derive the module tree's base URLs from the URL of a file inside
 * `invitation/js/`.
 *
 * @param {string} moduleUrl  typically `import.meta.url`
 * @returns {{root: string, assets: string, templates: string}} absolute hrefs
 */
export function moduleBases(moduleUrl) {
    const root = new URL('../', moduleUrl);
    return {
        root: root.href,
        assets: new URL('assets/', root).href,
        templates: new URL('templates/', root).href,
    };
}

/**
 * Resolve a template-relative resource (a stylesheet) against the templates
 * root. FAILS CLOSED on anything that is not a plain relative path, so a
 * registry entry can never point outside the template directory.
 */
export function templateResourceUrl(templatesBase, relPath) {
    if (typeof relPath !== 'string' || relPath === '') return null;
    if (relPath.charAt(0) === '/' || relPath.indexOf('//') !== -1) return null;
    if (/^[a-z][a-z0-9+.-]*:/i.test(relPath)) return null;
    if (!/^[a-z0-9][a-z0-9._/-]{0,120}$/i.test(relPath)) return null;
    if (relPath.split('/').some((seg) => seg === '' || seg === '.' || seg === '..')) return null;
    if (!/\.css$/i.test(relPath)) return null;
    try {
        const url = new URL(relPath, templatesBase);
        return url.href.indexOf(templatesBase) === 0 ? url.href : null;
    } catch (_) {
        return null;
    }
}
