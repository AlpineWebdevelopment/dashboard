-- A Client Projects board második fele: a lépések egy projekten belül, és a
-- projekt teljes útiterve.
--
-- Run this in the SQL editor of the dashboard's OWN Supabase project — check
-- the project name in the top-left first (figvcskjslkvomoxubuq). Requires
-- supabase-client-projects.sql to have been run already.
--
-- Safe to re-run: every statement is guarded, so a second run is a no-op.
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

begin;

create extension if not exists pgcrypto;

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

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed: a Fanó Magdolna projekt lépései és útiterve
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Csak akkor fut, ha a projekt már létezik, és csak akkor ír, ha még nincs
-- lépése — így egy második futtatás nem duplikál semmit, és nem írja felül a
-- kézzel átszerkesztett útitervet sem.

do $seed$
declare
  pid uuid;
begin
  select id into pid from public.client_projects where name = 'Fanó Magdolna' limit 1;
  if pid is null then
    raise notice 'Nincs "Fanó Magdolna" projekt — a seed kimarad.';
    return;
  end if;

  update public.client_projects
     set roadmap = $md$## Mi ez
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
- Simonhoz: irány, új feladatkör, pénz, elakadt együttműködés.$md$
   where id = pid
     and coalesce(roadmap, '') = '';

  if exists (select 1 from public.client_project_tasks where project_id = pid) then
    raise notice 'A projektnek már vannak lépései — a seed kimarad.';
    return;
  end if;

  insert into public.client_project_tasks
    (project_id, title, description, phase, priority, owner, position)
  values
    -- ── Most ──
    (pid, 'Iránytű kérdőív levele a teljes listára',
     '~3300 fő. Magdolna írja a szöveget. Ajánlat: aki kitölti, választhat egy meditációt ajándékba. Ez aktiválja újra a listát és megmutatja, ki nyit meg egyáltalán.',
     'now', 'high', 'Magdolna', 0),
    (pid, 'Kézbesíthetőség ellenőrzése küldés előtt',
     'DKIM zöld az Email Services alatt, leiratkozó link a sablonban, és a 3300 cím szakaszosan megy, a friss kontaktoktól kifelé. Volt már egy rosszul sikerült nagy küldés.',
     'now', 'high', 'Simon', 1),
    (pid, 'Eldöntendő: ki csinálja a kézi GHL beállítást?',
     'A kezdőcsomag Domira bízza az egészet, a meetingen viszont Magdolna a landingeket kérte Domitól, az automatizálást Simontól. Tisztázni, mielőtt Domi belekezd.',
     'now', 'high', 'Simon', 2),

    -- ── Sorban ──
    (pid, '01 · Leltár a GHL-ben',
     'Workflow-k, űrlapok, pipeline-ok, naptárak, levélmappák, email hitelesítés. Semmit nem állítunk át — ez a térkép.',
     'next', 'medium', 'Domi', 3),
    (pid, '02 · Visszaigazoló email javítása',
     'A kitöltés utáni levél még a régi születésnapi szöveggel és foglalóval megy ki. Klónozni, a klónt javítani, a workflow-ban lecserélni.',
     'next', 'high', 'Domi', 4),
    (pid, '03 · Naptár-teszt',
     'A születésnapi foglaló letiltott vagy törölt foglalásokat. Próbafoglalás ügyfélként, mielőtt éles link megy ki bárkinek.',
     'next', 'high', 'Domi', 5),
    (pid, '04 · Pilot életterület: megrekedés',
     'Kitöltés, címke, pipeline, 4-5 leveles sorozat, foglalási link. Kilépés: aki foglalt vagy vásárolt. Az általános hírlevelet továbbra is kapja.',
     'next', 'medium', 'Domi', 6),
    (pid, '05 · A 90 napos gyűjtő lecserélése',
     'A workflow Wait lépésében jelenleg parkolnak az emberek, mert a levelek nem voltak bekötve.',
     'next', 'medium', 'Domi', 7),
    (pid, '06 · A többi életterület',
     'A pilot duplikálásával, egyesével. Amelyikhez nincs még levél, azt kihagyni és jelezni. Ellenőrizendő: 6 vagy 8 aktív terület?',
     'next', 'medium', 'Domi', 8),
    (pid, '07 · Az 5 leveles kihívás workflow-ja',
     'Még nincs meg, és nem azonos a nyolcfelé ágazó iránytű-szegmentálással. Magdolna a leveleket már egy mappába gyűjtötte.',
     'next', 'medium', 'Simon', 9),
    (pid, '08 · Teljes teszt életterületenként',
     'Tesztcímmel (nev+teszt1@gmail.com): jó levél, jó link, jó sorrend, leáll-e foglalás után. Éles kontakton soha.',
     'next', 'medium', 'Domi', 10),

    -- ── Párhuzamosan ──
    (pid, 'Integrációk',
     'WordPress és GHL rendesen összekötve, fizetés GHL-en belül is, szamlazz.hu API, hirdetési fiókok. A cél: a vásárló lássa a teljes termékkínálatot és meg tudja venni.',
     'parallel', 'high', 'Simon', 11),
    (pid, 'Landingek és hirdetések',
     'Magdolna kérése: a landingeket Domi csinálja. Sorrend: Facebook, majd adat alapján Google, aztán Pinterest. Szándékosan az alapfolyamat után.',
     'parallel', 'low', 'Domi', 12),
    (pid, 'Magdolna Claude-setupja',
     'Vírusos gép rendbe, desktop app repóválasztás helyett, projektek (arculat, szövegíró, számisztika, tarot), Drive-rendrakás az ő saját logikájával.',
     'parallel', 'medium', 'Simon', 13),

    -- ── Később ──
    (pid, 'Vásárlási előzmény szerinti sorozatok',
     'Aki Bach-virágcseppet vett, kapjon Bach-virág sorozatot, a végén meditáció-ajánlással. Integráció után.',
     'later', 'none', '', 14),
    (pid, 'Lista szűrése kurzusonként',
     'Ki jöhet sorselemző kurzusra, ki a Női ragyogásra, kit érdekel a párkapcsolati.',
     'later', 'none', '', 15),
    (pid, 'Megnyitás- és kattintásalapú minősítés',
     'Aki nem nyit, azzal Magdolna most nem akar foglalkozni.',
     'later', 'none', '', 16),
    (pid, 'Klubrendszer felépítése',
     'Létezik, de a lépésről lépésre bekötése nyitott.',
     'later', 'none', '', 17),
    (pid, 'Vakfoltelemzés hirdetése',
     'A belépő terméke, ezt akarja hirdetni.',
     'later', 'none', '', 18),
    (pid, 'Coach klón / előminősítő robot',
     'Külön termék, nem óradíjas munka — külön ajánlat.',
     'later', 'none', '', 19),
    (pid, 'Saját tarot kártya, majd könyv',
     'A kártya a szeptemberi tanfolyamokra kellene. A könyv több millió Ft, csak ha a bevétel megvan.',
     'later', 'none', '', 20);
end
$seed$;

commit;

-- PostgREST caches the schema; without this the API keeps answering with the
-- old table list until it happens to reload on its own.
select pg_notify('pgrst', 'reload schema');
