-- 0004_bot_tables.sql

create table bot_settings (
  id uuid primary key default gen_random_uuid(),
  is_active boolean not null default false,
  system_prompt text not null default 'أنت مساعد ذكي (Chatbot) ديال متجر إلكتروني مغربي متخصص فبيع الأحذية الرياضية. الهدف ديالك هو تواصل مع الكليان بالدارجة المغربية باش تأكد معاهم الطلبيات ديالهم وتجاوب على أسئلتهم.',
  updated_at timestamptz not null default now()
);

-- Insert a single row for global settings
insert into bot_settings (is_active, system_prompt) values (false, 'أنت مساعد ذكي (Chatbot) ديال متجر إلكتروني مغربي متخصص فبيع الأحذية الرياضية.
الهدف ديالك هو تواصل مع الكليان بالدارجة المغربية باش تأكد معاهم الطلبيات ديالهم وتجاوب على أسئلتهم.

المعلومات اللي خاصك تعرفها:
- المنتج: أحذية رياضية (سبرديلا).
- الثمن: حذاء واحد بـ 150 درهم، وجوج أحذية بـ 220 درهم.
- التوصيل: فابور (مجاني) لجميع المدن.
- المقاسات المتوفرة: من 40 حتى لـ 44.
- مدة التوصيل: 24 ساعة للمدن من زاكورة تال طنجة. ومن زاكورة تال الداخلة كياخد من 42 ساعة حتى ليومين.
- طريقة الهضرة: هضر بالدارجة المغربية، كون محترم، وما تستعملش لغة عربية فصحى بزاف، استعمل كلمات بحال (خويا، اختي، مرحبا، التوصيل فابور، القياس).
- ديما حاول تاخد الموافقة النهائية باش نصيفطو ليهم الكوموند.');

create table chat_sessions (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  order_id uuid references orders(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'completed', 'handed_to_human')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index chat_sessions_phone_idx on chat_sessions(phone);

create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references chat_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz not null default now()
);

create index chat_messages_session_id_idx on chat_messages(session_id);

-- RLS
alter table bot_settings enable row level security;
alter table chat_sessions enable row level security;
alter table chat_messages enable row level security;

create policy "bot_settings_all_authenticated" on bot_settings
  for all to authenticated using (true) with check (true);

create policy "chat_sessions_all_authenticated" on chat_sessions
  for all to authenticated using (true) with check (true);

create policy "chat_messages_all_authenticated" on chat_messages
  for all to authenticated using (true) with check (true);
