# Admin area: settings-style, calm

Agreed 2026-11-28. The admin panel and parser health looked like a developer tool: pill buttons, a
timeline with an icon, rail, avatar and a type pill that repeated the word beside it, bank cards with
bold counters, chips and an open table. Server health already had the look we want: rounded groups of
rows, a dot and the state in words.

## /admin

- Heading "Admin panel" at page size (20px, 500). No subtitle.
- For the server administrator: one group with two rows, Parser health and Server health, each with a
  dot, its state in words (Working / Worth a look / Not working) and a chevron. The states come from the
  requests the two pages already make; no backend change.
- Activity: the search takes the row; one "Filters" menu holds who, action and record type (applied as
  picked, a count on the button while any is on); the period is a second text menu with a check mark.
- An event is one line: who (the member's name, else the label), did what, to what; when on the right.
  No icon, rail, avatar or type pill. A click opens the same event modal with its rollback.
- Pagination shows only when there is more than one page.

The list and the filter bar are shared with /audit, which changes the same way.

## /admin/parsing

- A quiet "‹ Admin panel" link, the title, the existing subtitle.
- One group, a row per bank: logo, name, "Statements N", and only when something went wrong a dot and
  the problems in words (Failed, Held for review, Declined by its parser, New layout). Banks with a
  problem first, worst first, then the busiest.
- A click opens the row in place: all counts on one line, why statements were held, and the layouts
  as lines (parser, statements, first – last seen, "New layout" with a dot). Table headings and unknown
  words stay folded behind "Table headings".
- Loading, failure, empty and not-an-admin are a line inside the group, not coloured alerts.

## /admin/health

Unchanged apart from the shared heading and group components.

## Not done

No new strings: every label already existed in the admin, parsing, health and audit dictionaries.
