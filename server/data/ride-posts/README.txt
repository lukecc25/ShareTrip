ShareTrip ride post archive
============================

When a user creates or updates a ride on the dashboard, the server saves:

  ride-{id}.txt     Full export for that ride (human-readable + JSON for import)
  posts-log.txt     Append-only log of every create/update (one JSON object per line)

Use posts-log.txt or individual ride-*.txt files when migrating to another database.

Files are created automatically; this folder is gitignored except this README.
