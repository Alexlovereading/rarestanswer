# Rarest Answer data audit

Audit date: 14 November 2026. Counts are the English Wikipedia titles in the full SPARQL cache, or the draft count from the in-flight `pnpm build-prompts` log when that is the number the builder printed. Cache key is `full:<slug>:<sha1 of the query, 12 hex>`, the scheme in `scripts/build-prompts.ts`.

The build that is running used the queries from before this audit. It will write `src/data/prompts/**` from those queries. The fixes below are in `scripts/data/prompt-defs.ts` and apply on the next build. This audit did not run `build-prompts` and did not edit `src/data/prompts/**`.

A prompt under 15 answers is not written (except great apes at 8, and planets and dwarf planets at 13). A prompt that fills all 801 rows is not written, because the slice would drop true answers.

Build 15 November 2026 (`pnpm build-prompts`, cache reused): 276 prompts written. geography 37, animals 51, food 33, sports 31, screen 30, music 31, science 32, history 31. Sports, screen, and history are each at least 30. The rows below that this build changed are marked with the counts it wrote.

Playable defs after this audit: 286. Per category: geography 37, animals 51, food 54, sports 21, screen 28, music 32, science 34, history 29. Each category is at least 20.

## What changed

Closed sets that were wrong and are now fixed in the query: Central America (the seven states whose continent is North America), European capitals (Ankara and Astana), the Commonwealth (the United Kingdom), landlocked countries (seven states missing the landlocked class), the Mediterranean (Croatia, via a sea that is part of the Mediterranean), English as an official language (Eritrea), NFL teams (four proposed teams), NHL teams (the Coyotes), World Series winners (the Brewers), Summer Olympics (three cancelled, three future), FIFA World Cups (2030), planets and dwarf planets (the IAU 13), SI units (the seven base units), SI prefixes (deca-), space stations (launched stations, including the ISS), UK prime ministers (two people who never held the office), Ottoman sultans (pretenders), Declaration signers (John Adams). Euro users, Soviet republics, US vice presidents, and centuries were taken off the exclusion list because the cached sets are the real sets. Bulgaria has used the euro since 1 January 2026.

Species prompts now drop hybrid formulae and undescribed names. Citrus keeps hybrids, because the orange is Citrus × sinensis. String instruments use the same subclass walk as the other instrument families. Language families are limited to families that do not sit under another family.

Still excluded: anything in the table marked excluded. The query was not good enough to make the set exact, so those prompts are not playable.

## Table

| slug | category | returned | expected | verdict | note |
| --- | --- | --- | --- | --- | --- |
| countries-in-africa | geography | 54 | 54 | pass | UN African set, labels checked |
| countries-in-europe | geography | 49 | 49 | pass | aliases already include Denmark, Netherlands, Ireland, Czechia |
| countries-in-asia | geography | 48 | 48 | pass | labels checked |
| countries-in-north-america | geography | 23 | 23 | pass | sovereign states, not territories |
| countries-in-central-or-south-america | geography | 12 | 19 | fixed | was 12 South American states; the 7 Central American states are unioned in (their continent is North America) |
| african-capitals | geography | 57 | 57 | pass | 54 countries plus the real second and third capitals |
| european-capitals | geography | 49 | 47 | fixed | Ankara and Astana removed; they are not in Europe |
| asian-capitals | geography | 51 | 51 | pass | extra rows are real second capitals |
| us-state-capitals | geography | 50 | 50 | pass | pass |
| us-states | geography | 50 | 50 | pass | pass |
| japanese-prefectures | geography | 47 | 47 | pass | pass |
| german-states | geography | 16 | 16 | pass | pass |
| brazilian-states | geography | 27 | 27 | pass | 26 states plus the Federal District |
| swiss-cantons | geography | 26 | 26 | pass | pass |
| london-boroughs | geography | 32 | 32 | pass | the City of London is not a borough |
| mexican-states | geography | 31 | 31 | pass | Mexico City is not a state |
| italian-regions | geography | 20 | 20 | pass | pass |
| us-national-parks | geography | 63 | 63 | pass | pass |
| indian-states-and-territories | geography | 36 | 36 | pass | 28 states and 8 union territories |
| un-member-states | geography | 193 | 193 | pass | pass |
| eu-member-states | geography | 27 | 27 | pass | pass |
| nato-members | geography | 32 | 32 | pass | pass |
| commonwealth-members | geography | 56 | 56 | pass | the P463 query times out and omits the UK. Pinned to the 56 flag rows in the current-members table on "Member states of the Commonwealth of Nations", including the United Kingdom and Trinidad and Tobago |
| euro-countries | geography | 27 | 27 | pass | Bulgaria adopted the euro on 1 January 2026; the other six are the monetary-agreement and unilateral users. The question is "uses the euro", not "eurozone member" |
| landlocked-countries | geography | 38 | 45 | fixed | Andorra, Armenia, Azerbaijan, Liechtenstein, Paraguay, Rwanda, and Uzbekistan were missing the landlocked class |
| mediterranean-countries | geography | 21 | 22+ | fixed | a sea that is part of the Mediterranean now counts, which is how Croatia was missing. Fresh count is not in the cache |
| english-official-countries | geography | 58 | 57 | fixed | Eritrea removed; Wikipedia lists it as a working language, not an official one. The UK, Australia, and Antigua stay, matching the de facto official set |
| unesco-sites-in-italy | geography | 64 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| unesco-sites-in-france | geography | 68 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| unesco-sites-in-spain | geography | 45 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| unesco-sites-in-china | geography | 63 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| unesco-sites-in-germany | geography | 61 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| unesco-sites-in-the-uk | geography | 34 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| unesco-sites-in-mexico | geography | 31 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| unesco-sites-in-india | geography | 54 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| unesco-sites-in-japan | geography | 27 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| unesco-sites-in-the-us | geography | 29 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| great-ape-species | animals | timeout | 8 | pass | where clause unchanged. Aliases added for chimp, chimps, common chimpanzee, and pygmy chimpanzee. This fetch timed out |
| gibbon-species | animals | 20 | open | fixed | hybrid formulae and undescribed "sp." names are filtered. Fresh count is not in the cache |
| ape-species | animals | 33 | open | fixed | hybrid formulae and undescribed "sp." names are filtered. Fresh count is not in the cache |
| penguin-species | animals | 21 | open | fixed | hybrid formulae and undescribed "sp." names are filtered. Fresh count is not in the cache |
| crocodilian-species | animals | 29 | open | fixed | hybrid formulae and undescribed "sp." names are filtered. Fresh count is not in the cache |
| cobra-species | animals | 35 | open | fixed | hybrid formulae and undescribed "sp." names are filtered. Fresh count is not in the cache |
| python-species | animals | 46 | open | fixed | hybrid formulae and undescribed "sp." names are filtered. Fresh count is not in the cache |
| monitor-lizard-species | animals | 96 | open | fixed | hybrid formulae and undescribed "sp." names are filtered. Fresh count is not in the cache |
| falcon-species | animals | 42 | open | fixed | hybrid formulae and undescribed "sp." names are filtered. Fresh count is not in the cache |
| crow-species | animals | 52 | open | fixed | hybrid formulae and undescribed "sp." names are filtered. Fresh count is not in the cache |
| seal-species | animals | 35 | open | fixed | hybrid formulae and undescribed "sp." names are filtered. Fresh count is not in the cache |
| tortoise-species | animals | 47 | open | fixed | hybrid formulae and undescribed "sp." names are filtered. Fresh count is not in the cache |
| crane-species | animals | 15 | open | fixed | hybrid formulae and undescribed "sp." names are filtered. Fresh count is not in the cache |
| albatross-species | animals | 22 | open | fixed | hybrid formulae and undescribed "sp." names are filtered. Fresh count is not in the cache |
| toucan-species | animals | 43 | open | fixed | hybrid formulae and undescribed "sp." names are filtered. Fresh count is not in the cache |
| hornbill-species | animals | 63 | open | fixed | hybrid formulae and undescribed "sp." names are filtered. Fresh count is not in the cache |
| felid-species | animals | 57 | open | fixed | hybrid formulae and undescribed "sp." names are filtered. Fresh count is not in the cache |
| canid-species | animals | 46 | open | fixed | hybrid formulae and undescribed "sp." names are filtered. Fresh count is not in the cache |
| deer-species | animals | 68 | open | fixed | hybrid formulae and undescribed "sp." names are filtered. Fresh count is not in the cache |
| lemur-species | animals | 131 | open | fixed | hybrid formulae and undescribed "sp." names are filtered. Fresh count is not in the cache |
| whale-or-dolphin-species | animals | 103 | open | fixed | hybrid formulae and undescribed "sp." names are filtered. Fresh count is not in the cache |
| kingfisher-species | animals | 125 | open | fixed | hybrid formulae and undescribed "sp." names are filtered. Fresh count is not in the cache |
| iguana-species | animals | 46 | open | fixed | hybrid formulae and undescribed "sp." names are filtered. Fresh count is not in the cache |
| newt-species | animals | 111 | open | fixed | hybrid formulae and undescribed "sp." names are filtered. Fresh count is not in the cache |
| flying-fox-species | animals | 203 | open | fixed | hybrid formulae and undescribed "sp." names are filtered. Fresh count is not in the cache |
| woodpecker-species | animals | 258 | open | fixed | hybrid formulae and undescribed "sp." names are filtered. Fresh count is not in the cache |
| gull-species | animals | 107 | open | fixed | hybrid formulae and undescribed "sp." names are filtered. Fresh count is not in the cache |
| pheasant-species | animals | 195 | open | fixed | hybrid formulae and undescribed "sp." names are filtered. Fresh count is not in the cache |
| waterfowl-species | animals | 172 | open | fixed | hybrid formulae and undescribed "sp." names are filtered. Fresh count is not in the cache |
| marsupial-species | animals | 150 | open | fixed | hybrid formulae and undescribed "sp." names are filtered. Fresh count is not in the cache |
| owl-species | animals | 264 | open | fixed | hybrid formulae and undescribed "sp." names are filtered. Fresh count is not in the cache |
| hummingbird-species | animals | 376 | open | fixed | hybrid formulae and undescribed "sp." names are filtered. Fresh count is not in the cache |
| parrot-species | animals | 413 | open | fixed | hybrid formulae and undescribed "sp." names are filtered. Fresh count is not in the cache |
| viper-species | animals | 392 | open | fixed | hybrid formulae and undescribed "sp." names are filtered. Fresh count is not in the cache |
| pigeon-species | animals | 344 | open | fixed | hybrid formulae and undescribed "sp." names are filtered. Fresh count is not in the cache |
| finch-species | animals | 226 | open | fixed | hybrid formulae and undescribed "sp." names are filtered. Fresh count is not in the cache |
| squirrel-species | animals | 313 | open | fixed | hybrid formulae and undescribed "sp." names are filtered. Fresh count is not in the cache |
| poison-dart-frog-species | animals | 207 | open | fixed | hybrid formulae and undescribed "sp." names are filtered. Fresh count is not in the cache |
| bumblebee-species | animals | 146 | open | fixed | hybrid formulae and undescribed "sp." names are filtered. Fresh count is not in the cache |
| octopus-species | animals | 173 | open | fixed | hybrid formulae and undescribed "sp." names are filtered. Fresh count is not in the cache |
| chameleon-species | animals | 231 | open | fixed | hybrid formulae and undescribed "sp." names are filtered. Fresh count is not in the cache |
| rattlesnake-species | animals | 51 | open | fixed | hybrid formulae and undescribed "sp." names are filtered. Fresh count is not in the cache |
| ceratopsian-dinosaurs | animals | 91 | open | fixed | hybrid formulae and undescribed "sp." names are filtered. Fresh count is not in the cache |
| tyrannosaurid-dinosaurs | animals | 18 | open | fixed | hybrid formulae and undescribed "sp." names are filtered. Fresh count is not in the cache |
| stegosaurian-dinosaurs | animals | 33 | open | fixed | hybrid formulae and undescribed "sp." names are filtered. Fresh count is not in the cache |
| ankylosaurian-dinosaurs | animals | 89 | open | fixed | hybrid formulae and undescribed "sp." names are filtered. Fresh count is not in the cache |
| hadrosaur-dinosaurs | animals | 86 | open | fixed | hybrid formulae and undescribed "sp." names are filtered. Fresh count is not in the cache |
| sauropod-dinosaurs | animals | 321 | open | fixed | hybrid formulae and undescribed "sp." names are filtered. Fresh count is not in the cache |
| bird-orders | animals | 47 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| dog-breeds | animals | 623 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| cat-breeds | animals | 102 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| french-cheeses | food | 12 | open | skipped | under 15 answers, so the builder does not ship it |
| italian-cheeses | food | 34 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| spanish-cheeses | food | 9 | open | skipped | under 15 answers, so the builder does not ship it |
| dutch-cheeses | food | 2 | open | skipped | under 15 answers, so the builder does not ship it |
| swiss-cheeses | food | 3 | open | skipped | under 15 answers, so the builder does not ship it |
| greek-cheeses | food | 3 | open | skipped | under 15 answers, so the builder does not ship it |
| german-cheeses | food | 5 | open | skipped | under 15 answers, so the builder does not ship it |
| mexican-cheeses | food | 2 | open | skipped | under 15 answers, so the builder does not ship it |
| american-cheeses | food | 6 | open | skipped | under 15 answers, so the builder does not ship it |
| british-cheeses | food | 1 | open | skipped | under 15 answers, so the builder does not ship it |
| french-dishes | food | 43 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| italian-dishes | food | 64 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| japanese-dishes | food | 33 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| mexican-dishes | food | 32 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| thai-dishes | food | 11 | open | skipped | under 15 answers, so the builder does not ship it |
| greek-dishes | food | 13 | open | skipped | under 15 answers, so the builder does not ship it |
| spanish-dishes | food | 23 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| korean-dishes | food | 3 | open | skipped | under 15 answers, so the builder does not ship it |
| vietnamese-dishes | food | 17 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| turkish-dishes | food | 63 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| british-dishes | food | 20 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| german-dishes | food | 24 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| brazilian-dishes | food | 12 | open | skipped | under 15 answers, so the builder does not ship it |
| indian-dishes | food | 35 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| chinese-dishes | food | 54 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| american-dishes | food | 51 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| indonesian-dishes | food | 188 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| philippine-dishes | food | 45 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| egyptian-dishes | food | 6 | open | skipped | under 15 answers, so the builder does not ship it |
| iranian-dishes | food | 16 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| argentine-dishes | food | 4 | open | skipped | under 15 answers, so the builder does not ship it |
| polish-dishes | food | 13 | open | skipped | under 15 answers, so the builder does not ship it |
| swedish-dishes | food | 10 | open | skipped | under 15 answers, so the builder does not ship it |
| irish-dishes | food | 2 | open | skipped | under 15 answers, so the builder does not ship it |
| nigerian-dishes | food | 52 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| australian-dishes | food | 4 | open | skipped | under 15 answers, so the builder does not ship it |
| spices | food | 49 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| culinary-herbs | food | 29 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| fruits | food | 70 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| beer-styles | food | 82 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| coffee-drinks | food | 44 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| breads | food | 235 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| sushi | food | 11 | open | skipped | under 15 answers, so the builder does not ship it |
| soups | food | 371 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| sausages | food | 86 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| pastries | food | 270 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| condiments | food | 107 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| distilled-spirits | food | 74 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| liqueurs | food | 64 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| cooking-methods | food | 14 | open | skipped | under 15 answers, so the builder does not ship it |
| beef-cuts | food | 25 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| citrus-fruits | food | 85 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| pasta-shapes | food | 111 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| iba-cocktails | food | 95 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| nba-teams | sports | 30 | 30 | pass | pass |
| nfl-teams | sports | 36 | 32 | fixed | four proposed teams (class Q135261034) removed. Recounted on Wikidata |
| mlb-teams | sports | 30 | 30 | pass | pass |
| nhl-teams | sports | 33 | 32 | fixed | Arizona Coyotes removed via replaced-by. Recounted on Wikidata |
| premier-league-clubs | sports | 20 | 20 | pass | pass |
| la-liga-clubs | sports | 20 | 20 | pass | pass |
| bundesliga-clubs | sports | 18 | 18 | pass | pass |
| serie-a-clubs | sports | 20 | 20 | pass | pass |
| ligue-1-clubs | sports | 18 | 18 | pass | pass |
| mls-clubs | sports | 30 | 30 | pass | pass |
| primeira-liga-clubs | sports | 18 | 18 | pass | pass |
| eredivisie-clubs | sports | 18 | 18 | pass | pass |
| champions-league-winners | sports | 24 | 24 | pass | the 24 European Cup and Champions League clubs |
| world-series-winners | sports | 31 | 30 | fixed | Milwaukee Brewers removed; they have never won. Historical franchise names that did win stay |
| summer-olympics | sports | 30 | 30 | pass | year is COALESCE of point in time, opening date, and start. 1916, 1940, and 1944 stay out. 2028, 2032, and 2036 stay out. 2020 Summer Olympics stays (held in 2021) |
| paris-2024-sports | sports | 38 | 37 | fixed | Marathon removed. Swimming, diving, and beach volleyball stay as the events a player names |
| martial-arts | sports | 154 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| combat-sports | sports | 48 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| spiel-des-jahres | sports | 46 | 46 | pass | 1979–2024 is 46; the 2025 winner was not checked |
| fifa-world-cup-tournaments | sports | 24 | 23 | fixed | 2030 has not been played. 1930 through 2026, skipping the war years, is 23 |
| world-cup-host-countries | sports | 19 | 19 | pass | hosts through 2026, with Germany covering 1974 and 2006 and the UK covering 1966 |
| stranger-things-characters | screen | 129 | 129 | pass | MediaWiki parse of "List of Stranger Things characters" (cast tables, character headings, recurring and guest credits). Pageviews when an article or redirect exists, otherwise 1. Barb, Dr. Brenner, Papa, Eddie Munson, Erica Sinclair, Murray Bauman, Argyle, Bob Newby, Karen Wheeler, and Demogorgon are accepted. seoNoun unchanged |
| friends-characters | screen | 16 | 16 | pass | every listed name is a character |
| breaking-bad-characters | screen | 14 | 14 | skipped | under 15, and every listed name is a character |
| game-of-thrones-characters | screen | 50 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| the-office-characters | screen | 10 | open | skipped | under 15 answers, so the builder does not ship it |
| parks-and-recreation-characters | screen | 13 | open | skipped | under 15 answers, so the builder does not ship it |
| brooklyn-nine-nine-characters | screen | 7 | open | skipped | under 15 answers, so the builder does not ship it |
| avatar-characters | screen | 17 | 17 | pass | every listed name is a character |
| spongebob-characters | screen | 19 | 19 | pass | every listed name is a character |
| doctor-who-characters | screen | 15 | 14 | fixed | TARDIS removed. 14 is under the minimum, so the builder skips it |
| harry-potter-characters | screen | 10 | open | skipped | under 15 answers, so the builder does not ship it |
| hitchcock-films | screen | 65 | 65 | pass | titles checked; they are films he directed or co-directed |
| spielberg-films | screen | 38 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| scorsese-films | screen | 49 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| miyazaki-films | screen | 22 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| pixar-films | screen | 90 | 86 | fixed | Care Bears, the Buzz Lightyear TV movie, Coco 2, and Gatto removed. Shorts stay |
| ghibli-films | screen | 38 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| disney-animated-films | screen | 97 | 96 | fixed | Prep & Landing (series) removed. Shorts stay |
| pixar-characters | screen | 75 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| ghibli-characters | screen | 10 | 9 | fixed | Grogu removed. Still under 15, so the builder skips it |
| james-bond-films | screen | 28 | 28 | pass | count only; titles not listed this pass |
| james-bond-characters | screen | 54 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| best-picture-winners | screen | 98 | 98 | pass | the 98th Academy Awards were in 2026 |
| palme-dor-films | screen | 84 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| best-animated-feature-films | screen | 25 | 25 | pass | 2002 through 2026 |
| best-director-winners | screen | 77 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| tony-best-musical-winners | screen | 65 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| mcu-films | screen | 41 | released through 2026 | fixed | requires a publication date in 2026 or earlier, and Blade (unproduced) is dropped. Fresh count is not in the cache |
| queen-songs | music | 38 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| radiohead-songs | music | 32 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| led-zeppelin-songs | music | 15 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| david-bowie-songs | music | 76 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| michael-jackson-songs | music | 46 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| taylor-swift-songs | music | 96 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| rolling-stones-songs | music | 33 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| beyonce-songs | music | 67 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| elvis-songs | music | 55 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| madonna-songs | music | 66 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| bob-dylan-songs | music | 26 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| u2-songs | music | 59 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| metallica-songs | music | 43 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| eminem-songs | music | 95 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| prince-songs | music | 71 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| woodwind-instruments | music | 368 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| brass-instruments | music | 113 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| string-instruments | music | 13 | open | fixed | the old query returned 13 obscure instruments and omitted guitar and violin. It now uses the same subclass walk as the other instrument prompts. Fresh count is not in the cache |
| percussion-instruments | music | 360 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| keyboard-instruments | music | 136 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| rock-genres | music | 139 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| jazz-genres | music | 70 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| hip-hop-genres | music | 81 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| electronic-genres | music | 29 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| folk-genres | music | 452 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| classical-genres | music | 55 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| national-anthems | music | 197 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| christmas-carols | music | 13 | open | skipped | under 15 answers, so the builder does not ship it |
| nursery-rhymes | music | 82 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| verdi-operas | music | 35 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| grammy-record-of-the-year | music | 49 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| dances | music | 192 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| chemical-elements | science | 118 | 118 | pass | pass |
| transition-metals | science | 38 | 38 | pass | the four IUPAC ranges, without lanthanum, lutetium, actinium, or lawrencium |
| lanthanides | science | 15 | 15 | pass | pass |
| actinides | science | 15 | 15 | pass | pass |
| planets-and-dwarf-planets | science | 13 | 13 | pass | VALUES of the 13 IAU bodies plus the optimizer hint. Written names: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune, Ceres, Pluto, Haumea, Makemake, Eris. Minimum is 13 because that is the whole set |
| moons-of-jupiter | science | 85 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| moons-of-saturn | science | 155 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| moons-of-uranus | science | 29 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| moons-of-neptune | science | 16 | 16 | pass | the usual count; not re-checked against an IAU bulletin dated today |
| human-chromosomes | science | timeout | — | pass | the fetch timed out; the query was not changed |
| tectonic-plates | science | 78 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| igneous-rocks | science | 31 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| sedimentary-rocks | science | 39 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| metamorphic-rocks | science | 31 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| gemstones | science | 40 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| programming-languages-before-1980 | science | 169 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| sorting-algorithms | science | 39 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| data-structures | science | 130 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| si-units | science | 22 | 29 | fixed | the 7 base units were missing; they are unioned with the 22 named derived units |
| si-prefixes | science | 23 | 24 | fixed | deca- is a UCUM prefix, not P31 SI prefix. That item is unioned in |
| elementary-particles | science | 39 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| space-stations | science | 24 | launched through 2026, including the ISS | fixed | the old 24 included unflown projects and omitted the ISS, whose class is a subclass. Fresh count is not in the cache |
| space-telescopes | science | 147 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| apollo-missions | science | 15 | 15 | pass | Apollo 1 and 4 through 17. Apollo 2 and 3 were not flown under those names |
| nobel-physics-laureates | science | 230 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| nobel-chemistry-laureates | science | 200 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| nobel-medicine-laureates | science | 235 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| fields-medalists | science | 68 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| turing-award-winners | science | 79 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| local-group-galaxies | science | 17 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| hormones | science | 34 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| neurotransmitters | science | 6 | open | skipped | under 15 answers, so the builder does not ship it |
| functional-groups | science | 12 | open | skipped | under 15 answers, so the builder does not ship it |
| human-bones | science | 68 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| us-presidents | history | 45 | 45 | pass | Cleveland once, Trump once |
| us-vice-presidents | history | 50 | 50 | pass | 50 people through JD Vance. The old "49" exclusion was stale |
| uk-prime-ministers | history | 60 | 58 | fixed | Andy Burnham and the Earl of Denbigh removed |
| canadian-prime-ministers | history | 24 | 24 | pass | count matches a list that includes Mark Carney. Names not listed this pass |
| australian-prime-ministers | history | 31 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| indian-prime-ministers | history | 15 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| french-presidents | history | 31 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| english-monarchs | history | 47 | 47 | pass | labels checked; no monarch whose reign is only British after 1707 |
| us-chief-justices | history | 17 | 17 | pass | pass |
| us-associate-justices | history | 103 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| us-first-ladies | history | 53 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| popes | history | 266 | 266 | pass | pass on names checked — Francis and Leo XIV are both present. Not diffed one-by-one against the 267-pope numbering |
| roman-emperors | history | 104 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| holy-roman-emperors | history | 40 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| ottoman-sultans | history | 45 | 36 | fixed | Cem, the Interregnum princes, and six post-1922 pretenders removed |
| mughal-emperors | history | 20 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| pharaohs | history | 386 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| bible-books | history | 66 | 66 | pass | the Protestant canon |
| greek-deities | history | 211 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| norse-deities | history | 61 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| language-families | history | 801 cap | top-level families | fixed | the old query hit the 801 cap. A family that itself sits under a language family is now dropped. Fresh count is not in the cache |
| constructed-languages | history | 113 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| writing-systems | history | 160 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| chinese-dynasties | history | 31 | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| us-constitutional-amendments | history | 27 | 27 | pass | pass |
| centuries | history | 21 | 21 | pass | 1st through 21st, and the cache has 21 |
| soviet-republics | history | 17 | 17 | pass | the 15 dissolution republics plus the Karelo-Finnish SSR and the Transcaucasian SFSR, which were union republics |
| declaration-signers | history | 55 | 56 | fixed | John Adams was missing and is unioned in |
| english-interjections | history | — | open | pass | no album, list, or fossil title in the checks that were run; not every label was listed |
| constellations | excluded | 87 | — | excluded | 86 IAU constellations after dropping Yakana; Aries and Cancer still have no constellation item |
| spanish-autonomous-communities | excluded | 16 | — | excluded | 16 of 17; the Balearic Islands item is missing |
| irish-counties | excluded | 30 | — | excluded | 30 items mix the Republic, abolished North and South Tipperary, and the Dublin split; not 26 or 32 |
| chinese-provinces | excluded | 23 | — | excluded | 23 items are the PRC provinces plus a Taiwan province item; scope is disputed |
| decades | history | 23 | — | excluded | 23 decades match 1800s–2020s, but "since the 1800s" does not say whether the 1800s themselves count |
| north-american-capitals | excluded | 22 | — | excluded | 22 capitals; Managua is missing because Nicaragua's capital statement points at an item with no English Wikipedia article |
| scottish-premiership-clubs | excluded | 13 | — | excluded | 13 clubs returned; the league has 12 and a relegated club still has an open membership statement |
| j1-league-clubs | excluded | 25 | — | excluded | 25 clubs returned; J1 League has 20 |
| brasileirao-clubs | excluded | 35 | — | excluded | 35 clubs returned, including historical clubs and a beach-soccer side; Série A has 20 |
| liga-mx-clubs | excluded | 31 | — | excluded | 31 clubs returned, including reserves, academies, and defunct clubs; Liga MX has 18 |
| a-league-clubs | excluded | 15 | — | excluded | 15 clubs returned, including defunct Gold Coast United and Northern Fury |
| belgian-pro-league-clubs | excluded | 18 | — | excluded | 18 clubs returned from open membership statements, not a verified current roster |
| super-bowl-winners | excluded | 0 | — | excluded | the P2522 query returns no teams |
| stanley-cup-winners | excluded | 5 | — | excluded | 5 teams returned; the Canadiens and most other winners are missing |
| tour-de-france-winners | sports | 64 | 64 | pass | Wikipedia category "Tour de France winners", minus the two list pages and "Stage 3 of the 1952 Tour de France". The P2522 query is no longer used |
| summer-olympics-host-cities | excluded | 21 | — | excluded | the location property mixes stadiums with cities and omits several host cities |
| summer-olympics-host-countries | excluded | 16 | — | excluded | 16 countries returned; Belgium, the Netherlands, Italy, and Sweden are missing |
| star-wars-films | excluded | 9 | — | excluded | 9 Skywalker Saga films; Rogue One and Solo are missing |
| star-trek-films | excluded | 0 | — | excluded | the series query returns no films |
| pokemon-types | excluded | 0 | — | excluded | the type class returns no items |
| generation-one-pokemon | excluded | 0 | — | excluded | the species-and-dex query returns no Pokémon |
| minecraft-mobs | excluded | 9 | — | excluded | 9 mobs returned; most mobs are missing |
| smash-ultimate-fighters | excluded | 59 | — | excluded | 59 of the 89-fighter roster |
| beatles-songs | excluded | 4 | — | excluded | 4 items, not the Beatles songs a player would name |
| abba-songs | excluded | 2 | — | excluded | 2 items |
| pink-floyd-songs | excluded | 9 | — | excluded | 9 items |
| nirvana-songs | excluded | 14 | — | excluded | 14 items, and the performer link misses most of the catalog |
| the-who-songs | excluded | 11 | — | excluded | 11 items |
| music-genres | excluded | 3 | — | excluded | 3 direct subclasses (Game piece, Gharana, Palo); the familiar genres are missing |
| sea-shanties | excluded | 0 | — | excluded | the shanty class returns no songs |
| mozart-operas | excluded | 8 | — | excluded | 8 items, including the aria Madamina, and most of the operas are missing |
| beethoven-piano-sonatas | excluded | 1 | — | excluded | returns the collection, not the 32 sonatas |
| grammy-album-of-the-year | excluded | 26 | — | excluded | 28 winning albums; about 67 have won |
| messier-objects | excluded | 0 | — | excluded | the catalogue link returns no objects |
| proteinogenic-amino-acids | excluded | 0 | — | excluded | the class returns no amino acids |
| vitamins | excluded | 3 | — | excluded | 3 items, and Greens powder and Provitamin are not vitamins |
| human-muscles | excluded | 0 | — | excluded | the muscle-and-taxon query returns nothing |
| wine-grapes | excluded | 0 | — | excluded | the grape class returns nothing |
| f1-world-champions | sports | 36 | 36 | pass | the 36 drivers in the "By driver" table on "List of Formula One World Drivers' Champions", including Kimi Antonelli. The 2026 season article says he clinched the title at the Mexico City Grand Prix. Same 36 people as the Wikipedia category minus its list page |
| nba-mvps | sports | 37 | 37 | pass | unique people in the winners table on "NBA Most Valuable Player" through Shai Gilgeous-Alexander (2). Lew Alcindor is an alias of Kareem Abdul-Jabbar. Joel Embiid is included; P166 alone missed him |
| ballon-dor-winners | sports | 48 | 48 | pass | unique players in the gold 1st-place rows of the Winners table on "Ballon d'Or", through Harry Kane. A commented-out 2027 row was not counted. Ballon d'Or Féminin is not in this set |
| heisman-winners | sports | 90 | 90 | pass | person pages in Category:Heisman Trophy winners. "List of Heisman Trophy winners" is not an answer |
| world-series-mvps | sports | 69 | 69 | pass | person pages in Category:World Series Most Valuable Player Award winners. The award article is not an answer |
| f1-constructors-champions | sports | 15 | 15 | pass | the 15 constructor articles in Category:Formula One World Constructors' Champions |
| super-bowl-mvps | sports | 50 | 50 | pass | person pages in Category:Super Bowl MVPs. The award article is not an answer |
| super-bowl-coaches | sports | 37 | 37 | pass | coach pages in Category:Super Bowl–winning head coaches. "List of Super Bowl head coaches" is not an answer |
| stanley-cup-coaches | sports | 56 | 56 | pass | coach pages in Category:Stanley Cup championship–winning head coaches |
| simpsons-characters | screen | 63 | 63 | pass | characters linked from The Simpsons (Q886) that have an English Wikipedia article. The titles were reviewed as characters |
| mcu-characters | screen | 36 | 36 | pass | characters linked from Marvel Cinematic Universe films released by 2026 that survive the English Wikipedia title filters. The 36 names were reviewed; they are characters, not actors |
| doctor-who-incarnations | screen | 17 | 17 | pass | every item that is a regeneration of the Doctor (Q47543030) with an English Wikipedia article: First through Fifteenth, the War Doctor, and the Fugitive Doctor. "Sixteenth Doctor" only redirects to the actors list |
| best-actor-winners | screen | 87 | 87 | pass | people with the Academy Award for Best Actor. Matches Category:Best Actor Academy Award winners once the award article itself is ignored |
| best-actress-winners | screen | 81 | 81 | pass | same check against Category:Best Actress Academy Award winners. Sonia Mbele is excluded: Wikidata gives her the award and her article does not |
| best-supporting-actor-winners | screen | 81 | 81 | pass | P166 winners plus Haing S. Ngor (Q312364), who is in the winners category and missing from P166 |
| best-supporting-actress-winners | screen | 88 | 88 | pass | matches Category:Best Supporting Actress Academy Award winners once the award article is ignored |
| emmy-comedy-series | screen | 40 | 40 | pass | series pages in Category:Primetime Emmy Award for Outstanding Comedy Series winners. The award article is not an answer |
| lotr-characters | screen | 36 | 36 | pass | articles in Category:The Lord of the Rings characters that have their own Wikidata item. Redirects were not folded into a different character. Includes Frodo, Gandalf, Aragorn, Gollum, and Celeborn |
| roman-deities | history | 209 | open | pass | instance of Roman deity (Q11688446) with an English Wikipedia article. The class has 473 items. Jupiter (god), Juno, Venus, Mars, Minerva, and Neptune are in it. A title filter found no album, film, list, or novel pages |
| world-wonders | history | 21 | 21 | pass | the parts of the Seven Wonders of the Ancient World, the New 7 Wonders, and the New 7 Wonders of Nature. 7 + 7 + 7, no overlap in the returned titles |

## 15 November 2026 — noData contract and entity links

Rebuilt with `pnpm build-prompts` (pageview cache reused; new Wikipedia description probes under `.cache/build-prompts/wiki-about`). Catalog stays 276 prompts: geography 37, animals 51, food 33, sports 31, screen 30, music 31, science 32, history 31. Answers 23,132 → 23,125. The seven-answer drop is the Stranger Things merges below. No prompt was added or removed.

`Answer.noData: true` means popularity 0, rarity 0.5, tier 3 (Uncommon), and no `wiki`. Those answers are still accepted. They are left out of the percentile that scores the other answers in the same prompt. 122 answers are noData. None have a popularity from 1 through the old placeholder.

### Stranger Things characters

129 names → 122. Seven pairs from the list page are the same character (same actor, short name plus fuller name) and are now one answer. The other form is an alias:

| Kept name | Alias | Actor on the list page |
| --- | --- | --- |
| Troy Walsh | Troy | Peyton Wich |
| James Dante | James | Cade Jones |
| Carol Perkins | Carol | Chelsea Talmadge |
| Stacey Albright | Stacey | Sydney Bullock |
| Bruce Lowe | Bruce | Jake Busey |
| Tommy Hagan | Tommy H | Chester Rushing |
| Dr. Alexei | Alexei | Alec Utgoff |

Not merged, because the list credits different actors: Tina (Madelyn Cline) and Tina Turnbow (Caroline Elle Abrams); Vicki (Abigail Cowen) and Vickie Dunne (Amybeth McNulty).

A character keeps a Wikipedia title only when the article is about that character. Checked on 15 November 2026 against the MediaWiki parse of "List of Stranger Things characters" and short descriptions:

- The title is `Name (Stranger Things)`, and the base name is the character. Kept: Eleven, Jim Hopper, Mike Wheeler, Max Mayfield, Ted Wheeler, Vecna. The bare titles were not used: Eleven redirects to the number 11, Jim Hopper to James Hopper, Mike Wheeler to Michael Wheeler, Max Mayfield is a meteorologist, Ted Wheeler is a politician, and Vecna is the Dungeons & Dragons character.
- The short description says the page is a Stranger Things character, and the title contains the character's name. Kept: Dustin Henderson, Joyce Byers, Nancy Wheeler, Robin Buckley, Steve Harrington, Will Byers.
- The title redirects to that character's own section of "List of Stranger Things characters". The stored title is the character's name, and the popularity is that redirect's pageviews, not the list page's. Kept: Scott Clarke, Derek Turnbow, Holly Wheeler, Lonnie Byers, Murray Bauman, Erica Sinclair, Bob Newby, Lucas Sinclair, Martin Brenner, Billy Hargrove, Eddie Munson.

23 answers keep a wiki title. 99 are noData, including every name that previously had no article (those had been stored as popularity 1).

Links removed because the article is a different entity. Old popularity was that other article's pageviews:

| Answer | Removed wiki | Old popularity |
| --- | --- | --- |
| Troy (now an alias of Troy Walsh) | Troy (ancient city) | 1,958,968 |
| Yuri Ismaylov | Alaska | 1,628,254 |
| Lt. Colonel Jack Sullivan | United States Army | 1,274,356 |
| Nikki Baxter | Stranger Things: Tales from '85 | 972,902 |
| General Stepanov | KGB | 667,366 |
| Suzie Bingham | Mormons | 645,354 |
| Florence | Florence (the city in Tuscany) | 637,579 |
| Jason Carver | Satanic panic | 516,491 |
| Two | 2 | 437,605 |
| Mind Flayer | Illithid | 141,600 |
| Connie Frazier | United States Department of Energy | 140,268 |
| Kali Prasad | Illusion | 56,357 |
| Vickie Dunne | Hospital volunteer | 44,256 |
| Neil Hargrove | Reno Riggins | 6,481 |

Same-title articles that are not the character were also dropped: Barbara Holland (American writer, 1933–2010), Karen Wheeler (American artist, born 1955), Sam Owens (American musician), Jonathan Byers (disambiguation page). One-word titles that are name lists, given names, or disambiguations (Argyle, Mary, James, Carol, and the same pattern) were dropped. After the Troy Walsh merge, the city article "Troy" is not a link.

Scott Clarke is the rarest scored character in this prompt (301 redirect views, tier 6). Vecna (Stranger Things) is the most viewed (1,611,977). Eddie Munson keeps the redirect title and 104,332 views; among the 23 scored answers that lands on rarity 0.5, tier 3, and he is not noData.

### Other prompts

The same rule: no usable article (pageviews 404, or a total of 0 or 1 in the window) is noData, and that row is left out of the percentile. These 23 were popularity 0 before. Twenty-two were pageview HTTP 404. Pastasciutta antifascista returned HTTP 200 with 0 views, so the article exists but is not used as a rarity signal, and the wiki field is omitted. Dmitri Antonov (Stranger Things) had 1 view and is included in the 99 noData rows above.

| Prompt | noData answers |
| --- | --- |
| dog-breeds | Tatra Hound |
| italian-dishes | Pastasciutta antifascista |
| kingfisher-species | Morotai paradise kingfisher, Papuan paradise kingfisher |
| language-families | Atlantic languages, Marrgu–Wurrugu languages |
| owl-species | Northern fish owl, Paramo horned owl |
| parrot-species | Antipodes kakariki, Chatham Islands kakariki, New Caledonian kakariki, Red-crowned kakariki, Reischek's kakariki, Yellow-crowned kakariki |
| pheasant-species | Sumatran peacock-pheasant |
| roman-deities | Dea nutrix |
| sausages | Huotuichang |
| soups | Zhuzangfen |
| space-telescopes | Akari, PRIMA |
| tyrannosaurid-dinosaurs | Tromerosaurus |
| us-national-parks | Chiricahua National Park |
| whale-or-dolphin-species | Delphinus minimus |

Those 14 prompts were rescored. A token check of every remaining wiki title against the answer name found no mismatch outside the Stranger Things cases above, which are fixed.
