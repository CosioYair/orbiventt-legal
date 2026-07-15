-- ============================================================================
-- Orbiventt — Read-only PROD verification pack
-- ============================================================================
-- PURPOSE
--   Diagnostic, SELECT-only inspection of the Supabase backend that the public
--   site (404.html previews) relies on. Run this MANUALLY in the Supabase PROD
--   SQL Editor and review the output BEFORE connecting orbiventt.com.
--
-- SAFETY
--   Every statement is a SELECT or catalog/metadata read. There is NO INSERT,
--   UPDATE, DELETE, ALTER, DROP, CREATE, GRANT, REVOKE, TRUNCATE, CALL, or
--   mutating DO block. It does NOT call application functions (which could
--   mutate data); it only reads their DEFINITIONS from the catalog. It never
--   needs the service-role key — run it as the SQL Editor's default role.
--
-- HOW TO READ THE RESULTS
--   Each query has a comment describing what a CONCERNING result looks like.
--   Do not publish raw results: function definitions may reveal implementation
--   details. See README.md in this folder.
--
-- The public anonymous API surface is exactly three RPCs:
--   get_public_event_preview, get_private_event_preview, get_public_provider_preview
-- plus public Storage object reads. Everything below helps confirm that the
-- anon role cannot reach anything else and that those three RPCs expose only
-- intentionally public, coarse data.
-- ============================================================================


-- 1) Tables in public/storage WITHOUT RLS enabled, and force-RLS flag.
--    CONCERNING: rowsecurity=false on any table the anon/authenticated roles
--    can reach (see query 2); force_rls=false is normal for owner access but
--    the table still needs RLS enabled to constrain anon/authenticated.
SELECT n.nspname   AS schema,
       c.relname   AS table_name,
       c.relrowsecurity  AS rls_enabled,
       c.relforcerowsecurity AS force_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
  AND n.nspname IN ('public', 'storage')
ORDER BY rls_enabled ASC, schema, table_name;


-- 2) Table privileges granted to anon / authenticated.
--    CONCERNING: anon holding INSERT/UPDATE/DELETE anywhere, or SELECT on tables
--    that hold private data (events, invitations, participants, contact info)
--    unless RLS fully constrains those rows.
SELECT table_schema, table_name, grantee,
       string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants
WHERE grantee IN ('anon', 'authenticated')
  AND table_schema IN ('public', 'storage')
GROUP BY table_schema, table_name, grantee
ORDER BY grantee, table_schema, table_name;


-- 3) Table privileges granted to PUBLIC (every role, incl. anon).
--    CONCERNING: any application table granting privileges to PUBLIC.
SELECT table_schema, table_name,
       string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants
WHERE grantee = 'PUBLIC'
  AND table_schema IN ('public', 'storage')
GROUP BY table_schema, table_name
ORDER BY table_schema, table_name;


-- 4) All RLS policies in public/storage (roles, command, USING/WITH CHECK).
--    CONCERNING: policies applied to {anon} (or PUBLIC) that expose private
--    rows; any write policy reachable by anon. Review each carefully.
SELECT schemaname, tablename, policyname,
       roles, cmd,
       qual        AS using_expr,
       with_check  AS with_check_expr
FROM pg_policies
WHERE schemaname IN ('public', 'storage')
ORDER BY schemaname, tablename, policyname;


-- 5) Policies with an UNCONDITIONAL true expression (USING true / WITH CHECK true).
--    CONCERNING: any of these that include the anon or authenticated roles —
--    it means "all rows" with no ownership/visibility predicate.
SELECT schemaname, tablename, policyname, roles, cmd,
       qual AS using_expr, with_check AS with_check_expr
FROM pg_policies
WHERE schemaname IN ('public', 'storage')
  AND (
        btrim(coalesce(qual, ''))       IN ('true', '(true)') OR
        btrim(coalesce(with_check, '')) IN ('true', '(true)')
      )
ORDER BY schemaname, tablename, policyname;


-- 6) Views in public, their owners and security options.
--    CONCERNING: a view owned by a privileged role that is readable by anon can
--    bypass RLS on its base tables unless security_invoker=on. Check reloptions.
SELECT n.nspname AS schema,
       c.relname AS view_name,
       pg_get_userbyid(c.relowner) AS owner,
       c.reloptions               AS options   -- look for security_invoker / security_barrier
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'v'
  AND n.nspname = 'public'
ORDER BY view_name;


-- 6b) Which views can anon SELECT?  CONCERNING: views over private tables.
SELECT table_schema, table_name AS view_name, grantee,
       string_agg(privilege_type, ', ') AS privileges
FROM information_schema.role_table_grants g
WHERE grantee IN ('anon', 'authenticated', 'PUBLIC')
  AND table_schema = 'public'
  AND EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='public' AND c.relname=g.table_name AND c.relkind='v')
GROUP BY table_schema, table_name, grantee
ORDER BY view_name, grantee;


-- 7) Functions in public: security model, owner, EXECUTE by anon/PUBLIC, config.
--    Evaluate BOTH models correctly:
--      * SECURITY INVOKER runs with the caller's privileges (relies on RLS/grants).
--      * SECURITY DEFINER runs with the owner's privileges — appropriate for a
--        controlled preview function ONLY IF it validates input, has a fixed
--        safe search_path (query 8), restricts EXECUTE, and selects only public
--        columns.
--    CONCERNING: an anon-executable SECURITY DEFINER function that is NOT one of
--    the three known preview RPCs; any anon-executable function with no fixed
--    search_path; a SECURITY DEFINER function owned by a superuser/privileged role.
SELECT n.nspname AS schema,
       p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS args,
       CASE WHEN p.prosecdef THEN 'DEFINER' ELSE 'INVOKER' END AS security,
       pg_get_userbyid(p.proowner) AS owner,
       has_function_privilege('anon',   p.oid, 'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_execute,
       has_function_privilege('public', p.oid, 'EXECUTE') AS public_execute,
       p.proconfig AS set_config   -- e.g. {search_path=...}
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
ORDER BY anon_execute DESC, security DESC, function_name;


-- 8) Functions WITHOUT an explicit search_path in their SET config.
--    CONCERNING: SECURITY DEFINER functions here are vulnerable to search_path
--    hijacking. Every SECURITY DEFINER preview RPC should pin search_path.
SELECT n.nspname AS schema,
       p.proname AS function_name,
       CASE WHEN p.prosecdef THEN 'DEFINER' ELSE 'INVOKER' END AS security,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND NOT EXISTS (
        SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) cfg
        WHERE cfg LIKE 'search_path=%'
      )
ORDER BY security DESC, anon_execute DESC, function_name;


-- 9) Full definitions of the three anonymous preview RPCs.
--    Review against the criteria in Phase 6 (see README): only public/coarse
--    fields, no exact lat/lng, no participant/invitation data, no private
--    contact info, server-side token binding for the private preview, and
--    identical output for private-vs-nonexistent (no enumeration).
SELECT p.proname AS function_name,
       CASE WHEN p.prosecdef THEN 'DEFINER' ELSE 'INVOKER' END AS security,
       pg_get_userbyid(p.proowner) AS owner,
       p.proconfig AS set_config,
       pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('get_public_event_preview',
                    'get_private_event_preview',
                    'get_public_provider_preview')
ORDER BY function_name;


-- 10) ALL other functions anon can EXECUTE (beyond the three previews).
--     CONCERNING: any unexpected function widens the anonymous API surface.
SELECT n.nspname AS schema, p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS args,
       CASE WHEN p.prosecdef THEN 'DEFINER' ELSE 'INVOKER' END AS security
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE has_function_privilege('anon', p.oid, 'EXECUTE')
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND p.proname NOT IN ('get_public_event_preview',
                        'get_private_event_preview',
                        'get_public_provider_preview')
ORDER BY schema, function_name;


-- 11) Default privileges that could auto-grant to anon/PUBLIC on new objects.
--     CONCERNING: default ACLs handing EXECUTE/SELECT to anon or PUBLIC.
SELECT pg_get_userbyid(d.defaclrole) AS granting_role,
       n.nspname AS schema,
       d.defaclobjtype AS object_type,   -- r=table, f=function, S=sequence, T=type
       d.defaclacl AS default_acl
FROM pg_default_acl d
LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
ORDER BY schema, object_type;


-- 12) Storage buckets: public flag, MIME allow-list, size limit.
--     CONCERNING: a bucket holding PRIVATE-event media with public=true;
--     allowed_mime_types NULL (any type, incl. image/svg+xml or text/html —
--     active-content upload risk); file_size_limit NULL (no cap).
SELECT id, name, public, file_size_limit, allowed_mime_types, created_at
FROM storage.buckets
ORDER BY public DESC, name;


-- 13) Storage object RLS policies (storage.objects).
--     CONCERNING: anon SELECT policies that are not scoped to public buckets;
--     any anon INSERT/UPDATE/DELETE policy.
SELECT policyname, roles, cmd,
       qual AS using_expr, with_check AS with_check_expr
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;


-- 14) Grants to anon/authenticated on the storage schema tables.
SELECT table_name, grantee,
       string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'storage'
  AND grantee IN ('anon', 'authenticated', 'PUBLIC')
GROUP BY table_name, grantee
ORDER BY table_name, grantee;


-- 15) Schema-level privileges: which schemas are USAGE-accessible to anon?
--     CONCERNING: anon USAGE on internal schemas beyond what PostgREST needs.
SELECT n.nspname AS schema,
       has_schema_privilege('anon', n.nspname, 'USAGE')  AS anon_usage,
       has_schema_privilege('authenticated', n.nspname, 'USAGE') AS auth_usage
FROM pg_namespace n
WHERE n.nspname NOT LIKE 'pg_%'
  AND n.nspname <> 'information_schema'
ORDER BY schema;


-- 16) Schemas currently exposed via PostgREST (db-schema setting), if readable.
--     CONCERNING: internal schemas exposed to the REST API. (May return no rows
--     if the setting is not visible to the current role — that is fine.)
SELECT name, setting
FROM pg_settings
WHERE name IN ('pgrst.db_schemas', 'pgrst.db_schema');


-- 17) Columns of the base event/provider tables (helps compare against what the
--     preview RPCs actually return — spot any exact-location or contact columns
--     that must never reach anon).  Adjust table names to the real schema.
SELECT table_schema, table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (column_name ILIKE '%lat%'  OR column_name ILIKE '%lng%'
    OR column_name ILIKE '%lon%'  OR column_name ILIKE '%address%'
    OR column_name ILIKE '%phone%' OR column_name ILIKE '%email%'
    OR column_name ILIKE '%location%')
ORDER BY table_name, column_name;


-- 18) Extensions installed (context; some add functions callable via REST).
SELECT extname, extversion FROM pg_extension ORDER BY extname;


-- 19) RLS-enabled tables that currently have NO policies (deny-all for
--     non-owners). Usually SAFE (nothing readable), but listed for completeness
--     so you can confirm intent.
SELECT n.nspname AS schema, c.relname AS table_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
  AND n.nspname IN ('public', 'storage')
  AND c.relrowsecurity = true
  AND NOT EXISTS (SELECT 1 FROM pg_policies pp
                  WHERE pp.schemaname = n.nspname AND pp.tablename = c.relname)
ORDER BY schema, table_name;

-- ============================================================================
-- End of read-only verification pack. Review output against docs/security/README.md.
-- ============================================================================
