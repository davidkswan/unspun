// Outlets the scheduled search checks directly via `site:<domain> Blandin`
// searches, in addition to generic web search. Generic search often misses
// small hyperlocal MN papers, so this list exists to catch them directly.
// When a user flags a missed article from a new outlet, add that outlet's
// domain here so future runs check it automatically.
const OUTLET_WATCHLIST = [
  { name: 'KAXE Northern Community Radio', domain: 'kaxe.org' },
  { name: 'Grand Rapids Herald-Review',    domain: 'grandrapidsmn.com' },
  { name: 'Brainerd Dispatch',             domain: 'brainerddispatch.com' },
  { name: 'Bemidji Pioneer',               domain: 'bemidjipioneer.com' },
  { name: 'MPR News',                      domain: 'mprnews.org' },
  { name: 'MinnPost',                      domain: 'minnpost.com' },
  { name: 'Minnesota Reformer',            domain: 'minnesotareformer.com' },
  { name: 'The Daily Yonder',              domain: 'dailyyonder.com' },
  { name: 'Route Fifty',                   domain: 'route-fifty.com' },
  { name: 'Broadband Breakfast',           domain: 'broadbandbreakfast.com' },
  { name: 'The Chronicle of Philanthropy', domain: 'philanthropy.com' },
  { name: 'Pipestone County Star',         domain: 'pipestonestar.com' },
  { name: 'CEDA (rural economic dev.)',    domain: 'cedausa.com' },
  { name: 'Cloquet Pine Journal',          domain: 'pinejournal.com' },
  { name: 'Mesabi Tribune',                domain: 'mesabitribune.com' },
  { name: 'WTIP North Shore Community Radio', domain: 'wtip.org' },
  { name: 'Boreal Community Media',        domain: 'boreal.org' },
  { name: 'Citizen Portal (local gov. news)', domain: 'citizenportal.ai' },
];
