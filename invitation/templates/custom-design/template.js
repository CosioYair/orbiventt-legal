/* TEMPLATE DESCRIPTOR — custom_design, version 1 · "Tu diseño".
 *
 * The first template of the `custom` (Personalizada) category, and the first
 * bring-your-own-design invitation: the organizer designs the whole invitation
 * OUTSIDE Orbiventt and uploads it as ONE finished image. That image is
 * authoritative for every piece of visual invitation information, so this
 * descriptor lists exactly two sections and nothing else:
 *
 *   design   the uploaded image, rendered whole, FIRST — the artwork is the
 *            invitation and leads the composition (FROZEN 2026-08-14,
 *            superseding the original passes-first order). See
 *            sections/design.js.
 *   passes   the existing pass-claim shell section, directly beneath the
 *            design INSIDE THE SAME SHELL. It renders only when the link
 *            actually carries a validated code (or as the labelled draft
 *            example) — the shared renderer's own rule — so a guest without
 *            a pass interaction sees the framed design and nothing else.
 *
 * NO WEDDING SECTION appears here, which is the entire point: hero, message,
 * ceremony, countdown, gallery, gifts, closing and the interlude slots simply
 * do not exist for this category. The renderer draws only what a descriptor
 * lists, so their absence is structural rather than conditional.
 *
 * `imagePlacements` is empty because nothing on this page is framed or
 * cropped: the design section reads the image's own stored dimensions, never a
 * placement geometry. `assets` is empty because this template ships no artwork
 * of its own — the organizer's upload IS the artwork.
 *
 * VERSIONING: as with every template, a visual change that would alter an
 * already-published invitation ships as version 2 with its own descriptor and
 * stylesheet.
 */
export default {
    id: 'custom_design_v1',
    categoryKey: 'custom',
    templateKey: 'custom_design',
    templateVersion: 1,
    contractVersion: 1,

    label: 'Tu diseño',
    description: 'Sube una imagen con el diseño completo de tu invitación.',

    stylesheet: 'custom-design/template.css',

    /* Nothing is placed, framed or cropped on this page. */
    imagePlacements: {},

    /* This template ships no artwork: the upload is the artwork. */
    assets: {},

    themeClass: 'tpl-custom-design',

    /* Only what this page actually says. The pass card's heading is the same
     * wording every category uses, so a guest who has seen one Orbiventt
     * invitation recognizes the claim card on any other. */
    labels: {
        passesHeading: 'Reclama tus pases',
    },

    /* DESIGN FIRST, PASSES SECOND, NOTHING ELSE — the frozen content order
     * (2026-08-14). Both render inside ONE shell: the renderer's own
     * `article.inv-invitation` is styled as the unified Orbiventt container,
     * so the artwork and the pass module are one invitation object. */
    sections: ['design', 'passes'],
};
