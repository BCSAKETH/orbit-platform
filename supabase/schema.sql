-- ══════════════════════════════════════════════════════════════
-- ORBIT Platform — Supabase PostgreSQL Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ══════════════════════════════════════════════════════════════

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────
-- DEPARTMENTS & SECTIONS (reference data)
-- ─────────────────────────────────────────
create table if not exists departments (
  id    text primary key,  -- e.g. "CSE", "ECE"
  name  text not null
);

insert into departments values
  ('CSE','Computer Science & Engineering'),
  ('ECE','Electronics & Communication'),
  ('MECH','Mechanical Engineering'),
  ('IT','Information Technology'),
  ('AIDS','AI & Data Science')
on conflict do nothing;

-- ─────────────────────────────────────────
-- USERS (admins / hod / incharge — staff)
-- ─────────────────────────────────────────
create table if not exists staff (
  id          uuid primary key default uuid_generate_v4(),
  email       text unique not null,
  name        text not null,
  role        text not null check (role in ('admin','hod','incharge')),
  dept        text references departments(id),
  section     text,   -- only for incharge, e.g. "A"
  avatar      text,   -- 2-letter initials
  password_hash text, -- use Supabase Auth in production
  created_at  timestamptz default now()
);

-- ─────────────────────────────────────────
-- STUDENTS
-- ─────────────────────────────────────────
create table if not exists students (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  roll            text unique not null,
  email           text unique not null,
  password_hash   text not null,
  dept            text references departments(id),
  section         text not null default 'A',
  batch           text not null default '2022-26',
  cgpa            numeric(4,2) default 0,
  status          text not null default 'PENDING' check (status in ('PENDING','ACTIVE','REJECTED')),

  -- Platform handles
  leetcode        text default '',
  github          text default '',
  codeforces      text default '',
  codechef        text default '',
  language        text default 'C++',

  -- Verification flags
  lc_verified     boolean default false,
  gh_verified     boolean default false,
  cf_verified     boolean default false,
  cc_verified     boolean default false,

  -- Competitive stats (synced from APIs)
  lc_easy         integer default 0,
  lc_medium       integer default 0,
  lc_hard         integer default 0,
  cf_rating       integer default 0,
  cf_max_rating   integer default 0,
  cc_stars        integer default 0,
  gh_commits      integer default 0,
  gh_prs          integer default 0,
  cw_problems     integer default 0,
  streak          integer default 0,

  -- Computed by trigger
  score           integer default 0,
  tier            text default 'Beginner',
  placement_ready boolean default false,

  avatar          text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Auto-compute score & tier on update
create or replace function compute_student_score()
returns trigger as $$
declare
  lc_total int;
  new_score int;
  new_tier text;
begin
  lc_total := NEW.lc_easy + NEW.lc_medium + NEW.lc_hard;
  new_score := (lc_total * 2)
             + (NEW.cf_rating / 10)
             + (NEW.gh_commits / 5)
             + (NEW.gh_prs * 3)
             + (NEW.cc_stars * 20)
             + (NEW.streak * 2)
             + (CAST(NEW.cgpa AS int) * 15);
  new_tier := case
    when new_score >= 400 then 'Elite'
    when new_score >= 250 then 'Advanced'
    when new_score >= 120 then 'Intermediate'
    else 'Beginner'
  end;
  NEW.score := new_score;
  NEW.tier := new_tier;
  NEW.placement_ready := (lc_total >= 100 AND NEW.cf_rating >= 1400 AND NEW.cgpa >= 7.0);
  NEW.updated_at := now();
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists trg_compute_score on students;
create trigger trg_compute_score
  before insert or update on students
  for each row execute function compute_student_score();

-- ─────────────────────────────────────────
-- HEATMAP DATA (daily activity)
-- ─────────────────────────────────────────
create table if not exists heatmap_entries (
  id          uuid primary key default uuid_generate_v4(),
  student_id  uuid references students(id) on delete cascade,
  date        date not null,
  platform    text not null check (platform in ('lc','cf','gh','cw')),
  count       integer not null default 0,
  unique (student_id, date, platform)
);

-- ─────────────────────────────────────────
-- DIRECT MESSAGES
-- ─────────────────────────────────────────
create table if not exists dms (
  id          uuid primary key default uuid_generate_v4(),
  from_id     text not null,  -- student uuid OR staff email
  from_name   text not null,
  from_avatar text,
  to_id       uuid references students(id) on delete cascade,
  to_name     text not null,
  msg         text not null,
  read        boolean default false,
  created_at  timestamptz default now(),
  expires_at  timestamptz default (now() + interval '48 hours')
);

-- Auto-delete expired DMs (requires pg_cron extension)
-- In Supabase Dashboard → Database → Extensions → enable pg_cron
-- Then run:
-- select cron.schedule('delete-expired-dms', '0 * * * *', $$delete from dms where expires_at < now()$$);

-- ─────────────────────────────────────────
-- COMMUNITY MESSAGES (group hall)
-- ─────────────────────────────────────────
create table if not exists community_messages (
  id          uuid primary key default uuid_generate_v4(),
  author_id   text not null,
  author_name text not null,
  author_avatar text,
  message     text not null,
  created_at  timestamptz default now(),
  expires_at  timestamptz default (now() + interval '48 hours')
);

-- ─────────────────────────────────────────
-- PLACEMENT OFFERS
-- ─────────────────────────────────────────
create table if not exists offers (
  id            uuid primary key default uuid_generate_v4(),
  student_id    uuid references students(id) on delete cascade,
  company       text not null,
  role          text not null,
  package_lpa   numeric(5,2),
  status        text default 'pending' check (status in ('pending','accepted','rejected')),
  offer_date    date default current_date,
  created_at    timestamptz default now()
);

-- ─────────────────────────────────────────
-- INTERVIEW REQUESTS
-- ─────────────────────────────────────────
create table if not exists interview_requests (
  id              uuid primary key default uuid_generate_v4(),
  student_id      uuid references students(id) on delete cascade,
  interview_type  text not null default 'dsa' check (interview_type in ('dsa','system','hr','fullstack')),
  status          text default 'pending' check (status in ('pending','approved','rejected','completed')),
  requested_at    timestamptz default now(),
  reviewed_by     uuid references staff(id),
  reviewed_at     timestamptz,
  notes           text
);

-- ─────────────────────────────────────────
-- MOCK TEST RESULTS
-- ─────────────────────────────────────────
create table if not exists mock_test_results (
  id            uuid primary key default uuid_generate_v4(),
  student_id    uuid references students(id) on delete cascade,
  test_type     text not null,
  difficulty    text not null,
  score_pct     integer not null,
  correct       integer not null,
  total         integer not null,
  questions     jsonb,  -- store full Q&A for review
  taken_at      timestamptz default now()
);

-- ─────────────────────────────────────────
-- AUDIT LOG
-- ─────────────────────────────────────────
create table if not exists audit_log (
  id          uuid primary key default uuid_generate_v4(),
  actor       text not null,
  action      text not null,
  target      text,
  details     jsonb,
  created_at  timestamptz default now()
);

-- ─────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS)
-- ─────────────────────────────────────────
alter table students enable row level security;
alter table dms enable row level security;
alter table community_messages enable row level security;
alter table offers enable row level security;
alter table interview_requests enable row level security;
alter table mock_test_results enable row level security;

-- Students can read/update their own row
create policy "students_own_row" on students
  for all using (auth.uid()::text = id::text);

-- Admins can see all students
create policy "admin_all_students" on students
  for all using (
    exists (select 1 from staff where id = auth.uid() and role = 'admin')
  );

-- HOD can see their dept
create policy "hod_dept_students" on students
  for select using (
    exists (select 1 from staff where id = auth.uid() and role = 'hod' and dept = students.dept)
  );

-- Incharge can see their section
create policy "incharge_section_students" on students
  for select using (
    exists (select 1 from staff where id = auth.uid() and role = 'incharge' and dept = students.dept and section = students.section)
  );

-- DMs: participants can read
create policy "dms_participants" on dms
  for select using (
    auth.uid()::text = from_id or auth.uid() = to_id
  );

-- ─────────────────────────────────────────
-- REALTIME (enable in Supabase Dashboard)
-- ─────────────────────────────────────────
-- Go to: Database → Replication → supabase_realtime publication
-- Add tables: students, dms, community_messages, interview_requests

-- ─────────────────────────────────────────
-- SEED DEMO DATA (optional)
-- ─────────────────────────────────────────
-- Insert demo staff
insert into staff (email, name, role, dept, section, avatar) values
  ('admin@orbit.edu',    'System Admin',   'admin',    null,  null,  'AD'),
  ('hod.cse@orbit.edu',  'Dr. Meera Nair', 'hod',      'CSE', null,  'MN'),
  ('si.cse.a@orbit.edu', 'Prof. Arun S',   'incharge', 'CSE', 'A',   'AS')
on conflict do nothing;
