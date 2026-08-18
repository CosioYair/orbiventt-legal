/**
 * Shared definitions for the DEV ↔ PROD web promotion workflow.
 *
 * Two separate Git repositories serve the same Orbiventt website against two
 * different Supabase projects:
 *
 *   CosioYair/vyvent-legal     DEV   GitHub Pages project site   Supabase DEV
 *   CosioYair/orbiventt-legal  PROD  https://orbiventt.com       Supabase PROD
 *
 * SOURCE-OF-TRUTH RULE
 *   `orbiventt-legal` is the canonical PRODUCTION codebase.
 *   `vyvent-legal` is the DEV mirror and the implementation surface: features
 *   are written and validated here first, then PROMOTED — copied, never
 *   rewritten — into the production repository at the approved release gate.
 *
 * Everything below exists so that "the same implementation" is a mechanically
 * checkable claim rather than a habit.
 */

/** Files that MUST be equivalent in both repositories (modulo ENV_TOKENS). */
export const SHARED_FILES = [
  '404.html',
  // The app-handoff resolver. SHARED on purpose: production must run the same
  // decision code, taking its `env !== 'dev'` branch, so the DEV-only Expo Go
  // path is proven inert there rather than merely absent.
  'app-return.js',
  // The app-distribution module: the store listings, the platform rule and the
  // open-or-install plan. SHARED for the same reason as the resolver — both
  // deployments must run the same decision code, and the store URLs must have
  // exactly one declaration across the two repositories.
  'app-store-links.js',
  'index.html',
  'support.html',
  'privacy-policy.html',
  'terms-of-service.html',
  'delete-account.html',
  '.nojekyll',
  '.well-known/assetlinks.json',
  '.well-known/README.md',
  'assets/favicon.png',
  'assets/orbiventt-logo.png',
  'favicon.ico',
  'favicon-96x96.png',
  'apple-touch-icon.png',
  'scripts/web-env.mjs',
  'scripts/parity-check.mjs',
  'scripts/promote.mjs',
];

/**
 * Directories whose entire contents are shared. Added as the invitation module
 * lands, so template/section/asset files never need listing one by one.
 */
export const SHARED_DIRS = [
  'invitation',
];

/**
 * ENVIRONMENT-SPECIFIC files. Never compared, never promoted, never copied in
 * either direction. Confusing these between deployments is exactly the failure
 * this workflow exists to prevent.
 */
export const ENV_ONLY_FILES = [
  'env.js',      // Supabase target + DEV marker
  'robots.txt',  // DEV disallows everything; PROD advertises the sitemap
  'sitemap.xml', // production URLs only
  'CNAME',       // production custom domain only
  // Generated per deployment by the Pages workflow (branch, commit, timestamp).
  // It describes a deployment, not the code, so promoting it would publish the
  // DEV mirror's commit as production's.
  'deployment.json',
  // Deploy policy differs by design: the DEV mirror may additionally publish
  // ONE explicitly named feature branch so work can be validated on a physical
  // device before it is merged, which production must never do. (Explicitly
  // named — never a `feature/*` or `feature/**` wildcard; see the header of
  // the workflow itself.) Promoting this file would hand production that
  // trigger, so it stays environment-specific.
  '.github/workflows/deploy-pages.yml',
];

/**
 * Paths that exist only in the production repository (marketing + internal
 * docs). They are deliberately absent from the DEV mirror and are not part of
 * the parity contract.
 */
export const PROD_ONLY_PATHS = [
  'docs',
  'prensa',
  'post.txt',
  'scripts/build-press-release.mjs',
];

export const DEV_SUPABASE_REF = 'lehwxjbjlehsdkqxlzrb';
export const PROD_SUPABASE_REF = 'lehwxjbjlehsdkqxlzrb';

export const DEV_BASE_HREF = '<base href="/">';
export const PROD_BASE_HREF = '<base href="/">';

/**
 * The deployment's own ABSOLUTE origin.
 *
 * Almost every URL on this site is relative and resolves through `<base>`, so
 * it needs no rewriting. Open Graph is the exception: `og:url` and `og:image`
 * are read by crawlers that do not execute the page and do not reliably resolve
 * a relative reference, so those two tags must carry a real origin — and the
 * right origin differs per deployment. Normalizing it here keeps the DEV mirror
 * previewing ITS OWN image (rather than a production file that may not exist
 * yet) while production still advertises orbiventt.com, and keeps both sides
 * byte-equivalent under the parity check.
 */
export const DEV_SITE_ORIGIN = 'https://orbiventt.com';
export const PROD_SITE_ORIGIN = 'https://orbiventt.com';

/** The DEV-only noindex block, marker comment included so removal is exact. */
const DEV_NOINDEX_BLOCK =
  /[^\S\r\n]*<!-- ENV-SPECIFIC: DEV mirror only\. Removed on promotion to production\. -->\r?\n[^\S\r\n]*<meta name="robots" content="noindex">\r?\n/g;

/**
 * Rewrite DEV file content into its PRODUCTION equivalent.
 *
 * These are the ONLY differences allowed to exist between the two repositories
 * inside a shared file. Anything else the parity check reports is real drift.
 */
export function devToProd(content) {
  return content
    .split(DEV_BASE_HREF).join(PROD_BASE_HREF)
    .split(DEV_SITE_ORIGIN).join(PROD_SITE_ORIGIN)
    .split(DEV_SUPABASE_REF).join(PROD_SUPABASE_REF)
    .replace(DEV_NOINDEX_BLOCK, '');
}

/** Binary files are compared byte-for-byte; token rewriting does not apply. */
export function isBinary(relPath) {
  return /\.(png|ico|jpg|jpeg|gif|webp|woff2?)$/i.test(relPath);
}
