/* THE TEMPLATE REGISTRY — code-first, closed set.
 *
 * A registry identifier arrives from the query string, so it is attacker
 * controlled. Two properties make that harmless:
 *
 *   1. Templates are STATICALLY IMPORTED. There is no dynamic `import()`, no
 *      path built from input, no fetch of a descriptor. Adding a template is a
 *      code change that ships through review; it can never be a URL.
 *   2. Lookup is an own-property check on a NULL-PROTOTYPE map, so values like
 *      `__proto__`, `constructor` or `toString` resolve to nothing instead of
 *      reaching an inherited member.
 *
 * Every entry consumes the WEDDING CATEGORY contract in ../placements.js —
 * the same image geometry, section order and UI copy — so two designs can
 * differ in palette, type and ornament but never in what an invitation is made
 * of. That is what makes switching design a presentation change.
 *
 * `wedding_romantic_v1` is the first entry. Its identifier is the composed form
 * `{templateKey}_v{templateVersion}`, and `assertIdentity()` below proves the
 * three fields and the id agree, so a copy-paste mistake in a future entry
 * fails at load rather than mislabeling a stored invitation.
 */
import weddingRomanticV1 from '../templates/wedding-romantic/template.js';
import weddingClassicGoldV1 from '../templates/wedding-classic-gold/template.js';
import weddingBotanicalV1 from '../templates/wedding-botanical/template.js';
import weddingEditorialV1 from '../templates/wedding-editorial/template.js';
import weddingCelestialV1 from '../templates/wedding-celestial/template.js';
import customDesignV1 from '../templates/custom-design/template.js';
import { CONTRACT_VERSION } from './config.js';

/** Categories the registry knows. Used by the editor in Milestone B.
 *  `custom` (Personalizada) is the bring-your-own-design category: one
 *  uploaded finished image is the whole invitation. */
export const CATEGORIES = Object.freeze({
    wedding: { key: 'wedding', label: 'Boda' },
    custom: { key: 'custom', label: 'Personalizada' },
});

function assertIdentity(t) {
    const expected = t.templateKey + '_v' + t.templateVersion;
    if (t.id !== expected) {
        throw new Error('registry: id "' + t.id + '" does not match "' + expected + '"');
    }
    if (!Object.prototype.hasOwnProperty.call(CATEGORIES, t.categoryKey)) {
        throw new Error('registry: unknown category "' + t.categoryKey + '"');
    }
    /* Every descriptor states WHICH CONFIGURATION CONTRACT it reads. The first
     * template shipped without the field and the four that followed declared
     * it, which left this registry quietly disagreeing, entry by entry, with
     * the mobile one — where the field has always been mandatory. Requiring it
     * here is what lets the two lists be compared field for field rather than
     * only by id. */
    if (t.contractVersion !== CONTRACT_VERSION) {
        throw new Error('registry: template "' + t.id + '" declares contract '
            + t.contractVersion + ', expected ' + CONTRACT_VERSION);
    }
    return t;
}

const TEMPLATES = Object.create(null);
for (const template of [
    weddingRomanticV1, weddingClassicGoldV1, weddingBotanicalV1, weddingEditorialV1,
    weddingCelestialV1, customDesignV1,
]) {
    TEMPLATES[assertIdentity(template).id] = Object.freeze(template);
}

/**
 * Resolve a registry identifier to its template descriptor.
 * @returns {?object} the descriptor, or null for ANY unknown identifier.
 */
export function resolveTemplate(id) {
    if (typeof id !== 'string' || id === '') return null;
    return Object.prototype.hasOwnProperty.call(TEMPLATES, id) ? TEMPLATES[id] : null;
}

/** Every registered identifier, for the editor's template picker. */
export function listTemplates() {
    return Object.keys(TEMPLATES).map((id) => TEMPLATES[id]);
}

/**
 * A configuration and a template agree when the category, key and version all
 * match. Checked before rendering so a stored invitation can never be drawn by
 * a template it was not authored for.
 */
export function matchesConfig(template, config) {
    return !!template && !!config
        && template.categoryKey === config.categoryKey
        && template.templateKey === config.templateKey
        && template.templateVersion === config.templateVersion;
}
