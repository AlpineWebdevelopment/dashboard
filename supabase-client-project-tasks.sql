-- A Client Projects board második fele: a lépések egy projekten belül, és a
-- projekt teljes útiterve.
--
-- Run this in the SQL editor of the dashboard's OWN Supabase project — check
-- the project name in the top-left first (figvcskjslkvomoxubuq). Requires
-- supabase-client-projects.sql to have been run already.
--
-- Safe to re-run: every statement is guarded, and the seed at the bottom only
-- writes when the project has no steps yet, so a second run is a no-op rather
-- than a pile of duplicates.
--
-- ── No DO block, no BEGIN/COMMIT, no dollar quoting ─────────────────────────
--
-- An earlier version of this file wrapped the seed in `do $seed$ … $seed$` and
-- the whole thing in an explicit transaction. It applied nothing at all: the
-- SQL editor splits a script on semicolons, and a PL/pgSQL body is full of
-- them, so the block reached the server in pieces — and because the schema
-- changes shared the transaction, they rolled back with it.
--
-- Everything below is therefore plain statements that stand on their own. The
-- seed is an `insert … select` guarded by `not exists` instead of procedural
-- code, and the roadmap is an ordinary quoted string. If one statement ever
-- fails now, the ones before it still stand and the editor names the culprit.
--
-- ── Why a separate table from `tasks` ───────────────────────────────────────
--
-- `tasks` is the personal board — lists, projects, assignees, the matrix axes,
-- the archive. A client project's steps share none of that geography: they are
-- ordered into four fixed phases, they belong to exactly one client project,
-- and the co-worker account has to be able to read them without being handed
-- the whole personal board. Reusing `tasks` would have meant a nullable
-- client_project_id on every row and a filter on every existing query.
--
-- The card *looks* like a board card on purpose — same priority themes, same
-- meta chips — but that is a rendering choice, not a shared table.
--
-- ── RLS ─────────────────────────────────────────────────────────────────────
--
-- Same posture as client_projects: reads and writes go through server actions
-- on the anon key, and the admin check lives in those actions. See the note in
-- supabase-client-projects.sql.

create extension if not exists pgcrypto;

-- ── 1. Schema ───────────────────────────────────────────────────────────────

-- The full roadmap, as written text. Lives on the project rather than in its
-- own table because there is exactly one per project and it is read whole.
alter table public.client_projects
  add column if not exists roadmap text not null default '';

create table if not exists public.client_project_tasks (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.client_projects(id) on delete cascade,
  title       text not null,
  description text not null default '',
  -- Which column the card sits in. 'parallel' is not a stage of the sequence —
  -- it is the work that runs alongside it, which is why it is a phase of its
  -- own rather than a flag.
  phase       text not null default 'next'
              check (phase in ('now','next','parallel','later')),
  -- Same four levels as the personal board, so the cards can share its
  -- priority themes (see PRIORITY_THEMES in components/TaskCardView).
  priority    text not null default 'none'
              check (priority in ('none','low','medium','high')),
  done        boolean not null default false,
  -- Free text: 'Domi', 'Magdolna', 'Simon'. Not a reference to `people` —
  -- the client project's owners are not necessarily rows on the personal board.
  owner       text not null default '',
  position    int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists client_project_tasks_project_idx
  on public.client_project_tasks(project_id, phase, position);

alter table public.client_project_tasks enable row level security;

drop policy if exists client_project_tasks_anon_all on public.client_project_tasks;

create policy client_project_tasks_anon_all
  on public.client_project_tasks
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- ── 2. Seed: a Fanó Magdolna projekt útiterve ───────────────────────────────
--
-- Csak akkor ír, ha a mező még üres, így a kézzel átszerkesztett útitervet egy
-- újrafuttatás nem írja felül.

update public.client_projects
   set roadmap = '## Mi ez
A Magdolnával tartott meeting és a GHL kezdőcsomag alapján. A sorrend nem önkényes: Magdolna maga kérte, hogy lépésenként menjünk, és „mindig az egyik folyamat befejezése hozza a másikat”.

## Kik
- Magdolna — ügyfél. Minden szöveget ő ír, ehhez kifejezetten ragaszkodik.
- Domi — kézi GHL beállítások és landingek. Ősztől suli mellett.
- Simon — automatizálás, integrációk, irány.
- Határidő: szeptember, akkor indulnak a hirdetések.

## Miért az iránytű-levél az első
A ~3300 fős listából rendszeresen csak ~500-an kapnak levelet. Ez a küldés aktiválja újra a többit, betagel mindenkit, és megmutatja, ki nyit meg egyáltalán. Enélkül minden későbbi szegmentálás vakon menne — és Magdolna szerint ebből jön be bevétel is.

## Eldöntendő
- Ki csinálja a kézi GHL beállítást? A kezdőcsomag Domira bízza az egészet, a meetingen viszont Magdolna a landingeket kérte Domitól, az automatizálást Simontól. Ez a kettő nem ugyanaz.
- Hány életterület aktív? A dokumentum nyolcat sorol, de maga is „6 vagy 8”-at ír. A fiókban látottak döntenek.
- Rendben van a küldési hitelesítés? Magdolna szerint beállította a korábbi hiba után, de a nagy küldés előtt látni kell.
- Magdolna gépe és a vírus. Ez blokkolja a Claude-os munkáját, és amíg megvan, a rendrakásnak sincs értelme.
- GHL admin belépés: a kód most Simon címére jön. Domi email címe is kell a meghívókhoz.

## Ami már megvan (ellenőrizendő a fiókban)
- Az iránytű kérdőív létezik és működik, kitöltések érkeznek bele.
- A kitöltés utáni visszaigazoló email kimegy, de még a régi születésnapi akciós szöveggel és foglalóval.
- A levélmappák részben megvannak; a „megrekedés” leveleit Magdolna már feltöltötte.
- Van legalább egy workflow az iránytű-kitöltőknek, benne egy 90 napos „gyűjtő” (Wait), ami jelenleg parkoltatja az embereket.
- Pipeline-ok életterületenként részben léteznek.
- A naptárral volt egy furcsaság: a születésnapi foglaló letiltott vagy törölt foglalásokat.
- A Facebook lead-űrlap létezik valahol a hirdetési fiókban, de a legutóbbi keresés nem találta.

## Magdolna jó észrevétele a hirdetésekről
Ahány hirdetési témakör, annyi szegmentált levélsorozat — de ha a hirdetésből érkező jól van tagelve, megkaphatja a már meglévő iránytű-sorozatot kis módosítással. Nem kell minden témához új sorozatot írni.

## Alapszabályok
- A szöveg Magdolnáé. Nem írunk és nem írunk át levelet, még helyesírást sem kérdés nélkül.
- Klónozz, ne szerkessz élőt. Működő workflow-t, sablont, űrlapot előbb lemásolunk.
- Nem törlünk. Ami feleslegesnek tűnik, azt kikapcsoljuk vagy átnevezzük („RÉGI – …”).
- Éles kontakton nem tesztelünk, csak tesztcímmel.
- Egyszerre egy változtatás, utána ellenőrzés.
- Változásnapló: dátum — mit állítottunk át — miért.
- Kontaktlistát (nevek, email-címek tömegével) nem másolunk ki sehova.

## Elszámolás és kapcsolattartás
- Vasárnaponként összeültök: mi készült el a héten, és mit ért.
- Utalás kb. kéthetente, hogy Domi lássa is a pénzt.
- Domi külön számláz — ő is, Magdolna is alanyi adómentes.
- A termékek (coach klón, előminősítő robot) nem óradíjban mennek.
- Magdolna és Domi: Messenger és telefon. A napi „ezt hogyan állítom be” kérdés ne Simonhoz menjen — előbb Claude, aztán a GHL súgója.
- Simonhoz: irány, új feladatkör, pénz, elakadt együttműködés.'
 where name = 'Fanó Magdolna'
   and coalesce(roadmap, '') = '';

-- ── 3. Seed: a lépések ──────────────────────────────────────────────────────
--
-- A `not exists` feltétel a teljes beszúrást kikapcsolja, ha a projektnek már
-- van akár egy lépése is — így egy második futtatás nem duplikál.

insert into public.client_project_tasks
  (project_id, title, description, phase, priority, owner, position)
select p.id, v.title, v.description, v.phase, v.priority, v.owner, v.position
  from public.client_projects p
 cross join (values
  -- ── Most ──
  ('Iránytű kérdőív levele a teljes listára',
   '~3300 fő, akikből rendszeresen csak ~500 kap levelet. Ez aktiválja újra a többit, betagel mindenkit, és megmutatja, ki nyit meg egyáltalán.
• Magdolna megírja a szöveget — vállalta, hogy aznap.
• Ajánlat: aki kitölti, választhat egy meditációt ajándékba. A meditációk készen vannak.
• Új mappa a levélnek, és bele a sorozat többi levele — Magdolna rakja össze.
• Külön workflow a listás küldésre, a hirdetésből érkezőktől függetlenül.
• Mindenki ugyanazt kapja ebben a körben; a szegmentálás a kitöltésből jön, nem a küldésből.',
   'now', 'high', 'Magdolna', 0),
  ('Kézbesíthetőség ellenőrzése küldés előtt',
   'Mielőtt a 3300 címre bármi megy:
• DKIM / domain-hitelesítés zöld az Email Services alatt.
• Leiratkozó link minden sablonban.
• Szakaszosan megy, a friss és aktív kontaktoktól kifelé — soha nem egyben.
Volt már egy rosszul sikerült nagy küldés; a küldő domain hírneve a tét.',
   'now', 'high', 'Simon', 1),
  ('Eldöntendő: ki csinálja a kézi GHL beállítást?',
   'A kezdőcsomag Domira bízza az egészet, a meetingen viszont Magdolna a landingeket kérte Domitól, az automatizálást Simontól. Tisztázni, mielőtt Domi belekezd.
A többi nyitott kérdés (hány életterület aktív, hitelesítés állapota, a vírusos gép, a GHL belépés) lent az útitervben.',
   'now', 'high', 'Simon', 2),

  -- ── Sorban ──
  ('01 · Leltár a GHL-ben',
   'Workflow-k, űrlapok, pipeline-ok, naptárak, levélmappák, email hitelesítés. Semmit nem állítunk át — ez a térkép.',
   'next', 'medium', 'Domi', 3),
  ('02 · Visszaigazoló email javítása',
   'A kitöltés utáni levél még a régi születésnapi szöveggel és foglalóval megy ki. Klónozni, a klónt javítani, a workflow-ban lecserélni.',
   'next', 'high', 'Domi', 4),
  ('03 · Naptár-teszt',
   'A születésnapi foglaló letiltott vagy törölt foglalásokat. Próbafoglalás ügyfélként, mielőtt éles link megy ki bárkinek.',
   'next', 'high', 'Domi', 5),
  ('04 · Pilot életterület: megrekedés',
   'Kitöltés, címke, pipeline, 4-5 leveles sorozat, foglalási link. Kilépés: aki foglalt vagy vásárolt. Az általános hírlevelet továbbra is kapja.',
   'next', 'medium', 'Domi', 6),
  ('05 · A 90 napos gyűjtő lecserélése',
   'A workflow Wait lépésében jelenleg parkolnak az emberek, mert a levelek nem voltak bekötve.',
   'next', 'medium', 'Domi', 7),
  ('06 · A többi életterület',
   'A pilot duplikálásával, egyesével. Amelyikhez nincs még levél, azt kihagyni és jelezni. Ellenőrizendő: 6 vagy 8 aktív terület?',
   'next', 'medium', 'Domi', 8),
  ('07 · Az 5 leveles kihívás workflow-ja',
   'Még nincs meg, és nem azonos a nyolcfelé ágazó iránytű-szegmentálással. Magdolna a leveleket már egy mappába gyűjtötte.',
   'next', 'medium', 'Simon', 9),
  ('08 · Teljes teszt életterületenként',
   'Tesztcímmel (nev+teszt1@gmail.com): jó levél, jó link, jó sorrend, leáll-e foglalás után. Éles kontakton soha.',
   'next', 'medium', 'Domi', 10),

  -- ── Párhuzamosan ──
  ('Integrációk',
   'A cél mindegyik mögött: a vásárló lássa a teljes termékkínálatot és meg tudja venni.
• WordPress ↔ GHL — össze van kötve, de nem jól. A vásárlói adat jusson át rendesen.
• Fizetés GHL-en belül is, ne csak a WordPressen.
• szamlazz.hu — Magdolnának megvan (vásárláskor automatikus számla). Ha van API, bekötjük.
• Hirdetési fiókok összekötése.
• Zapier/Make felmerült — Magdolna árérzékeny, előbb a natív megoldások.',
   'parallel', 'high', 'Simon', 11),
  ('Landingek és hirdetések',
   'Magdolna kérése: a landingeket Domi csinálja. A meetingen abban maradtatok, hogy most még ne vegyétek ide.
• Sorrend: Facebook először, az adatok alapján Google, és Magdolna nagyon akarja a Pinterestet.
• A videót előbb posztként teszi ki, és csak a jól reagálót hirdeti meg.
• Ha a hirdetésből érkező jól van tagelve, megkaphatja a meglévő iránytű-sorozatot kis módosítással — nem kell minden témához új.
• A Facebook lead-űrlap létezik valahol a hirdetési fiókban, de a legutóbbi keresés nem találta.',
   'parallel', 'low', 'Domi', 12),
  ('Magdolna Claude-setupja',
   '• A gépe vírusos — azóta a Claude Desktop is furán viselkedik. Vírusirtó-ajánlás kell neki.
• Claude Code-ot nyitogatta, ami repót kér tőle — neki nem az kell: desktop app, és ott csak egy mappát választ.
• Projektek, amiket akar: arculat és marketing tartalom, szövegíró, számisztika, tarot.
• Rendrakás a gépén és a Drive-on — a Claude egyszer rendbe rakta, de olyan logika szerint, amit ő nem ért.
• A cél emögött: a tanfolyami anyagok egyben, ebből saját tarot kártya, később könyv.',
   'parallel', 'medium', 'Simon', 13),

  -- ── Később ──
  ('Vásárlási előzmény szerinti sorozatok',
   'Aki Bach-virágcseppet vett, kapjon Bach-virág sorozatot, a végén meditáció-ajánlással. Integráció után.',
   'later', 'none', '', 14),
  ('Lista szűrése kurzusonként',
   'Ki jöhet sorselemző kurzusra, ki a Női ragyogásra, kit érdekel a párkapcsolati.
Mikor: a listás küldés adata után.',
   'later', 'none', '', 15),
  ('Megnyitás- és kattintásalapú minősítés',
   'Aki nem nyit, azzal Magdolna most nem akar foglalkozni.
Mikor: a listás küldés után.',
   'later', 'none', '', 16),
  ('Klubrendszer felépítése',
   'Létezik, de a lépésről lépésre bekötése nyitott.
Mikor: nincs dátum.',
   'later', 'none', '', 17),
  ('Vakfoltelemzés hirdetése',
   'A belépő terméke, ezt akarja hirdetni.
Mikor: a hirdetésekkel együtt.',
   'later', 'none', '', 18),
  ('Coach klón / előminősítő robot',
   'Külön termék, nem óradíjas munka — külön ajánlat.',
   'later', 'none', '', 19),
  ('Saját tarot kártya, majd könyv',
   'A kártya a szeptemberi tanfolyamokra kellene. A könyv több millió Ft, csak ha a bevétel megvan.',
   'later', 'none', '', 20)
 ) as v(title, description, phase, priority, owner, position)
 where p.name = 'Fanó Magdolna'
   and not exists (
     select 1 from public.client_project_tasks t where t.project_id = p.id
   );

-- ── 4. PostgREST schema cache ───────────────────────────────────────────────
--
-- Without this the API keeps answering with the old table list until it happens
-- to reload on its own.

select pg_notify('pgrst', 'reload schema');

-- ── 5. Ellenőrzés ───────────────────────────────────────────────────────────
--
-- Ennek 21-et és egy nem üres útitervet kell mutatnia.

select p.name,
       length(p.roadmap) as roadmap_hossz,
       count(t.id)       as lepesek
  from public.client_projects p
  left join public.client_project_tasks t on t.project_id = p.id
 where p.name = 'Fanó Magdolna'
 group by p.name, p.roadmap;
