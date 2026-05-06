
ALTER TABLE public.profile_packs DROP CONSTRAINT profile_packs_rarity_check;
ALTER TABLE public.profile_packs ADD CONSTRAINT profile_packs_rarity_check
  CHECK (rarity IN ('common','rare','epic','legendary','mythic','mixed'));
