/* TEMPLATE DESCRIPTOR — wedding_romantic, version 1.
 *
 * A descriptor is DATA, not code: it names the template, declares which
 * stylesheet dresses it and fixes the order its sections appear in. The
 * rendering itself is shared — every template draws through the same section
 * renderers in invitation/js/sections/, so a second template is a stylesheet
 * plus a different order, not a second renderer to keep in sync.
 *
 * VERSIONING: `templateVersion` is part of the registry identity and is stored
 * on every invitation authored with it. A visual change that would alter an
 * already-published invitation ships as version 2 with its own descriptor and
 * stylesheet; version 1 stays exactly as it is so a guest's link never changes
 * under them.
 *
 * `stylesheet` is a path RELATIVE to invitation/templates/ — resolved at
 * runtime against the module's own URL, so it is identical under the DEV
 * project path and the production root.
 */
import { WEDDING_PLACEMENTS, WEDDING_SECTIONS, WEDDING_LABELS } from '../placements.js';

export default {
    id: 'wedding_romantic_v1',
    categoryKey: 'wedding',
    templateKey: 'wedding_romantic',
    templateVersion: 1,
    contractVersion: 1,

    label: 'Romántica',
    description: 'Marfil, rosa empolvado y tipografía serif. Para bodas clásicas y cálidas.',

    stylesheet: 'wedding-romantic/template.css',

    /* THE CATEGORY'S geometry, not this template's — see ../placements.js.
     * Identical numbers to the ones that were inlined here; sharing them is
     * what makes switching template unable to re-crop a photograph. */
    imagePlacements: WEDDING_PLACEMENTS,

    /* THE TEMPLATE'S OWN ARTWORK — a closed registry, keyed.
     *
     * An invitation stores `{source:'template', assetKey:'hero-default'}` and
     * the renderer resolves that key HERE, in the descriptor of the template
     * the invitation was authored with. Paths live in this file and nowhere
     * else, so no value an organizer can write becomes a file reference.
     *
     * Offered in the editor as "Imagen del diseño" and chosen explicitly. It is
     * never applied as a fallback: an invitation with no hero image renders the
     * template's designed no-image treatment, which is a different composition
     * and a deliberate one.
     *
     * The artwork carries no couple, no date, no place and no text, and is
     * authored for this repository — it is NOT the demonstration illustration
     * under assets/demo/, which may never become real invitation content.
     *
     * Paths are relative to invitation/templates/, like `stylesheet`. */
    assets: {
        'hero-default': 'wedding-romantic/hero-default.jpg',
    },

    /* The class applied to the invitation root. Every rule in template.css is
     * scoped under it, so two templates can never leak styles into each other. */
    themeClass: 'tpl-wedding-romantic',

    labels: WEDDING_LABELS,

    sections: WEDDING_SECTIONS,
};
