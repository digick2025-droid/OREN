# DIGICK Devis

Assistant de création de devis professionnels en moins de 2 minutes, pensé
pour les artisans et autoentrepreneurs (espace OHADA). Devis, factures, PDF,
partage WhatsApp, abonnements avec quotas et mode Express sans compte.

## Stack

- **Frontend** : Next.js 15 (App Router) · React 19 · TypeScript strict · Tailwind CSS · composants style shadcn/ui
- **Backend / BDD / Auth / Stockage** : Supabase (PostgreSQL, Auth OTP par téléphone, Storage)
- **Données client** : TanStack React Query
- **Déploiement** : Vercel

## Architecture

```
src/
  app/                  Routes (App Router)
    (app)/              Écrans connectés (accueil, documents, clients, catalogue, réglages…)
    api/payments/       Paiement (simulé, interface CamerPay-compatible)
    connexion/          Auth OTP téléphone
    express/            Devis express sans compte
    offres/             Page des offres (publique)
  components/           UI réutilisable (bouton, carte, navigation…)
  features/             Modules métier (auth, company, clients, catalog, documents, payments)
  hooks/                Hooks React Query par domaine
  lib/                  Moteur de calcul, formats, Supabase, constantes
  services/             Services indépendants :
    pdf/                Moteur PDF (modèles interchangeables)
    payments/           PaymentProvider (simulé → CamerPay)
    whatsapp.ts         Liens wa.me
  types/                Types BDD et domaine
supabase/migrations/    Schéma SQL, RLS, fonctions métier
```

## Démarrage

1. **Créer un projet Supabase** puis exécuter les migrations dans l'ordre
   (SQL Editor ou `supabase db push`) :
   `0001_initial_schema.sql` → `0002_rls_policies.sql` → `0003_functions.sql`

2. **Activer l'authentification par téléphone** :
   Dashboard → Authentication → Providers → Phone (configurer un fournisseur
   SMS, ex. Twilio). Pour tester sans SMS : Authentication → Phone →
   *Test OTPs* permet de déclarer des numéros + codes de test.

3. **Variables d'environnement** : copier `.env.example` vers `.env.local`
   et renseigner l'URL et la clé anon du projet.

4. **Lancer** :

```bash
npm install
npm run dev
```

## Scripts

| Commande            | Rôle                                   |
| ------------------- | -------------------------------------- |
| `npm run dev`       | Serveur de développement               |
| `npm run build`     | Build de production                    |
| `npm run lint`      | ESLint                                 |
| `npm run typecheck` | Vérification TypeScript                |
| `npm test`          | Tests unitaires (calculs, TVA, conversion, quotas, numérotation) |

## Offres et quotas

Les offres sont **configurées en base** (table `plans`) — jamais codées en dur :

| Offre    | Prix          | Quota mensuel      |
| -------- | ------------- | ------------------ |
| Gratuit  | 0 F           | 3 documents offerts |
| Express  | 500 F / devis | paiement à l'usage, sans compte |
| Pro      | 3 000 F / mois | 25 documents       |
| Business | 5 000 F / mois | illimité           |

Le quota est vérifié **côté base** (`assert_quota`) à chaque création de
document ; le compteur mensuel est calculé sur les documents créés dans le
mois calendaire.

## Sécurité

- **RLS activé sur toutes les tables** : chaque utilisateur ne voit que les
  données de son entreprise.
- Pas de politique DELETE : la suppression est un **soft delete**
  (`deleted_at`).
- Numérotation et totaux recalculés côté base (fonctions `security definer`
  avec vérification de propriété).
- Aucune clé sensible côté client (seules les clés `NEXT_PUBLIC_*` sont
  exposées).

## Paiement

`src/services/payments/` expose une interface `PaymentProvider`. Le MVP
utilise `SimulatedPaymentProvider` (variable `PAYMENT_PROVIDER=simulated`).
Pour brancher CamerPay : implémenter `PaymentProvider` dans `camerpay.ts`
et l'enregistrer dans `getPaymentProvider()` — aucun composant à modifier.

## PDF

`src/services/pdf/` est un moteur indépendant : il reçoit des données et
rend un HTML A4 imprimable. Le modèle `classic` reprend le prototype ;
d'autres modèles s'ajoutent dans `templates/` + le registre `TEMPLATES`.

## Déploiement Vercel

1. Pousser le dépôt sur GitHub.
2. Importer le projet dans Vercel.
3. Renseigner `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   et `PAYMENT_PROVIDER=simulated` dans les variables d'environnement.
4. Déployer (`main` = production, `develop` = préproduction).

## Future Improvements

Fonctionnalités volontairement **hors MVP** (cahier des charges) :

- Intégration CamerPay réelle (Orange Money, MTN MoMo, carte bancaire)
- Version anglaise (le prototype est FR/EN ; le MVP est FR)
- Modèles PDF supplémentaires + logo entreprise sur le PDF (upload prévu côté Storage, bucket `logos` déjà migré)
- Duplication pré-remplie d'un document (le bouton renvoie vers un nouveau document vierge)
- Rappels automatiques de renouvellement d'abonnement (cron)
- Rapports simples pour l'offre Business
- PWA (installation écran d'accueil)
- API WhatsApp Business (le MVP prépare uniquement le lien wa.me)
