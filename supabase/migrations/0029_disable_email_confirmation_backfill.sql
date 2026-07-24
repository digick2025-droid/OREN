-- ============================================================
-- 0029 : onboarding sans validation d'email.
--
-- Décision produit : l'inscription se termine au formulaire
-- (email + mot de passe + confirmation du mot de passe). Plus
-- de lien à cliquer dans la boîte mail. Le lien magique reste
-- réservé à la réinitialisation de mot de passe (/mot-de-passe-oublie).
--
-- Le vrai interrupteur n'est PAS ici : il est dans la config du
-- projet Supabase (Authentication > Sign In / Providers > Email >
-- « Confirm email » = OFF, alias mailer_autoconfirm). Cette
-- migration ne fait que rattraper l'existant : les comptes déjà
-- créés avant la bascule sont bloqués tant que email_confirmed_at
-- est nul (GoTrue refuse signInWithPassword), et leur entreprise
-- n'est jamais créée puisque auto-onboard tourne à la 1re session.
--
-- confirmation_token est vidé comme le fait GoTrue, pour
-- neutraliser les liens déjà partis par email.
-- ============================================================

update auth.users
set email_confirmed_at = coalesce(email_confirmed_at, now()),
    confirmation_token = ''
where email is not null
  and email_confirmed_at is null;
