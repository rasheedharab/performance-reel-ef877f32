## Diagnosis

I traced exactly what gets sent to fal.ai for a video clip. There is a hard context gap:

- `buildCompilePayload` in `src/routes/_authenticated/generation.tsx` (lines 3034–3057) sends ONLY the storyboard shot slots (subject, action, setting, lighting, lens, mood, camera_move, etc.) to `ai-assist → compile_prompt`.
- It does NOT send: the brand's Style Bible (film_look, color_grade, lighting_signature, lens_feel, subject_tokens, default_negative, palette), the script's VO / hook / archetype for this shot, the brief's product context (product name, category, key claims, regulatory notes), or the storyboard `assigned_tool` prompt-cheatsheet fields.
- The `compile_prompt` task in `supabase/functions/ai-assist/index.ts` (lines 366–463) only knows the fields it's given, so brand look and script/VO context can never appear in the compiled prompt.
- `generate-clip` then passes that compiled prompt through to fal.ai verbatim — no server-side enrichment either.

Net effect: the model sees shot slots in a vacuum and produces something that isn't tied to your brand look or the script beat.

The Image Studio path already gets this right — it passes `style_bible` into `compile_image_prompt`. We mirror that on the video path and add script + brief context.

## Fix plan

### 1. `src/routes/_authenticated/generation.tsx`
- Extend the shot fetch (already loads `brief_id`, `brand_id`, `script_id`, angle/beat info via existing selects — verify and add missing joins) so each shot row carries:
  - The parent `script` row: `archetype`, `hook`, `vo_script`, `on_screen_text`, `target_duration`, `beat_role` (which script beat this shot belongs to), `beat_text`.
  - The parent `brief` row: `project_name`, `product_name`, `product_category`, `key_claims`, `offer`, `regulatory_notes`.
  - The parent `brand` row: `name`, plus resolved `style_bible` (film_look, color_grade, lighting_signature, lens_feel, subject_tokens, default_negative, palette, brand voice adjectives).
- Rewrite `buildCompilePayload(shot, compileTool)` to include three new nested blocks alongside the existing shot slots:
  - `style_bible: { subject_tokens, film_look, color_grade, lighting_signature, lens_feel, default_negative, palette }`
  - `script_context: { archetype, hook, vo_line_for_beat, on_screen_text_for_beat, beat_role, target_duration }`
  - `brief_context: { product_name, product_category, key_claims, offer, regulatory_notes }`
- Bump the shot fetch to also pull `assigned_tool`, `prompt_word_target`, and any `visual_description` we already have as a natural-language fallback.
- On the Generate Clip dialog, add a compact "Context loaded" strip (small chips: Brand look ✓ · Script beat ✓ · Product ✓) so you can see at a glance whether context propagated.

### 2. `supabase/functions/ai-assist/index.ts` — `compile_prompt` task
- Accept the three new blocks in `payload` and render them into the user message under new headers: `BRAND STYLE BIBLE`, `SCRIPT CONTEXT (this shot's beat)`, `BRIEF / PRODUCT CONTEXT`.
- Expand the system prompt so it MUST carry brand look language into the compiled prompt (film_look, color_grade, lighting_signature, lens_feel, palette), reuse `subject_tokens` verbatim, respect on-screen text and VO line for this beat, and include product identity / key claim wording when the shot depicts the product.
- Add warnings when: no style_bible provided, no product context on a product/hero shot, or dialogue conflicts with the VO line.

### 3. `supabase/functions/generate-clip/index.ts`
- Small defensive additions only:
  - Log a compact `usage_meta.context_snapshot` recording which context blocks were present at submit time (booleans + hashes) so we can later confirm the pipeline was fed properly without leaking content.
  - Keep the current behavior of passing the compiled prompt through as-is to fal.ai.

### 4. Storyboard sanity assist (optional, same PR)
- In storyboard shot rows that are missing `subject_tokens`, `lighting`, `lens`, or `style_grade`, auto-hydrate defaults from the brand's Style Bible on save (only when the field is empty). This closes the other common leak: sparse shot slots.

## Verification

1. Open one existing shot, hit "Compile", inspect the compiled prompt: brand look words + script hook/beat reference + product name should appear.
2. `supabase--edge_function_logs` on `ai-assist` should show the new payload sections in the request the function saw.
3. Generate one Kling / one Veo clip; the "Context loaded" strip on the dialog should be all green, and the visible output should reflect brand palette + product.

## What this does NOT change

- No schema changes.
- No changes to the fal.ai submit shape or model selection.
- No changes to billing / credit flow.
- Voiceover and image pipelines untouched (image already carries style_bible; voice pipeline is a separate concern you didn't flag).
