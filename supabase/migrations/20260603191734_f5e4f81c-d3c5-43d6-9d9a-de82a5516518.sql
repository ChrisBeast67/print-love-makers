
ALTER TABLE public.avatar_items DROP CONSTRAINT IF EXISTS avatar_items_rarity_check;
ALTER TABLE public.avatar_items ADD CONSTRAINT avatar_items_rarity_check
  CHECK (rarity = ANY (ARRAY['common'::text, 'rare'::text, 'epic'::text, 'legendary'::text, 'mythic'::text, 'secret'::text]));
