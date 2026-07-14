alter role authenticator set pgrst.db_schemas = 'public, graphql_public, eval';

grant usage on schema eval to anon, authenticated, service_role;

notify pgrst, 'reload config';
