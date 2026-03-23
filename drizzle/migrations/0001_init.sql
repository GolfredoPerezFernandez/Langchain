-- 0001_init.sql
-- statement-breakpoint
create table if not exists users (
  id text primary key,
  email text not null unique,
  role text not null,
  email_verified integer not null default 1,
  created_at text not null
);

-- statement-breakpoint
create table if not exists user_auth (
  user_id text primary key,
  password_hash text not null,
  password_salt text not null,
  created_at text not null,
  updated_at text not null
);

-- statement-breakpoint
create table if not exists sessions (
  id text primary key,
  user_id text not null,
  token text not null unique,
  expires_at text not null,
  created_at text not null,
  last_seen text not null
);

-- statement-breakpoint
create table if not exists owner_profiles (
  user_id text primary key,
  nombres text,
  apellidos text,
  tel1 text,
  tel2 text,
  cedula_num text,
  cedula_anverso_name text,
  cedula_reverso_name text,
  rif_num text,
  rif_archivo_name text,
  banco_nombre text,
  banco_titular text,
  banco_cedula text,
  banco_cuenta text,
  banco_soporte_name text,
  updated_at text
);

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

-- statement-breakpoint
create table if not exists owner_pets (
  id text primary key,
  user_id text not null,
  nombre text,
  especie text,
  raza text,
  edad text,
  vacunas_al_dia integer,
  control_name text,
  updated_at text
);
