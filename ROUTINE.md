# Blandin Media Tracker: scheduled routine instructions

The scheduled Claude routine reads this file on every run and follows it. To change what the routine does, edit this file and push it to main. Nobody has to touch the routine's settings on claude.ai.

You are running unattended. Do not ask questions. Finish the run and end with the summary from step 13.

## Repo and folder

- Repository: davidkswan/unspun, branch `main`. The Netlify project `unspunmediatracker` publishes automatically from `main`.
- All site files are in the folder `Blandin Media Tracker`, and every path below is relative to it. The folder name has spaces, so quote it in shell commands.
- First run `git checkout main && git pull`.

## Catch-up rule

Read the newest entry in `SEARCH_LOG` (search-log.js). If it is more than 7 days old, widen every look-back window below to cover everything since that date.

## Steps

1. **Learn the data model.** Read `app.js`: THEMES, SENTIMENT_OPTS, PULL_OPTS, NARRATIVE_OPTS, GEO_LABELS, TYPE_LABELS, METHOD_LABELS, the tier convention (1 = home area, 2 = statewide rural, 3 = national, 0 = major metro), and the article shape (id, title, source, sourceType, url, date, geography, themes, notable, method, tier, prominence, sentiment, pullThrough, narrativeRole, snippet).

2. **Know what's already tracked.** Read `auto-articles.js` and collect every `url` and `title` in AUTO_MENTIONS. Skip anything already tracked. Compare titles too, not just URLs, because the same story can reach you through different links.

3. **Read the news feeds first. They are the most reliable source.** Read `google-alerts-feeds.js`. For every feed, fetch the URL and list its entries (title, source, date).
   - Consider entries from the last 60 days, or longer under the catch-up rule.
   - `google-news` links are news.google.com redirects. For each relevant, untracked entry, find the real article URL by searching its exact title (for example, WebSearch with `allowed_domains` set to the outlet's domain). Never store a news.google.com URL. If you can't find the real URL, mention the article in the summary instead of adding it.
   - Tag entries method `'rss-feed'` for google-news feeds, and `'google-alerts'` for google-alert feeds.
   - If a feed fails to load or is empty, say so in the summary.

4. **Check the outlet watchlist.** Read `outlet-watchlist.js`. For each outlet:
   - If it has a `page`, fetch that page and look for stories from the last 60 days.
   - Otherwise, WebSearch `site:<domain> Blandin Foundation` and also `site:<domain> Blandin grant`.
   - Small-town indexing lags, so use a 60-day look-back here as well.

5. **Check Blandin Foundation's own newsroom.** Its site returns HTTP 403 to fetch tools, so don't fetch it directly. Instead, WebSearch `site:blandinfoundation.org news-items` and `"Blandin Foundation" announces`, and treat any newsroom item from the last 4–5 months as a candidate. Open the article on another outlet if one covers the same announcement. In the summary, say whether any newsroom items were found.

6. **Generic search.** Search for third-party coverage from the last 14 days about "Blandin Foundation" and its themes: broadband and digital access, community wealth-building, rural placemaking, small communities, Native nations, and philanthropy and grants, in a Greater Minnesota or rural Minnesota context. Try several phrasings, including town names near Grand Rapids and Itasca County.

7. **Filter.** Keep only coverage that is genuinely about Blandin Foundation or its grants and programs, or substantive coverage of its themes in rural Minnesota. Drop:
   - obituaries
   - places named Blandin (Blandin Beach, Blandin Park) with no foundation involvement
   - Blandin Paper Company news
   - anything already tracked

   Before adding an article, open it to confirm what it says and its real publish date.

8. **Grow the watchlist.** If a relevant article comes from an outlet not in OUTLET_WATCHLIST, add `{ name, domain }` to it.

9. **Build entries** that exactly match the existing schema:
   - `id`: `'auto-' + YYYYMMDD + '-' + short-slug`
   - `date`: the article's real publish date, not today's date
   - `geography`: `'local'` | `'state'` | `'national'`
   - `themes`: keys from THEMES
   - `notable`: true only for high-visibility coverage or large or significant grants
   - `method`: as described in step 3, otherwise `'web-search'`
   - `tier`: 1 = Itasca County and surrounding home area, 2 = statewide rural (including small MN papers outside the home area and Blandin's own newsroom), 3 = national, 0 = major metro (for example, Star Tribune)
   - `prominence`: `'headline'` | `'body'` | `'passing'`
   - `sentiment`: `'very-positive'` | `'positive'` | `'neutral'` | `'critical'`. Judge the actual tone toward Blandin Foundation. Reserve 'critical' for genuinely negative coverage.
   - `pullThrough`: `'yes'` | `'partial'` | `'no'`
   - `narrativeRole`: `'primary'` | `'source'` | `'comparison'` | `'passing'`
   - Newsroom posts are always headline / very-positive / yes / primary, tier 2.
   - `snippet`: 1–2 factual sentences in your own words. Never copy article text.

10. **Append** the new entries to AUTO_MENTIONS in `auto-articles.js`, keeping every existing entry.

11. **Always log the run** in `search-log.js`, even if nothing was found. Append `{ date: 'YYYY-MM-DD', found: N, articles: [ { title, url } ] }`. If an entry for today already exists, update it instead of adding a duplicate.

12. **Check, then publish.**
    - Run `node --check` on every .js file you changed, and fix any failure first. Never push a file that fails the check, because one broken file takes the whole site down.
    - From inside `Blandin Media Tracker`, run: `git add -A . && git commit -m "<message>" && git push origin main`. Use "Add N new auto-discovered articles" when articles were found, or "Log search run — no new articles" when none were.
    - If the push is rejected, run `git pull --rebase origin main` and push again.
    - Never delete or edit `netlify.toml`. It keeps Netlify publishing every push.

13. **Summary.** End with:
    - Counts found per source: feeds, watchlist, newsroom, generic
    - Each article added: title, source, date, themes, sentiment, tier
    - Relevant articles you saw but couldn't add, and why
    - Whether OUTLET_WATCHLIST grew
    - Any feed, page or search that failed or came back empty
    - Whether the push to main succeeded, with the commit hash
