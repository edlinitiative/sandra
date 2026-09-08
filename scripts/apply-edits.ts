import { getToken, api } from './gdoc-lib';

const H = (t: string) => `<span style="color:#9E0E33;font-weight:bold;letter-spacing:1px">${t}</span>`;
const HEAD = '<p style="text-align:center">' + H('ROTARACT CLUB OF NEW YORK AT THE UNITED NATIONS') + '</p>';
const h1 = (t: string) => `<h1 style="color:#C1123F">${t}</h1>`;
const h2 = (t: string) => `<h2 style="color:#C1123F">${t}</h2>`;

async function pushDoc(token: string, id: string, html: string, label: string) {
  const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media&supportsAllDrives=true`,
    { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'text/html' }, body: html });
  console.log(res.ok ? `  ✅ ${label}` : `  ❌ ${label}: ${res.status} ${(await res.text()).slice(0, 300)}`);
}

// ── DOC: Board Action Checklist (District/Associate step removed, renumbered) ──
const CHECKLIST = HEAD + h1('Board Action Checklist') +
`<p><i>Open items to make the 2026–27 plan official · Last updated: July 2026</i></p><hr>
<p>The documents are built and in the Drive. These are the human actions only the board can take — <b>ratify, fill, set, tag, and staff</b>. Work top to bottom; each item says where it lives.</p>` +
h2('1 · Ratify — make it official') +
`<ul>
<li>☐&nbsp; Adopt the Associate Member category by board + membership vote (the bylaw language is drafted in 02 - Membership).</li>
<li>☐&nbsp; Add "Associate" to the membership-types list in the RCUN Constitution so the two documents agree (01 - Governance &amp; Admin / Bylaws).</li>
<li>☐&nbsp; Confirm the 40% associate cap and the "may chair, no vote, no executive office" rule as adopted.</li>
</ul>` +
h2('2 · Fill — replace the [bracketed] placeholders') +
`<ul>
<li>☐&nbsp; President's name on the Executive Plan 2026–2027 (00 - Start Here).</li>
<li>☐&nbsp; Chair names where marked [add chair]: Events &amp; Fellowship, Communications &amp; Marketing, Professional Development.</li>
<li>☐&nbsp; Shared links used across templates: dues / payment link, club calendar, group-chat invite, committee-selection form, membership email, website, social handles &amp; hashtags.</li>
<li>☐&nbsp; Great Work Perks club link and company code (held by the Treasurer / Admin).</li>
</ul>` +
h2('3 · Set — decide the year’s numbers') +
`<ul>
<li>☐&nbsp; At July planning, set each committee's 3–5 measurable goals (the [bracketed] targets in each Charter and in the Executive Plan).</li>
<li>☐&nbsp; Set the budget threshold above which spending needs board approval (Budget Request Process).</li>
</ul>` +
h2('4 · Tag — keep the records clean') +
`<ul>
<li>☐&nbsp; Add an "Associate" status in the member tracker so quorum, retention, and reporting stay accurate (02 - Membership / 04 Administration / Current Members).</li>
<li>☐&nbsp; Assign each committee a communications point-person to feed the Communications pipeline.</li>
</ul>` +
h2('5 · Staff — stand up the committees') +
`<ul>
<li>☐&nbsp; Confirm chairs and functional leads for all five committees.</li>
<li>☐&nbsp; Ensure every member joins at least one committee within 30 days.</li>
<li>☐&nbsp; Add a Vice Chair to any committee that reaches ~5 active members or multiple concurrent projects.</li>
</ul>` +
h2('What is already done (no action needed)') +
`<ul>
<li>Five committee charters + operating guides, in each functional folder.</li>
<li>15 committee templates + the shared Committee Leadership Resources pack.</li>
<li>Associate Member language, definition, cap, and intake blurbs.</li>
<li>The 14-email membership lifecycle library.</li>
<li>The Committee Charters Index and Executive Plan 2026–2027.</li>
</ul>
<p><b>Owner &amp; deadline:</b> assign each unchecked box to a board member with a date at the first board meeting of the year. Re-open this list at each monthly board meeting until every box is checked.</p>`;

// ── DOC: Club Handbook ──
const HANDBOOK = HEAD + h1('Club Handbook') + `<p><i>Last updated: June 2026</i></p><hr>` +
h2('1 · Welcome &amp; About Us') +
`<p>The Rotaract Club of New York at the United Nations (RCUN) is a 501(c)(3) non-profit, young-professionals service club founded in 1996 — celebrating our 30th anniversary in 2026. We are part of Rotary District 7230 and the global Rotaract/Rotary family. We bring together members in their 20s–30s in the New York City area for community service, international service, professional development, and fellowship, with a special connection to the work and values of the United Nations.</p>` +
h2('2 · What We Do') +
`<ul>
<li><b>Service</b> — local volunteering (food pantries, park stewardship, meal service) and international service (relief drives, twin-club projects).</li>
<li><b>Fundraising</b> — our signature Annual Gala &amp; Fundraiser, the historic Rotary UN Day After-Party, and cause campaigns. Over 17 years the club has raised $137,000+ and directed $14,600+ directly to external causes.</li>
<li><b>Professional Development</b> — speaker panels and networking with UN, Rotary, and industry leaders.</li>
<li><b>Fellowship</b> — socials, cultural outings, and member celebrations that build a tight community.</li>
</ul>` +
h2('3 · How the Club Is Organized') +
`<p>The club is led by an elected Board, installed each July for the Rotaract year (July–June). Standard roles: President, Vice President, Secretary, Treasurer, Directors (Community Service, International Service, Professional Development, Events/Social, Public Relations/Marketing, Membership), the Immediate Past President, and Advisor(s) to the Board.</p>
<ul>
<li>Current board: see "Board Directory (Current)" in this folder.</li>
<li>Historical boards &amp; presidents: /01 - Governance &amp; Admin/Board Members by Year.</li>
<li>Role definitions: /01 - Governance &amp; Admin/Elections &amp; Transitions.</li>
</ul>` +
h2('4 · The Club Year (July–June)') +
`<p>Our year has a predictable rhythm — new board in July, recruitment in September, the UN Day fundraiser in the fall, inductions in winter and spring, the District Conference in April, and the Annual Gala in June. See "RCUN Annual Calendar" in this folder for the month-by-month plan and the full list of past events.</p>` +
h2('5 · Membership') +
`<p>We welcome new members year-round. Prospective members attend a few meetings, then join and pay annual dues.</p>
<ul>
<li>Applications: /02 - Membership/Applications.</li>
<li>Dues: /02 - Membership/Dues.</li>
<li>Onboarding &amp; follow-up templates: /02 - Membership/Onboarding.</li>
<li>Current roster: /02 - Membership/Current Members.</li>
</ul>` +
h2('6 · Running Meetings') +
`<p>General meetings and board meetings use standard agendas/templates.</p>
<ul>
<li>Templates &amp; examples: /01 - Governance &amp; Admin/Board Meeting Minutes (General Meeting Template, Board Meeting Template).</li>
<li>"Tips for Running a Meeting": /00 - Start Here/Board Onboarding Guide.</li>
</ul>` +
h2('7 · Finances &amp; Fundraising') +
`<ul>
<li>Budgets, bank &amp; payment records, donor records: /05 - Finance.</li>
<li>Fundraising, grants, sponsorships &amp; partnership proposals: /06 - Fundraising &amp; Sponsorships.</li>
<li>Tax-exempt status &amp; incorporation paperwork: /01 - Governance &amp; Admin/Nonprofit Verification &amp; Benefits.</li>
</ul>` +
h2('8 · The Shared Drive') +
`<p>Everything the club does lives in this shared drive, organized <b>by function</b> (not by year). Year folders exist only inside a function (e.g. Board Meeting Minutes/2025-2026). The Archive (99) preserves history; active folders hold only current or reusable material.</p>
<ul>
<li>Full map: /00 - Start Here/Folder Structure Guide.</li>
<li>Quick links: /00 - Start Here/Important Links.</li>
</ul>` +
h2('9 · Systems, Accounts &amp; Access') +
`<p>Club tools (email, website, social media, payment platforms, design tools) and who owns them are tracked in:</p>
<ul>
<li>/00 - Start Here/Rotaract Systems &amp; Access Register.</li>
<li>/00 - Start Here/Password &amp; Access Policy.</li>
</ul>
<p>Passwords are kept in the restricted board-only area: /01 - Governance &amp; Admin/_Restricted - Board Only/Credentials.</p>` +
h2('10 · For New Board Members') +
`<p>Welcome! Start here:</p>
<ul>
<li>/00 - Start Here/Board Onboarding Guide.</li>
<li>/00 - Start Here/Transition Checklist.</li>
<li>/01 - Governance &amp; Admin/Elections &amp; Transitions (changeover materials &amp; role definitions).</li>
</ul>
<p>Then read this handbook end to end, skim the Annual Calendar, and meet your committee.</p>` +
h2('11 · Key Documents at a Glance') +
`<ul>
<li>Constitution &amp; Bylaws — /01 - Governance &amp; Admin/Bylaws (RCUN Constitution 2019 is the current governing document).</li>
<li>Official Statement on Ukraine (2022) &amp; Board Operating Rules — /01 - Governance &amp; Admin/Policies.</li>
<li>Analytics dashboard (members, money, events, service) — /00 - Start Here/RCUN Club Analytics Dashboard.</li>
<li>Newsletter archive — /07 - Marketing &amp; Communications/Newsletters.</li>
</ul>
<p><i>Questions about this handbook? The President and Secretary maintain it. Please keep it current — update it each July at changeover.</i></p>`;

// ── DOC: Password & Access Policy ──
const PASSWORD = HEAD + h1('Password &amp; Access Policy') + `<hr>` +
h2('The Rules') +
`<ol>
<li>No critical platform may be owned solely by a personal email account. Personal accounts may have access; they may not be the only owner.</li>
<li>Every platform must have at least <b>two</b> org-controlled admins (owner + backup), recorded in the Systems &amp; Access Register (00 - Start Here).</li>
<li>Passwords are <b>never</b> stored in Google Drive, Slack, WhatsApp, or email. Drive documents say <b>who</b> owns access, not what the password is.</li>
<li>Use a password manager for shared credentials: Bitwarden Organizations (free for nonprofits) is recommended; 1Password and Dashlane also offer nonprofit plans.</li>
<li>Two-factor authentication is required on: bank, Stripe, Venmo, Google accounts, domain registrar, Firebase/Vercel. Recovery codes go in the password manager, not in Drive.</li>
<li>Access is reviewed quarterly and updated at every officer transition — <b>before</b> the outgoing officer leaves.</li>
<li>The public inbox (info@) must never be the owner of any critical tool.</li>
</ol>` +
h2('Immediate Action Items (June 2026)') +
`<ul>
<li>A file named "Passwords for PR.xlsx" currently sits in 99 - Archive. Migrate its contents to a password manager, then delete it and empty trash. Rotate any password it contains, since the file has been shared.</li>
<li>Stripe backup codes were emailed/downloaded in the past (stripe_backup_code.txt) — move to password manager and delete loose copies.</li>
<li>Create role-based accounts: admin@, president@, secretary@, treasurer@, membership@, marketing@, webmaster@, info@ on rotaractnyc.org and re-own platforms per the Systems &amp; Access Register.</li>
</ul>` +
h2('When Someone Leaves') +
`<ol>
<li>Remove their personal access from all platforms (use the Register as the checklist).</li>
<li>Rotate any shared passwords they knew.</li>
<li>Transfer ownership of anything their personal account owned.</li>
<li>Update the Register with the date of the audit.</li>
</ol>`;

async function markActionDone(token: string) {
  const SHEET = '1RqucNgLlvr57icWdeN2R8FUV77bHb35XubKhz7Onvkc';
  const meta = await api(token, `https://sheets.googleapis.com/v4/spreadsheets/${SHEET}?fields=sheets.properties.title`);
  const tab = meta.sheets[0].properties.title;
  const data = await api(token, `https://sheets.googleapis.com/v4/spreadsheets/${SHEET}/values/${encodeURIComponent(`'${tab}'!A1:G30`)}`);
  const rows: string[][] = data.values || [];
  let done = 0;
  for (let i = 0; i < rows.length; i++) {
    const action = (rows[i][1] || '').toLowerCase();
    if (action.includes('board directory')) {
      await api(token, `https://sheets.googleapis.com/v4/spreadsheets/${SHEET}/values/${encodeURIComponent(`'${tab}'!E${i + 1}`)}?valueInputOption=RAW`, 'PUT', { values: [['Done']] });
      done++; console.log(`  ✅ Action Items: "Board Directory" row ${i + 1} → Done`);
    }
  }
  if (!done) console.log('  ℹ️  Board Directory action row not found (left as-is)');
}

(async () => {
  const t = await getToken();
  console.log('Reformatting docs:');
  await pushDoc(t, '1n8UnQM65GcjtSmAVWaEBbwq7MjEcETuYzEtL05EX52g', CHECKLIST, 'Board Action Checklist (District step removed)');
  await pushDoc(t, '1LfX3gFIjBloyRrdvwrz-N1ljuYWHA6L6X8wQM-YyxAM', HANDBOOK, 'Club Handbook');
  await pushDoc(t, '15BAIHVrUukrYExagnrrR4lMoc7FWgiUl', PASSWORD, 'Password & Access Policy');
  console.log('Updating Action Items sheet:');
  await markActionDone(t);
  console.log('Done.');
})().catch((e) => { console.error('Fatal:', e.message); process.exit(1); });
