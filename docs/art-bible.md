# The Rarity Observatory — art bible

Owner: A1-HERO-MASCOT. First raster set: 2026-11-15. These are original AI-generated illustrations made with the built-in image generation tool, then resized and compressed with sharp. The external quality reference supplied in the brief was not used as an image reference; no characters, theme, layouts, copy, or assets were taken from it.

## World and rendering

A cozy fantasy astronomical observatory floats above soft clouds at night. A brass dome, stone walls, curved wooden balcony, telescope, and small warm lights make it welcoming. Every correct answer is a star; rarer stars appear higher in the sky. This is an art metaphor, not additional game mechanics.

Use high-quality painterly digital illustration with storybook / dimensional game-art forms. Preserve brush texture, crisp silhouettes, large readable shapes, rich jewel colors, soft cool rim light, and warm lantern light. Avoid flat vector substitutes, excessive tiny clutter, hard black outlines, photoreal humans, and glossy plastic surfaces. All artwork is static.

No text, letters, numerals, logos, watermarks, brands, UI screenshots, other games' characters, mines, caves, pickaxes, or miners. A blank scroll may show constellation dots and lines. The thinking pose's small star has a curling light trail instead of a printed question mark.

## Palette

Component/UI colors must consume the existing CSS variables; image paint colors below describe the raster palette only. The exact source of UI tier values remains `src/styles/globals.css`; names and points remain `src/lib/game/types.ts`.

| Role | Palette / token | Art form |
| --- | --- | --- |
| Night depth | `#14102e` | Deep indigo sky |
| Observatory indigo | `#2a1f8e` | Sky, stone shadow, distant islands |
| Warm light | Gold / `--gold` | Lantern, brass, dome highlights |
| Common | `--tier-1`; dark HSL 220 10% 74%; `#b6bac3` | Grey comet pebble |
| Familiar | `--tier-2`; dark HSL 174 52% 62%; `#6cd0c6` | Teal crystal shard |
| Uncommon | `--tier-3`; dark HSL 152 46% 60%; `#6ac89c` | Green aurora crystal |
| Rare | `--tier-4`; dark HSL 212 90% 72%; `#77b3f8` | Blue star-sapphire orb |
| Epic | `--tier-5`; dark HSL 272 85% 78%; `#ca97f7` | Violet nebula orb |
| Legendary | `--tier-6`; dark HSL 43 92% 62%; `#f7c545` | Radiant golden star crystal |

Raster treasures may use lighter highlights and darker facets. Keep their main color families and distinct silhouettes. The six tiers are Common, Familiar, Uncommon, Rare, Epic, Legendary; their points are 5, 10, 20, 40, 70, 100. These values belong in HTML, never only in a picture.

## Nova model sheet

Use `nova-waving` as the primary close-up identity reference and `hero-observatory` as the environment reference.

Nova is a small, round, chestnut-brown explorer owl with a cream face and belly, small brown feather markings, two short ear tufts, a tiny amber beak, short feathered wings, orange feet, and large friendly dark-brown eyes with amber highlights. Brass double-round aviator goggles sit pushed up on the forehead, never over the eyes. A teal scarf has two tails, narrow gold edging, and tiny celestial star embroidery. A little brass lantern glows warm gold. The lantern hangs at the side during the celebration pose so both wings can hold the golden star. No added clothing or accessories.

Expressions stay kind and readable: welcoming wave, thoughtful chin-wing and curling star trail, delighted star-holding celebration, gentle wide-eyed “oops,” and cozy closed-eye sleep. Surprised Nova must not look frightened or hurt. Preserve feather color, round proportions, scarf, goggles, and lantern across scenes.

## Files and integration

All public deliverables are under `public/images/world/`. Filenames include actual pixel dimensions. Use matching 1× and 2× files in `srcset`; no runtime image generation is required.

| Stem | Display size | 2× size | Purpose |
| --- | --- | --- | --- |
| `hero-observatory` | 520×780 | 1040×1560 | Portrait homepage hero |
| `hero-observatory-social` | 1200×675 | 2400×1350 | Landscape social adaptation |
| `nova-waving` | 160×160 | 320×320 | Welcome |
| `nova-thinking` | 160×160 | 320×320 | Waiting / thinking |
| `nova-celebrating` | 160×160 | 320×320 | Correct / celebration |
| `nova-surprised` | 160×160 | 320×320 | Wrong answer / timeout |
| `nova-sleeping` | 160×160 | 320×320 | Come back tomorrow |
| `how-reading` | 640×400 | 1280×800 | Read the prompt |
| `how-typing` | 640×400 | 1280×800 | Answer against the clock |
| `how-catching` | 640×400 | 1280×800 | Catch a rare star |
| `empty-observatory` | 640×400 | 1280×800 | 404 / no results |

Nova cutouts preserve real alpha transparency. Scene images are opaque. The social image is a separately generated landscape reframe of the approved portrait, preserving the observatory, Nova, telescope, and all six treasures instead of cutting off the portrait's top or bottom.

Use real `<img>` / `<picture>` elements, explicit width and height, and descriptive alt for meaningful art. Suggested English alt strings (the consuming component must keep its strings in the locale/copy source it owns):

- Hero: “Nova the owl watches six celestial treasures rise above the floating Rarity Observatory.”
- Waving: “Nova the owl waves while holding a glowing lantern.”
- Thinking: “Nova the owl thinks beneath a small curling star trail.”
- Celebrating: “Nova the owl holds a radiant golden star crystal.”
- Surprised: “Nova the owl looks surprised, with one wing against a cheek.”
- Sleeping: “Nova the owl sleeps beside a softly glowing lantern.”
- Reading: “Nova reads a constellation scroll on the observatory balcony.”
- Typing: “Nova types on a celestial typewriter beside a glowing hourglass.”
- Catching: “Nova catches a blue star-sapphire orb in a glass jar.”
- Empty: “Nova studies a star map on a quiet lookout above the clouds.”

Repeated art next to equivalent HTML can use `alt=""`. Keep instructions, tier names, score, status, and navigation in HTML. Lazy-load below the fold. Only the single homepage LCP hero may use `fetchpriority="high"`. Reserve each frame to avoid layout shift. Do not add schema for art. Any CSS motion around the assets must respect `prefers-reduced-motion`.

## Rebuilding optimized assets

`scripts/optimize-art.ts` is a shared CLI owned by A1; other agents may call it read-only. It writes only image exports and logs dimensions, bytes, and quality. It creates 1× and 2× variants, removes metadata, optionally trims alpha padding, and can preserve the entire subject with `--contain`. Quality starts at 78 and steps down only as required to meet the strict per-file byte ceiling. Budgets use KiB (1024 bytes). The poses use a stricter 24 KiB ceiling, alpha quality 70, and color quality 78 (75 for the waving 2× file); all are below 25,000 bytes. Actual alpha transparency remains intact. AVIF is retained only when it is smaller than the corresponding WebP; measured AVIF variants were larger for these heroes and poses, so this set uses WebP.

```sh
node --import tsx scripts/optimize-art.ts \
  --input .art-src/A1-HERO-MASCOT/hero-observatory.png \
  --output public/images/world/hero-observatory \
  --width 520 --height 780 --max-kb 220 --avif

node --import tsx scripts/optimize-art.ts \
  --input .art-src/A1-HERO-MASCOT/nova-waving.png \
  --output public/images/world/nova-waving \
  --width 160 --height 160 --max-kb 24 --alpha-quality 70 --trim --contain
```

The three how-to scenes and empty state use 640×400 plus 1280×800 at quality 78. Use `--position north` for `how-reading` to protect Nova's high ear tufts; the other scenes use the default center crop. Hero files use quality 78 and a 220 KiB ceiling (all also fall below 220,000 bytes).

PNG masters are excluded from public assets. A1 does not own the root `.gitignore`; a request to ignore `.art-src/` is recorded in the handoff. Until that rule exists, the local master working set is `/tmp/a1-hero-mascot-art-src/`; original built-in outputs also remain in the generated-images directory reported by the tool. Do not stage PNG masters. Once the folder is ignored, copy them into `.art-src/A1-HERO-MASCOT/`.

## Exact prompts and references

Built-in tool mode was used for every illustration. The portrait was generated from text. Waving used the portrait as its character/style reference; social used the portrait as its environment and identity reference; the other four poses used waving; all four scenes used waving plus the portrait. No external image was supplied to the generator.

The prompt set below is recorded verbatim. File resizing, center cropping to exact ratios, transparent-padding trimming, and compression are done by sharp; no hand-painted postprocessing or background-removal substitute was used.

### Portrait hero

```text
Use case: illustration-story
Asset type: polished browser game homepage hero, portrait 2:3, intended display 520x780 (high resolution master).
Primary request: The Rarity Observatory, a cozy fantasy astronomical observatory floating above clouds at night. High-quality richly painterly digital illustration, storybook / dimensional game key art, premium carefully painted surfaces, crisp silhouettes, soft rim lighting, cinematic depth. No typography anywhere.
Scene: a round stone observatory with a warm golden lit domed roof, curved wooden balcony and brass telescope floats on a small island above soft lavender-blue clouds. The night sky is deep indigo (#14102e through #2a1f8e), jewel tones, warmly inviting. A readable rising diagonal of SIX celestial treasures leads upward through sky layers: low on the clouds a grey comet pebble (#b6bac3), then teal crystal shard (#6bcfc5), green aurora crystal (#6bc89d), blue star-sapphire orb (#77b7f8), violet nebula orb (#cca0f7), finally a radiant golden star crystal (#f7c645) near the top with a luminous halo. These are magical stars in the sky, not UI badges.
Mascot Nova on the balcony clearly visible next to the telescope, roughly a fifth of the full image height: a small ROUND explorer OWL, warm chestnut-brown feathers, cream face and belly with tiny brown feather marks, very large friendly dark brown eyes with amber highlights, two small ear tufts, tiny amber beak, short wings and orange feet. Brass double round aviator goggles pushed UP on the forehead (never worn over eyes), a soft teal scarf tied at neck with two small tails, a little brass lantern with glowing gold light hanging beside one wing. Friendly confident expression, looking up toward the golden star.
Composition: single tall complete painted scene, observatory and Nova in lower-middle, luminous stars ascending around the dome into upper sky, clouds at bottom, gold crystal clear at top, keep all key subjects comfortably away from edges; cinematic vertical depth with restrained magical star motes. Observatory feels cozy and handcrafted, avoid excessive tiny clutter. No text, numbers, letters, signs, logos, watermarks, UI, frames, brands, other games' characters, mines, caves, pickaxes or miners. Original sky observatory world.
```

### Social hero adaptation

```text
Use case: identity-preserve illustration-story.
Asset: landscape 16:9 social crop / adaptation of the supplied portrait hero, no text.
Input image 1 is the approved observatory hero. Preserve the exact world, observatory architecture, Nova design, materials and painterly dimensional storybook art quality. Recompose its key subjects into a WIDE 16:9 view so none are cropped: floating stone observatory and cozy brass dome at left, wooden balcony and brass telescope lower left-center, the same small round chestnut-brown owl Nova with cream face/belly, brass goggles UP on forehead, teal scarf, little golden lantern. Soft clouds across bottom. Six celestial treasures arc upward from low grey comet pebble, teal shard, green aurora crystal, blue star-sapphire orb, violet nebula orb to radiant golden star crystal high at right. All six separate, full silhouettes. Deep indigo night #14102e to #2a1f8e, rich jewel tones, warm lantern gold, soft rim lighting, restrained stars. Keep Nova, telescope and golden star comfortably within central safe region, full observatory floating island visible. Breathtaking polished game illustration with readable large forms and painterly detail. No text, letters, numbers, logos, watermarks, typography, borders, UI, brands, mines, caves, miners or pickaxes.
```

### Nova waving (canonical character reference)

```text
Use case: identity-preserve illustration-story.
Asset: Nova mascot waving, true transparent background cutout, high resolution square, full body centered with generous transparent padding, no backdrop, no ground shadow slab.
Input image 1 is the CHARACTER AND PAINTING STYLE reference only. Create the EXACT same owl as on that balcony, same round small chestnut-brown explorer owl, cream heart-shaped face and soft belly with tiny brown feather marks, big friendly dark-brown eyes with amber reflections, two small ear tufts, tiny amber beak, short wings and orange feet. Identical brass double round aviator goggles pushed UP on forehead, teal scarf tied at neck with two tails, small brass lantern glowing warm gold. Goggles never cover eyes.
Pose: Nova stands facing slightly three-quarter toward viewer, smiling warmly, raises one feathered wing in a welcoming wave, holds the little glowing brass lantern with the other wing beside the body. Whole owl including ear tufts, scarf ends, feet, lantern and raised wing comfortably inside frame. Expressive friendly game companion.
High-quality painterly digital illustration, dimensional storybook game art, individually painted feathers, crisp silhouette, teal and gold jewel accents, soft warm lantern key light and subtle cool indigo rim light. Preserve same design and proportions as reference, no scene. Actual alpha transparency, no background color, no checkerboard drawn in image. No text, letters, numbers, punctuation, logos, watermarks, brands, mines, caves, pickaxes or miner clothing.
```

### Nova thinking

```text
Use case: identity-preserve illustration-story.
Asset: Nova mascot THINKING, true transparent background, square, whole body with generous padding.
Input image 1 is the EXACT approved mascot design. Preserve same proportions, chestnut brown feather colors, cream face and belly with tiny brown markings, big dark brown eyes with amber reflections, two small ear tufts, tiny amber beak, orange feet, brass double round goggles pushed UP on forehead, teal scarf with narrow gold trim and little star embroidery, little warm gold glowing brass lantern.
Pose only changes: Nova tilts head thoughtfully toward upper left, one short feathered wing tucked against chin, other wing holds lantern by side, curious friendly closed-beak expression. A tiny golden star floats above beside a curling luminous stardust trail that subtly suggests a question shape; do not draw a printed question mark or any text glyph. Entire owl, scarf tails, lantern and small star visible inside frame. Premium painterly dimensional storybook game art, same feather texture and face as reference, warm gold light and subtle cool violet rim lighting, crisp clean silhouette. Actual alpha transparent background, no scenery, no drawn checkerboard, no matte, no text, letters, numbers, logos, watermarks or other characters.
```

### Nova celebrating

```text
Use case: identity-preserve illustration-story.
Asset: Nova mascot CELEBRATING cutout for polished browser game, square high resolution, whole owl comfortably within frame, genuine alpha transparent background.
Input image 1 is the EXACT approved Nova design; preserve same head/body proportions and illustration style: small ROUND chestnut-brown explorer owl, soft cream face and belly with tiny brown feather markings, very big friendly dark brown eyes with amber reflections (when open), two small ear tufts, tiny amber beak, short feathered wings, orange feet. Brass double round aviator goggles UP on forehead, teal scarf with narrow gold trim and small star embroidery and two tails. Little brass lantern with warm gold glow. Do not change outfit or species. Goggles never cover eyes.
Style: premium painterly digital illustration, dimensional storybook game art, softly brushed feather textures, richly painted gold and teal, clean crisp silhouette, warm lantern lighting with soft cool indigo/violet rim. No background scene, no ground slab, no solid background, no painted checkerboard, no text, letters, numbers, logos, brands, watermarks, or other characters. No mines, caves, miners or pickaxes.
Pose: Nova beams happily at the viewer, body lifted slightly in joyful celebration, both wings proudly cradle a radiant GOLDEN STAR CRYSTAL in front of chest. Crystal is a faceted magical six-point celestial star, warm yellow-gold, full silhouette; it illuminates Nova's face. The little brass lantern hangs from a small belt loop at Nova's side so it stays visible but leaves wings free. A few small gold sparkle motes surround star. Keep owl round and compact, whole feet and scarf tails in view.
```

### Nova surprised

```text
Use case: identity-preserve illustration-story.
Asset: Nova mascot SURPRISED cutout for polished browser game, square high resolution, whole owl comfortably within frame, genuine alpha transparent background.
Input image 1 is the EXACT approved Nova design; preserve same head/body proportions and illustration style: small ROUND chestnut-brown explorer owl, soft cream face and belly with tiny brown feather markings, very big friendly dark brown eyes with amber reflections (when open), two small ear tufts, tiny amber beak, short feathered wings, orange feet. Brass double round aviator goggles UP on forehead, teal scarf with narrow gold trim and small star embroidery and two tails. Little brass lantern with warm gold glow. Do not change outfit or species. Goggles never cover eyes.
Style: premium painterly digital illustration, dimensional storybook game art, softly brushed feather textures, richly painted gold and teal, clean crisp silhouette, warm lantern lighting with soft cool indigo/violet rim. No background scene, no ground slab, no solid background, no painted checkerboard, no text, letters, numbers, logos, brands, watermarks, or other characters. No mines, caves, miners or pickaxes.
Pose: Nova looks surprised but friendly, eyes opened wide, beak a small open O, ear tufts lifted, one feathered wing raised to the cheek, other wing holds glowing lantern down by side. Gentle “oops” reaction for a wrong guess or clock running out, never terrified, hurt or sad. Whole owl, feet, ear tufts, scarf tails and lantern in view. No floating punctuation or symbols.
```

### Nova sleeping

```text
Use case: identity-preserve illustration-story.
Asset: Nova mascot SLEEPING cutout for polished browser game, square high resolution, whole owl comfortably within frame, genuine alpha transparent background.
Input image 1 is the EXACT approved Nova design; preserve same head/body proportions and illustration style: small ROUND chestnut-brown explorer owl, soft cream face and belly with tiny brown feather markings, very big friendly dark brown eyes with amber reflections (when open), two small ear tufts, tiny amber beak, short feathered wings, orange feet. Brass double round aviator goggles UP on forehead, teal scarf with narrow gold trim and small star embroidery and two tails. Little brass lantern with warm gold glow. Do not change outfit or species. Goggles never cover eyes.
Style: premium painterly digital illustration, dimensional storybook game art, softly brushed feather textures, richly painted gold and teal, clean crisp silhouette, warm lantern lighting with soft cool indigo/violet rim. No background scene, no ground slab, no solid background, no painted checkerboard, no text, letters, numbers, logos, brands, watermarks, or other characters. No mines, caves, miners or pickaxes.
Pose: Nova is peacefully SLEEPING curled in a small round seated pose with feet tucked just visible, head resting into soft teal scarf, eyes gently closed with a tiny contented smile; goggles remain pushed UP on forehead. A wing rests against the little brass lantern sitting beside Nova, still glowing softly. Feathered body round and cozy. Whole owl, tufts, scarf and lantern in view. No Z letters, no moon backdrop, no bedding or other scenery.
```

### Reading the prompt

```text
Use case: identity-preserve illustration-story.
Asset: polished browser game how-to scene, WIDE 8:5 composition (640x400 display), one complete painterly image, no text.
Input image 1 is the approved EXACT Nova mascot design; image 2 is the observatory WORLD and painting reference. Preserve BOTH: Nova is a small round chestnut-brown owl, cream face/belly with brown feather marks, large dark brown eyes with amber reflections, tiny amber beak, short feathered wings, orange feet, two little ear tufts, brass round aviator goggles pushed UP on forehead, teal scarf with gold trim and little gold star embroidery, two tails. A small brass lantern glows warmly near Nova. Never put goggles over eyes. The Rarity Observatory is a cozy stone-and-wood sky observatory floating above soft clouds at night, brass dome, wooden balcony, brass astronomical objects.
Style: high-quality painterly digital illustration, dimensional storybook / premium game art, crisp readable silhouette, rich jewel tones, deep indigo #14102e to #2a1f8e, warm gold lantern key light, soft cool violet rim light, soft painted clouds, careful rich materials. Focus on a few large readable forms, avoid clutter. Keep owl and main props comfortably inside the 8:5 frame. No text, letters, numbers, words, logos, brands, watermarks, UI screenshots, symbols resembling written language, mines, caves, miners, pickaxes or other games' characters.
Scene request: On the observatory balcony, Nova curiously reads an unrolled warm parchment prompt scroll spread on a small wooden desk. The parchment contains ONLY a simple elegant constellation illustration of connected stars, absolutely no writing, letters or numbers. Nova leans forward with engaged big eyes, one wing holds the scroll edge, little brass lantern on desk pools warm light. A brass telescope and dome softly out of focus in the background, indigo sky and clouds through the open balcony. The scroll and Nova are the clear focal points, both fully visible.
```

### Typing against the clock

```text
Use case: identity-preserve illustration-story.
Asset: polished browser game how-to scene, WIDE 8:5 composition (640x400 display), one complete painterly image, no text.
Input image 1 is the approved EXACT Nova mascot design; image 2 is the observatory WORLD and painting reference. Preserve BOTH: Nova is a small round chestnut-brown owl, cream face/belly with brown feather marks, large dark brown eyes with amber reflections, tiny amber beak, short feathered wings, orange feet, two little ear tufts, brass round aviator goggles pushed UP on forehead, teal scarf with gold trim and little gold star embroidery, two tails. A small brass lantern glows warmly near Nova. Never put goggles over eyes. The Rarity Observatory is a cozy stone-and-wood sky observatory floating above soft clouds at night, brass dome, wooden balcony, brass astronomical objects.
Style: high-quality painterly digital illustration, dimensional storybook / premium game art, crisp readable silhouette, rich jewel tones, deep indigo #14102e to #2a1f8e, warm gold lantern key light, soft cool violet rim light, soft painted clouds, careful rich materials. Focus on a few large readable forms, avoid clutter. Keep owl and main props comfortably inside the 8:5 frame. No text, letters, numbers, words, logos, brands, watermarks, UI screenshots, symbols resembling written language, mines, caves, miners, pickaxes or other games' characters.
Scene request: Inside the cozy observatory by an arched open sky window, Nova types thoughtfully using both feathered wings on a compact handcrafted brass-and-wood celestial typewriter with BLANK unmarked keys. A single small gold star glows in the typewriter's parchment, absolutely no writing or letters. A large elegant brass hourglass filled with luminous gold sand stands beside the typewriter, emphasizing time passing. Nova's little brass lantern beside desk, warm gold light, cool indigo sky and stars behind window. Nova's whole upper body and typewriter and full hourglass clearly visible. It is a charming astronomical instrument, not a computer screenshot.
```

### Catching the rare star

```text
Use case: identity-preserve illustration-story.
Asset: polished browser game how-to scene, WIDE 8:5 composition (640x400 display), one complete painterly image, no text.
Input image 1 is the approved EXACT Nova mascot design; image 2 is the observatory WORLD and painting reference. Preserve BOTH: Nova is a small round chestnut-brown owl, cream face/belly with brown feather marks, large dark brown eyes with amber reflections, tiny amber beak, short feathered wings, orange feet, two little ear tufts, brass round aviator goggles pushed UP on forehead, teal scarf with gold trim and little gold star embroidery, two tails. A small brass lantern glows warmly near Nova. Never put goggles over eyes. The Rarity Observatory is a cozy stone-and-wood sky observatory floating above soft clouds at night, brass dome, wooden balcony, brass astronomical objects.
Style: high-quality painterly digital illustration, dimensional storybook / premium game art, crisp readable silhouette, rich jewel tones, deep indigo #14102e to #2a1f8e, warm gold lantern key light, soft cool violet rim light, soft painted clouds, careful rich materials. Focus on a few large readable forms, avoid clutter. Keep owl and main props comfortably inside the 8:5 frame. No text, letters, numbers, words, logos, brands, watermarks, UI screenshots, symbols resembling written language, mines, caves, miners, pickaxes or other games' characters.
Scene request: Outside on the wooden observatory balcony above night clouds, Nova joyfully catches a tiny brilliant BLUE STAR-SAPPHIRE ORB into an open clear glass jar held carefully with both feathered wings. The orb floats just above the open jar mouth with a short magical blue trail entering the jar; it glows and illuminates Nova's amazed happy face. The jar is large, unmistakably clear, with brass rim and cork resting on nearby wood; no labels. Nova's small golden brass lantern hangs at side, teal scarf tails lift gently. Dome at far edge, glorious deep indigo starlit sky and clouds. Whole Nova and jar clearly visible. Only a few restrained blue sparkles around the rare orb.
```

### Empty observatory / 404

```text
Use case: identity-preserve illustration-story.
Asset: polished browser game how-to scene, WIDE 8:5 composition (640x400 display), one complete painterly image, no text.
Input image 1 is the approved EXACT Nova mascot design; image 2 is the observatory WORLD and painting reference. Preserve BOTH: Nova is a small round chestnut-brown owl, cream face/belly with brown feather marks, large dark brown eyes with amber reflections, tiny amber beak, short feathered wings, orange feet, two little ear tufts, brass round aviator goggles pushed UP on forehead, teal scarf with gold trim and little gold star embroidery, two tails. A small brass lantern glows warmly near Nova. Never put goggles over eyes. The Rarity Observatory is a cozy stone-and-wood sky observatory floating above soft clouds at night, brass dome, wooden balcony, brass astronomical objects.
Style: high-quality painterly digital illustration, dimensional storybook / premium game art, crisp readable silhouette, rich jewel tones, deep indigo #14102e to #2a1f8e, warm gold lantern key light, soft cool violet rim light, soft painted clouds, careful rich materials. Focus on a few large readable forms, avoid clutter. Keep owl and main props comfortably inside the 8:5 frame. No text, letters, numbers, words, logos, brands, watermarks, UI screenshots, symbols resembling written language, mines, caves, miners, pickaxes or other games' characters.
Scene request: Cozy gentle 404 / no-results scene: Nova stands safely on a small round floating wooden sky lookout with a short brass railing, holding an unrolled BLANK parchment star map with a few simple unlabeled constellation dots and lines, looking mildly puzzled but hopeful into a broad quiet patch of indigo sky where a path of a few floating star stepping stones fades into soft lavender clouds. Nova's warm gold lantern lights the map and scarf. The familiar domed Rarity Observatory floats in the soft distant background, clearly offering a welcoming way home. No danger, sadness or distress, just a whimsical wrong turn in the sky. Nova, blank map and lantern are large clear focal points. No 404 numerals, signposts, question marks, writing or text anywhere.
```

