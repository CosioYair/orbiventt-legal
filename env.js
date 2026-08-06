/* ENVIRONMENT BOUNDARY — PRODUCTION ONLY.
 *
 * This is the one file that differs between the two Orbiventt web
 * deployments, and it is NEVER promoted between repositories:
 *
 *   CosioYair/orbiventt-legal  → PRODUCTION, https://orbiventt.com,  Supabase PROD
 *   CosioYair/vyvent-legal     → DEVELOPMENT, GitHub Pages project site, Supabase DEV
 *
 * Everything else (HTML, CSS, JS, templates, assets, security helpers) is
 * kept byte-equivalent across both repositories; see scripts/parity-check.mjs.
 *
 * RULES
 *  - `supaAnon` is a PUBLISHABLE anon JWT. It is meant to ship in client code.
 *    A SERVICE-ROLE KEY MUST NEVER APPEAR IN THIS FILE OR IN THIS REPOSITORY.
 *  - The environment is fixed at deploy time by which repository serves the
 *    page. Nothing here may ever be made switchable from a query parameter,
 *    localStorage, or any other client-controlled input.
 *  - `basePath` is the path this deployment is served under. The production
 *    custom domain serves at the root, so this value is the empty string.
 */
window.__ORB_ENV__ = {
    env: 'prod',
    supaUrl: 'https://lehwxjbjlehsdkqxlzrb.supabase.co',
    supaAnon: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlaHd4amJqbGVoc2RrcXhsenJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNDAxMjcsImV4cCI6MjA5MDcxNjEyN30.Twvct9R8Pj5Bph7KkuqB2ElegYhiVCEz_mW_rlWAFrk',
    basePath: '',
    devBadge: false
};
