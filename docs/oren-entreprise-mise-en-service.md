# OREN ENTREPRISE — mise en service (migrations + test bout en bout)

Checklist pour appliquer les migrations du module **Terrain** sur la base de
production Supabase (`lztawlormltmtdqdswox`) puis valider le parcours complet.

## Principe

- **Pas de CLI Supabase ici** (aucun `config.toml`, aucun `db push`). On applique
  **à la main dans le SQL editor** du dashboard Supabase.
- **Collision de numéros** : il existe deux `0040_*` et deux `0041_*` (les offres
  OREN Startup et les fichiers ENTREPRISE). **Appliquer par NOM de fichier exact**,
  jamais « la 0040 ».
- **Ordre strict** (chaque étape dépend des précédentes) :
  `0040_interventions` → `0041_member_display_name` → `0045` → `0046` → `0047`
  → `0048` → `0049` → `0050`.
  En particulier `0047` numérote `intervention_reports`, donc **`0046` doit passer
  avant `0047`**.
- **Sans risque pour les clients actuels** : tout le module est gaté côté app par
  `useEnterpriseAccess` (offre avec feature `members` **ou** `ENTERPRISE_PREVIEW`
  **ou** admin). Appliquer les migrations n'expose rien aux clients tant que
  l'offre ENTREPRISE n'est pas activée ; l'admin, lui, voit le module.
- Chaque fichier est **idempotent-friendly** (policies `drop ... if exists`,
  `add column if not exists`, `on conflict do nothing` sur le bucket), mais les
  `create table` ne le sont pas : ne pas relancer une migration déjà passée.

## 0 · Pré-vérification (avant d'appliquer quoi que ce soit)

Coller dans le SQL editor — montre ce qui est **déjà** en place :

```sql
select
  to_regclass('public.interventions')         as t_0040_interventions,
  (select count(*) from information_schema.columns
     where table_name='company_members' and column_name='display_name')
                                               as c_0041_member_name,
  exists(select 1 from pg_policies
     where tablename='interventions' and policyname='interventions_select_scoped')
                                               as p_0045_scope,
  to_regclass('public.intervention_reports')  as t_0046_reports,
  (select id from storage.buckets where id='intervention-photos')
                                               as b_0046_bucket,
  (select count(*) from information_schema.columns
     where table_name='interventions' and column_name='number')
                                               as c_0047_number,
  to_regclass('public.parts')                 as t_0048_parts,
  to_regclass('public.maintenance_contracts') as t_0049_contracts,
  to_regclass('public.expenses')              as t_0050_expenses;
```

Règle de lecture : une colonne `null` / `0` = **migration à appliquer**.
N'applique que ce qui manque, dans l'ordre.

## 1 · Application, étape par étape

Pour chaque ligne : ouvrir le fichier `supabase/migrations/<nom>.sql`, copier tout
son contenu dans le SQL editor, exécuter, puis lancer la requête de vérif.

| # | Fichier | Crée / modifie | Vérif post-application |
|---|---------|----------------|------------------------|
| 1 | `0040_interventions.sql` | table `interventions` + RLS | `select to_regclass('public.interventions');` → non `null` |
| 2 | `0041_member_display_name.sql` | `display_name` sur membres/invitations, `invite_member` 4 args | `select count(*) from pg_proc where proname='invite_member' and pronargs=4;` → `1` |
| 3 | `0045_interventions_technician_scope.sql` | policies `interventions_*_scoped` (remplace `*_own`) | `select policyname from pg_policies where tablename='interventions';` → voir `…_scoped`, plus de `…_own` |
| 4 | `0046_intervention_reports.sql` | bucket privé `intervention-photos` + table `intervention_reports` | `select id,public from storage.buckets where id='intervention-photos';` → `public=false` |
| 5 | `0047_intervention_numbering.sql` | colonnes `number` (OT-/RI-), fonctions + triggers, backfill | `select column_name from information_schema.columns where table_name='interventions' and column_name='number';` → 1 ligne |
| 6 | `0048_parts.sql` | tables `parts` + `intervention_parts`, trigger stock | `select tgname from pg_trigger where tgname='intervention_parts_stock';` → 1 ligne |
| 7 | `0049_maintenance_contracts.sql` | table `maintenance_contracts`, RPC `generate_contract_visit` | `select proname from pg_proc where proname='generate_contract_visit';` → 1 ligne |
| 8 | `0050_expenses.sql` | table `expenses` + RLS financière | `select to_regclass('public.expenses');` → non `null` |

### Vérifs transverses utiles

```sql
-- doc_type du compteur partagé étendu (0047 + 0049)
select consrc from pg_constraint where conname='document_counters_doc_type_check';
--  (ou, selon la version PG :)
select pg_get_constraintdef(oid) from pg_constraint
where conname='document_counters_doc_type_check';
--  doit lister : devis, facture, proforma, intervention, rapport, contrat

-- fonctions definer bien révoquées du public (anon/public n'exécutent pas)
select proname from pg_proc
where proname in ('next_intervention_number','next_report_number',
                  'next_contract_number','generate_contract_visit','adjust_part_stock');
```

## 2 · Points de vigilance

- **`0045` bascule la RLS** des interventions de « tous les membres voient tout » à
  « technicien → seulement ses interventions affectées ». Vérifier qu'il n'y a plus
  de policy `interventions_*_own`.
- **Trigger `adjust_part_stock` en `security definer`** : c'est voulu — un
  technicien sans droit d'écriture sur `parts` doit quand même décrémenter le stock
  en posant une pièce.
- **Bucket `intervention-photos` privé** : les photos/signatures se relisent via URL
  signée. Si l'upload échoue côté app, vérifier que les 4 policies `iv_photos_*`
  existent sur `storage.objects`.
- **Backfill des numéros (0047)** : numérote aussi les lignes déjà présentes
  (interventions de test) et cale le compteur ; c'est normal que d'anciennes
  interventions reçoivent OT-001, OT-002…

## 3 · Plan de test bout en bout

Pré-requis : être connecté en **admin** (`digick2025@gmail.com`, propriétaire →
rôle gérant). L'admin voit le module sans activer l'offre.

### A. Accès & navigation
- [ ] La barre du bas affiche l'onglet **Terrain** → ouvre `/terrain` sans erreur.
- [ ] Les onglets (Synthèse / Interventions / Planning / Stock / Contrats /
      Trésorerie) naviguent et marquent l'onglet actif.

### B. Interventions + numérotation (gérant)
- [ ] Créer une intervention, l'affecter à un membre technicien, planifier
      **aujourd'hui** → elle reçoit un numéro **OT-00x**.
- [ ] **Planning** : elle apparaît aujourd'hui, sous le bon technicien.
- [ ] Détail : changer le statut (plusieurs valeurs) → persiste.

### C. Stock & pièces
- [ ] `/stock` : créer une pièce (ex. stock 10, seuil 2).
- [ ] Détail intervention → **Pièces posées** : ajouter 3 unités → le stock passe
      à **7**, la ligne et le total s'affichent.
- [ ] Retirer la ligne → le stock revient à **10** (restitution par le trigger).
- [ ] Mettre une pièce sous le seuil → pastille rouge dans `/stock` et section
      « Stock bas » du tableau de bord.

### D. Rapport signé
- [ ] Détail intervention → **Rapport** : ajouter une photo avant et une après
      (upload OK), saisir un nom, signer dans le cadre, valider.
- [ ] Le rapport affiche **RI-00x**, le badge **Signé**, la signature et les photos
      se rechargent (URL signée OK).

### E. Devis depuis l'intervention
- [ ] Avec des pièces posées, **Créer un devis** → le devis contient la ligne
      main d'œuvre **et** une ligne « article » par pièce (coût prérempli).

### F. Contrats récurrents
- [ ] `/contrats` : créer un contrat (client, mensuel, échéance aujourd'hui) →
      **CTR-00x**.
- [ ] **Générer la prochaine intervention** → crée une intervention *planifiée*
      (avec l'adresse du client), ouvre son détail, et l'échéance du contrat avance
      d'**un mois**.
- [ ] Mettre le contrat en « suspendu » → le bouton de génération est désactivé.

### G. Trésorerie
- [ ] `/tresorerie` : ajouter une dépense (montant, date ce mois) → **Dépenses**
      augmente ; **Marge** = facturé − (dépenses + coût pièces).
- [ ] Si une facture `payée` existe ce mois → **Encaissé** la reflète.
- [ ] Naviguer mois précédent/suivant → les montants changent.

### H. Rôle technicien (test RLS — le plus important)
Nécessite un **second compte** (cf. [[tester-pwa-hors-ligne]] : contrôle
multi-comptes à faire en prod, PWA testable en local via `launch.json` `oren-prod`).
- [ ] Depuis Équipe, inviter / régler un membre en **technicien**.
- [ ] Se connecter avec ce compte technicien.
- [ ] `/terrain` et `/interventions` : il ne voit **que ses interventions
      affectées** (pas celles des autres).
- [ ] Pas de bouton **+** ; `/interventions/nouveau` affiche le message de blocage.
- [ ] Il peut ouvrir SON intervention : changer le statut, remplir le rapport,
      **ajouter une pièce** (le stock décrémente malgré l'absence de droit sur le
      magasin).
- [ ] Le détail d'une intervention **non affectée** (URL directe) est introuvable.
- [ ] Pas d'onglet **Trésorerie** ; `/tresorerie` → « Accès réservé ».

### I. Isolation entreprise
- [ ] Les données d'une autre entreprise ne sont jamais visibles (interventions,
      stock, contrats, dépenses).

## 4 · En cas d'échec

- Erreur « relation … does not exist » → une migration amont manque : relancer la
  **pré-vérification** et appliquer les fichiers manquants dans l'ordre.
- Erreur sur un `create table` déjà existant → la migration est déjà passée, la
  sauter.
- `/interventions/[id]/rapport` plante « table … in schema cache » → `0046` pas
  appliquée (ou cache PostgREST : attendre quelques secondes / recharger le schéma
  depuis le dashboard).
- Rien n'est détruit par ces migrations (aucun `drop table` ; seules des policies
  sont remplacées en `0045`). Pas de rollback prévu : en dev, restaurer depuis
  `supabase/backups/` si besoin.
