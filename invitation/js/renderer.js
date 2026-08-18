/* THE SHARED RENDER ENGINE.
 *
 * This is the function that will draw REAL saved invitations. Milestone A hands
 * it a bundled demonstration configuration; Milestone B will hand it one loaded
 * from the database. Nothing below knows or cares which — it receives a
 * NORMALIZED configuration and a template descriptor, and that is the entire
 * contract. That is the point of the milestone: the demo is not a mockup with a
 * production plan attached, it is the production renderer with demo input.
 *
 * The engine has no globals: the document, the clock, the timer functions, the
 * navigator and the page URL all arrive through the context. So the exact file
 * the site serves runs under `node --test` against a minimal DOM, and the
 * assertions are about the real renderer rather than a re-implementation.
 *
 * FAILURE POLICY
 *   • A REQUIRED section that did not survive normalization never reaches here
 *     — `normalizeConfig` already refused, and the caller shows a controlled
 *     state.
 *   • An OPTIONAL section that returns null is skipped silently.
 *   • An OPTIONAL section that THROWS is caught and skipped. One malformed
 *     value in a gallery item can never take down the ceremony details.
 */
import { el } from './dom.js?v=20260818b';
import { resolveSection } from './sections/index.js?v=20260818b';
import { matchesConfig } from './registry.js?v=20260818b';

/**
 * @param {object} opts
 *   template  {object}   registry descriptor
 *   config    {object}   output of normalizeConfig().config
 *   route     {object}   output of parseRoute()
 *   document  {Document}
 *   assetBase {string}   absolute href of invitation/assets/
 *   templateBase {string} absolute href of invitation/templates/
 *   now       {number}   epoch ms used for the first countdown paint
 *   clock     {Function} returns epoch ms for subsequent ticks
 *   setInterval / clearInterval {Function} omitted in tests → no ticker
 *   navigator {object}   share/clipboard provider
 *   pageUrl   {string}   the URL the share action offers
 *   handoff   {?object}  resolved app handoff for a pass-claim code (app-return.js)
 *   smartOpen {?object}  device-specific open-or-install plan (app-store-links.js)
 *   passSummary {?object} validated pass counts for the claim card (resolve.js)
 *
 * @returns {{ok: boolean, node: ?Element, rendered: string[], skipped: string[],
 *            reason: ?string}}
 */
export function renderInvitation(opts) {
    const o = opts || {};
    const { template, config, document: d } = o;

    if (!template || !config) {
        return { ok: false, node: null, rendered: [], skipped: [], reason: 'missing-input' };
    }
    if (!matchesConfig(template, config)) {
        return { ok: false, node: null, rendered: [], skipped: [], reason: 'template-mismatch' };
    }

    const ctx = {
        config,
        template,
        // Template UI copy. Section headings, button labels and unit names are
        // read from HERE, never from the invitation config — that separation is
        // what guarantees a real invitation cannot inherit somebody else's
        // wording as if the organizer had written it. See FIELDS.md.
        labels: (template && template.labels) || {},
        route: o.route || { mode: 'none', code: null },
        document: d,
        assetBase: o.assetBase,
        // Where the template's OWN artwork lives, and the closed registry that
        // says which keys exist. Both come from the descriptor and the module's
        // own URL — never from the invitation — so a stored `assetKey` can only
        // ever select one of the files this template shipped.
        templateBase: o.templateBase,
        templateAssets: (template && template.assets) || null,
        // What shape a photograph is on this page. The section renderers read
        // their intrinsic width/height from here, so the reserved geometry, the
        // canonical export size and the mobile crop viewport are one number.
        placements: (template && template.imagePlacements) || {},
        // Supplied only for STORED invitations. Absent in demo mode, so a
        // storage reference resolves to null there instead of reaching the
        // network.
        storageUrl: typeof o.storageUrl === 'function' ? o.storageUrl : null,
        locale: config.locale,
        timeZone: config.timeZone,
        now: Number.isFinite(o.now) ? o.now : 0,
        clock: typeof o.clock === 'function' ? o.clock : () => (Number.isFinite(o.now) ? o.now : 0),
        setInterval: o.setInterval,
        clearInterval: o.clearInterval,
        navigator: o.navigator || null,
        pageUrl: typeof o.pageUrl === 'string' ? o.pageUrl : '',
        // The resolved app handoff for a pass-claim code ({open, href, …} from
        // app-return.js), or null. Only the `passes` shell section reads it.
        // Built by the CALLER through the shared resolver — the renderer and
        // its sections never assemble an app URL themselves.
        handoff: o.handoff || null,
        // The device-specific open-or-install plan for that same handoff
        // ({strategy, href, storeUrl, arm} from app-store-links.js), or null.
        // Only the `passes` shell section reads it, and null simply means the
        // handoff href is used exactly as it always was. Built by the CALLER
        // for the same reason the handoff is: no section assembles an app or
        // store URL of its own.
        smartOpen: o.smartOpen || null,
        // Validated pass counts ({seatCapacity, seatsRemaining} from
        // normalizePassSummary), or null → the card omits the allocation line.
        passSummary: o.passSummary || null,
    };

    const rendered = [];
    const skipped = [];
    const nodes = [];

    for (const id of template.sections) {
        const entry = resolveSection(id);
        if (!entry) { skipped.push(id); continue; }

        const data = entry.shell ? null : config.sections[id];

        let node = null;
        try {
            node = entry.render(data, ctx);
        } catch (_) {
            node = null;
        }

        if (node) { nodes.push(node); rendered.push(id); } else { skipped.push(id); }
    }

    const article = el('article', {
        class: 'inv-invitation ' + template.themeClass,
        attrs: { 'data-section': 'invitation' },
        children: nodes,
        document: d,
    });

    return { ok: true, node: article, rendered, skipped, reason: null };
}
