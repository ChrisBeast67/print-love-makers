
-- Drop old check constraint and add one that includes mythic
ALTER TABLE public.avatar_items DROP CONSTRAINT avatar_items_rarity_check;
ALTER TABLE public.avatar_items ADD CONSTRAINT avatar_items_rarity_check
  CHECK (rarity = ANY (ARRAY['common','rare','epic','legendary','mythic']));

-- Add mythic avatar items (one per theme)
INSERT INTO public.avatar_items (slug, name, theme, rarity, emoji, accent_hsl) VALUES
  ('mythic-omega-bot', 'Omega Bot', 'robot', 'mythic', '🤖', '300 100% 60%'),
  ('mythic-phoenix-beast', 'Phoenix Beast', 'animal', 'mythic', '🦅', '15 100% 55%'),
  ('mythic-ringmaster', 'The Ringmaster', 'circus', 'mythic', '🎪', '330 100% 55%'),
  ('mythic-kraken', 'The Kraken', 'underwater', 'mythic', '🐙', '260 100% 60%');
