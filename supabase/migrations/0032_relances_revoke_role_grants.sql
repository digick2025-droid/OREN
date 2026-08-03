-- ============================================================
-- 0032 : ferme l'accès public aux fonctions de la 0031.
-- ============================================================
--
-- La 0031 croyait suffire avec `revoke all ... from public`. C'est faux sur
-- Supabase : `public` est le pseudo-rôle, et les default privileges du projet
-- accordent en plus EXECUTE nommément à `anon` et `authenticated` sur toute
-- nouvelle fonction du schéma public. Ces droits-là survivent au revoke.
--
-- Conséquence pour `bump_push_failure`, annoncée « réservée au serveur » :
-- elle était appelable par n'importe qui, même sans session, via
-- /rest/v1/rpc/bump_push_failure. Cinq appels sur un identifiant d'abonnement
-- et l'appareil visé ne reçoit plus rien.

revoke execute on function public.bump_push_failure(uuid) from anon, authenticated;

-- `touch_last_seen` reste ouverte aux comptes connectés — c'est sa raison
-- d'être. Pour `anon`, l'appel ne fait rien (auth.uid() est nul) : on le coupe
-- quand même, une fonction `security definer` exposée sans session n'a pas à
-- exister sans raison.
revoke execute on function public.touch_last_seen() from anon;
