// Google Alerts RSS feeds the scheduled search checks directly, in addition
// to generic web search and the outlet watchlist. Google's keyword matching
// is loose, so most feed entries are false positives (unrelated stories that
// happen to share a word) — every entry still needs the same relevance
// filtering as any other discovered article before being tracked.
// To add an alert: create it at google.com/alerts, set "Deliver to" to
// "RSS feed", then copy the feed URL here.
const GOOGLE_ALERTS_FEEDS = [
  { name: 'Blandin Foundation', url: 'https://www.google.com/alerts/feeds/08156861287367278387/147971352772101032' },
];
