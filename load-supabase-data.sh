bunx convex import --table karts sample/supabase/karts.jsonl
bunx convex import --table users sample/supabase/users.jsonl
bunx convex import --table characters sample/supabase/characters.jsonl
bunx convex import --table tracks sample/supabase/tracks.jsonl
bunx convex import --table grandPrix sample/supabase/grand_prix.jsonl
bunx convex import --table races sample/supabase/races.jsonl
bunx convex import --table results sample/supabase/results.jsonl

bunx convex run migrations:runUpdateResults '{cursor: null}'
bunx convex run migrations:runUpdateRaces '{cursor: null}'
bunx convex run migrations:runUpdateGrandPrix '{cursor: null}'
bunx convex run migrations:runUpdateKarts '{cursor: null}'
bunx convex run migrations:runUpdateTracks '{cursor: null}'
bunx convex run migrations:runUpdateUsers '{cursor: null}'
bunx convex run migrations:runUpdateCharacters '{cursor: null}'
bunx convex run migrations:runUpdateGrandPrixStandings '{cursor: null}'
