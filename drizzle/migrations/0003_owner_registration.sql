-- 0003_owner_registration.sql
-- statement-breakpoint
create table if not exists owner_emergency (
  user_id text primary key,
  nombre text,
  relacion text,
  direccion text,
  telefono text,
  updated_at text
);

-- statement-breakpoint
create table if not exists owner_refs (
  id integer primary key autoincrement,
  user_id text not null,
  kind text not null,
  nombre text,
  telefono text,
  relacion text
);

-- statement-breakpoint
create table if not exists owner_location (
  user_id text primary key,
  lat text,
  lng text,
  direccion_detallada text,
  updated_at text
);
