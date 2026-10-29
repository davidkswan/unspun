// News feeds the scheduled search reads every run, in addition to the outlet
// watchlist and generic web search. Matching is loose, so most entries are
// false positives; every entry still needs the same relevance filtering as
// any other discovered article before being tracked.
//
// kind: 'google-news' feeds are the most reliable source: they caught every
// article the Oct 2026 run missed. Their links are news.google.com redirects,
// so find each article's real URL (search its exact title) before tracking.
// Tag those entries method: 'rss-feed'.
//
// kind: 'google-alert' feeds come from google.com/alerts ("Deliver to: RSS
// feed"). Tag those entries method: 'google-alerts'. The alert below was
// returning zero entries as of 2026-10-29; recreate it if it stays empty.
const GOOGLE_ALERTS_FEEDS = [
  { name: 'Google News: "Blandin Foundation"', kind: 'google-news',
    url: 'https://news.google.com/rss/search?q=%22Blandin+Foundation%22&hl=en-US&gl=US&ceid=US:en' },
  { name: 'Google News: Blandin grant / Blandin Itasca', kind: 'google-news',
    url: 'https://news.google.com/rss/search?q=Blandin+(grant+OR+Itasca+OR+%22Grand+Rapids%22)&hl=en-US&gl=US&ceid=US:en' },
  { name: 'Google Alert: Blandin Foundation', kind: 'google-alert',
    url: 'https://www.google.com/alerts/feeds/08156861287367278387/147971352772101032' },
];
