-- 0002_dashboard.sql
-- statement-breakpoint
create table if not exists caregiver_profiles (
  user_id text primary key,
  verified integer default 0,
  verified_label text,
  completeness integer,
  avatar text,
  name text,
  bio text,
  zone text,
  price_per_day real,
  multi_pet integer,
  has_own_pet integer,
  own_pet_photo text,
  rating_avg real,
  jobs_done integer,
  revenue_30d real,
  created_at text,
  updated_at text
);

-- statement-breakpoint
create table if not exists caregiver_accepts (
  id integer primary key autoincrement,
  user_id text not null,
  species text not null
);

-- statement-breakpoint
create table if not exists caregiver_dog_sizes (
  id integer primary key autoincrement,
  user_id text not null,
  size text not null
);

-- statement-breakpoint
create table if not exists caregiver_services (
  user_id text primary key,
  alojamiento integer default 0,
  visita integer default 0,
  paseo integer default 0,
  updated_at text
);

-- statement-breakpoint
create table if not exists caregiver_photos (
  id text primary key,
  user_id text not null,
  url text,
  position integer,
  created_at text
);

-- statement-breakpoint
create table if not exists caregiver_availability (
  id integer primary key autoincrement,
  user_id text not null,
  date text not null,
  available integer default 1
);

-- statement-breakpoint
create table if not exists caregiver_bank (
  user_id text primary key,
  bank_name text,
  titular text,
  rif text,
  paymobile text,
  verified integer default 0,
  updated_at text
);

-- statement-breakpoint
create table if not exists caregiver_security (
  user_id text primary key,
  biometria integer default 0,
  google_auth integer default 0,
  updated_at text
);

-- statement-breakpoint
create table if not exists caregiver_background (
  user_id text primary key,
  file_name text,
  uploaded integer default 0,
  updated_at text
);

-- statement-breakpoint
create table if not exists caregiver_reviews (
  id text primary key,
  caregiver_id text not null,
  reviewer_id text,
  rating integer,
  comment text,
  date text,
  created_at text
);

-- statement-breakpoint
create table if not exists owner_profile_extra (
  user_id text primary key,
  full_name text,
  email text,
  primary_phone text,
  alternative_phone text,
  cedula text,
  address text,
  zone text,
  biometric_selfie text,
  profile_photo text,
  display_name text,
  bio text,
  photo_with_pet text,
  phone_verified integer default 0,
  email_verified integer default 0,
  is_verified integer default 0,
  rating real,
  total_reviews integer,
  completeness integer,
  updated_at text
);

-- statement-breakpoint
create table if not exists owner_pet_profiles (
  id text primary key,
  owner_id text not null,
  name text,
  species text,
  photo text,
  age integer,
  sex text,
  weight real,
  size text,
  behavior text,
  medical_conditions text,
  allergies text,
  vaccination_card text,
  has_id_tag integer,
  active integer,
  updated_at text
);

-- statement-breakpoint
create table if not exists owner_reviews (
  id text primary key,
  owner_id text not null,
  reviewer_id text,
  rating integer,
  comment text,
  date text,
  pet_name text,
  created_at text
);

-- statement-breakpoint
create table if not exists service_requests (
  id text primary key,
  pet_id text not null,
  owner_id text not null,
  caregiver_id text not null,
  start_date text,
  end_date text,
  status text,
  owner_rating integer,
  owner_review text,
  caregiver_rating integer,
  caregiver_review text,
  price real,
  created_at text,
  updated_at text
);

-- statement-breakpoint
create table if not exists bookings (
  id text primary key,
  request_id text,
  pet_id text,
  owner_id text,
  caregiver_id text,
  service text,
  date_from text,
  date_to text,
  amount_usd real,
  status text,
  created_at text,
  updated_at text
);

-- statement-breakpoint
create table if not exists chats (
  id text primary key,
  owner_id text not null,
  caregiver_id text not null,
  pet_id text,
  status text,
  payment_status text,
  dispute_status text,
  open integer default 1,
  locked integer default 0,
  unread integer default 0,
  created_at text,
  updated_at text
);

-- statement-breakpoint
create table if not exists chat_messages (
  id text primary key,
  chat_id text not null,
  sender text,
  text text,
  media_url text,
  ts text
);

-- statement-breakpoint
create table if not exists chat_reports (
  id text primary key,
  chat_id text not null,
  reporter_id text,
  report_type text,
  report_text text,
  created_at text,
  resolved integer default 0
);

-- statement-breakpoint
create table if not exists payments (
  id text primary key,
  booking_id text,
  payer_role text,
  amount real,
  reference text,
  proof_name text,
  status text,
  note text,
  created_at text,
  updated_at text
);

-- statement-breakpoint
create table if not exists payment_events (
  id text primary key,
  payment_id text not null,
  ts text,
  type text,
  text text
);
