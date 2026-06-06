CREATE OR REPLACE FUNCTION public.contains_bad_word(_text text)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  _bad text[] := ARRAY[
    'fuck','fuk','shit','bitch','asshole','bastard','dick','cunt','slut','whore',
    'fag','faggot','nigger','nigga','retard','pussy','cock','douche','prick',
    'wanker','twat','motherfucker','jerk','kys','kill yourself','i hate you','loser','moron'
  ];
  _c text := lower(coalesce(_text, ''));
  _w text;
BEGIN
  IF left(_c, 8) = '__img__:' OR left(_c, 8) = '__vid__:' THEN
    RETURN false;
  END IF;
  FOREACH _w IN ARRAY _bad LOOP
    IF _c ~ ('(^|[^a-z])' || _w || '([^a-z]|$)') THEN
      RETURN true;
    END IF;
  END LOOP;
  RETURN false;
END;
$function$;