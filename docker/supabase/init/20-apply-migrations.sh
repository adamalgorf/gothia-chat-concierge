#!/bin/sh
set -eu

for migration in /supabase-migrations/*.sql; do
  echo "Applying $migration"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --file "$migration"
done
