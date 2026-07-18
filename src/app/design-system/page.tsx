"use client";

import * as React from "react";
import {
  FileText,
  Plus,
  Search,
  Send,
  Zap,
  Layers,
  Smile,
  Shield,
  MoreHorizontal,
} from "lucide-react";
import { Logo, LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Radio } from "@/components/ui/radio";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

/* =============================================================
   OREN — Design System · Vitrine
   Fiche vivante de référence. Route : /design-system
   ============================================================= */

function Section({
  id,
  title,
  desc,
  children,
}: {
  id: string;
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="mb-5">
        <h2 className="text-h3 text-foreground">{title}</h2>
        {desc ? (
          <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Swatch({
  name,
  hex,
  className,
  ring,
}: {
  name: string;
  hex: string;
  className: string;
  ring?: boolean;
}) {
  return (
    <div>
      <div
        className={`h-16 rounded-card ${className} ${ring ? "border border-border" : ""}`}
      />
      <p className="mt-2 text-[13px] font-semibold text-foreground">{name}</p>
      <p className="text-[12px] text-muted-foreground">{hex}</p>
    </div>
  );
}

export default function DesignSystemPage() {
  const [radio, setRadio] = React.useState("a");
  const [sw, setSw] = React.useState(true);

  return (
    <div className="min-h-dvh bg-surface text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Logo />
          <div className="hidden items-center gap-2 sm:flex">
            <Badge variant="accent">Design System v1.0</Badge>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-16 px-6 py-12">
        {/* Hero / Brand */}
        <section className="grid gap-8 md:grid-cols-[1.2fr_1fr]">
          <div>
            <h1 className="text-display text-foreground">
              Simple. Rapide. <span className="text-accent">Organisé.</span>
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted-foreground">
              OREN aide les professionnels indépendants à gérer leur activité
              plus facilement. Ce design system garantit une expérience claire,
              rapide et premium sur tous les écrans.
            </p>
            <p className="mt-6 rounded-card border border-border bg-card p-4 text-[15px] font-medium text-foreground">
              « Concentrez-vous sur votre métier.{" "}
              <span className="text-accent">OREN s&apos;occupe du reste.</span> »
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: Zap, t: "Rapide", d: "Tout est fluide." },
              { icon: Layers, t: "Organisé", d: "Chaque chose à sa place." },
              { icon: Smile, t: "Simple", d: "Clair en un coup d'œil." },
              { icon: Shield, t: "Fiable", d: "Vos données sécurisées." },
            ].map(({ icon: Icon, t, d }) => (
              <Card key={t} className="p-4">
                <div className="flex size-10 items-center justify-center rounded-field bg-accent/10 text-accent">
                  <Icon className="size-5" strokeWidth={2} />
                </div>
                <p className="mt-3 text-sm font-semibold">{t}</p>
                <p className="text-[12.5px] text-muted-foreground">{d}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Logo */}
        <Section id="logo" title="Logo" desc="Le « O » corail exprime la vitesse. Symbole seul ou signature complète.">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="flex items-center justify-center bg-background p-8">
              <Logo />
            </Card>
            <Card className="flex items-center justify-center bg-primary p-8">
              <Logo tone="white" />
            </Card>
            <Card className="flex items-center justify-center gap-6 bg-background p-8">
              <LogoMark className="size-12" />
              <LogoMark tone="navy" className="size-12" />
            </Card>
          </div>
        </Section>

        {/* Couleurs */}
        <Section id="colors" title="Couleurs" desc="Peu de couleurs, hiérarchie forte. Le blanc domine.">
          <p className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
            Principales
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <Swatch name="Primary" hex="#0F172A" className="bg-primary" />
            <Swatch name="Accent" hex="#FF6B57" className="bg-accent" />
            <Swatch name="Background" hex="#FFFFFF" className="bg-background" ring />
            <Swatch name="Surface" hex="#F8FAFC" className="bg-surface" ring />
            <Swatch name="Border" hex="#E2E8F0" className="bg-border" />
          </div>
          <p className="mb-3 mt-8 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
            Sémantiques
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <Swatch name="Success" hex="#22C55E" className="bg-success" />
            <Swatch name="Warning" hex="#F59E0B" className="bg-warning" />
            <Swatch name="Error" hex="#EF4444" className="bg-error" />
            <Swatch name="Info" hex="#3B82F6" className="bg-info" />
            <Swatch name="Text sec." hex="#64748B" className="bg-muted-foreground" />
          </div>
        </Section>

        {/* Typographie */}
        <Section id="type" title="Typographie — Inter" desc="Titres imposants, texte extrêmement lisible.">
          <Card className="space-y-3 p-6">
            <p className="text-display">Aa — Display 40/700</p>
            <p className="text-h1">Titre H1 · 32px / 700</p>
            <p className="text-h2">Titre H2 · 24px / 600</p>
            <p className="text-h3">Titre H3 · 20px / 600</p>
            <p className="text-[15px] text-foreground">
              Corps · 15px / 400 — Le renard brun rapide saute par-dessus le
              chien paresseux.
            </p>
            <p className="text-[13px] text-muted-foreground">
              Petit texte · 13px / 400 — informations secondaires.
            </p>
          </Card>
        </Section>

        {/* Espacement + Radius */}
        <Section id="spacing" title="Grille, Espacements & Rayons" desc="Système 8px. Rayons : champs 14 · cards 18 · dialogs 24.">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-6">
              <p className="mb-4 text-sm font-semibold">Spacing (8px)</p>
              <div className="flex items-end gap-2">
                {[4, 8, 12, 16, 24, 32, 48, 64].map((s) => (
                  <div key={s} className="text-center">
                    <div
                      className="rounded-md bg-accent/20"
                      style={{ width: 16, height: s }}
                    />
                    <span className="mt-1 block text-[11px] text-muted-foreground">
                      {s}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="p-6">
              <p className="mb-4 text-sm font-semibold">Border radius</p>
              <div className="flex flex-wrap gap-4">
                {[
                  { l: "field 14", c: "rounded-field" },
                  { l: "card 18", c: "rounded-card" },
                  { l: "dialog 24", c: "rounded-dialog" },
                  { l: "full", c: "rounded-full" },
                ].map(({ l, c }) => (
                  <div key={l} className="text-center">
                    <div className={`size-16 border border-border bg-surface ${c}`} />
                    <span className="mt-1 block text-[11px] text-muted-foreground">
                      {l}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </Section>

        {/* Ombres */}
        <Section id="shadows" title="Ombres" desc="Très discrètes. Jamais lourdes.">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {[
              { l: "shadow-xs", c: "shadow-xs" },
              { l: "shadow-sm", c: "shadow-sm" },
              { l: "shadow-md", c: "shadow-md" },
              { l: "shadow-lg", c: "shadow-lg" },
              { l: "shadow-xl", c: "shadow-xl" },
            ].map(({ l, c }) => (
              <div key={l} className="text-center">
                <div className={`h-20 rounded-card bg-card ${c}`} />
                <span className="mt-2 block text-[12px] text-muted-foreground">
                  {l}
                </span>
              </div>
            ))}
          </div>
        </Section>

        {/* Boutons */}
        <Section id="buttons" title="Boutons" desc="Primaire corail · Secondaire · Ghost · Danger. Hauteur 48px.">
          <Card className="flex flex-wrap items-center gap-3 p-6">
            <Button variant="primary">
              <Plus /> Nouveau devis
            </Button>
            <Button variant="default">Enregistrer</Button>
            <Button variant="outline">Annuler</Button>
            <Button variant="ghost">
              Voir tout <Send />
            </Button>
            <Button variant="destructive">Supprimer</Button>
            <Button variant="whatsapp">WhatsApp</Button>
            <Button variant="primary" size="sm">
              Petit
            </Button>
            <Button variant="outline" size="icon">
              <MoreHorizontal />
            </Button>
            <Button variant="primary" disabled>
              Désactivé
            </Button>
          </Card>
        </Section>

        {/* Formulaires */}
        <Section id="forms" title="Champs & Sélecteurs" desc="Grande hauteur, focus subtil, jamais agressif.">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="space-y-4 p-6">
              <div>
                <Label htmlFor="ds-name">Nom du client</Label>
                <Input id="ds-name" placeholder="Entrez un nom" />
              </div>
              <div>
                <Label htmlFor="ds-search">Avec icône</Label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground" />
                  <Input id="ds-search" className="pl-11" placeholder="Rechercher un client" />
                </div>
              </div>
              <div>
                <Label htmlFor="ds-select">Statut</Label>
                <Select id="ds-select" defaultValue="">
                  <option value="" disabled>
                    Choisir une option
                  </option>
                  <option>Brouillon</option>
                  <option>Envoyé</option>
                  <option>Payé</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="ds-note">Note</Label>
                <Textarea id="ds-note" placeholder="Ajouter une note…" />
              </div>
            </Card>

            <Card className="space-y-6 p-6">
              <div>
                <p className="mb-3 text-sm font-semibold">Checkbox</p>
                <div className="space-y-2.5">
                  <Checkbox defaultChecked label="Envoyer une copie par email" />
                  <Checkbox label="Marquer comme récurrent" />
                </div>
              </div>
              <div>
                <p className="mb-3 text-sm font-semibold">Radio</p>
                <div className="space-y-2.5">
                  <Radio
                    name="ds-radio"
                    checked={radio === "a"}
                    onChange={() => setRadio("a")}
                    label="Devis"
                  />
                  <Radio
                    name="ds-radio"
                    checked={radio === "b"}
                    onChange={() => setRadio("b")}
                    label="Facture"
                  />
                </div>
              </div>
              <div>
                <p className="mb-3 text-sm font-semibold">Switch</p>
                <label className="flex items-center gap-3 text-[15px]">
                  <Switch checked={sw} onCheckedChange={setSw} />
                  Notifications activées
                </label>
              </div>
            </Card>
          </div>
        </Section>

        {/* Badges + Alerts */}
        <Section id="feedback" title="Badges & Alertes" desc="Statuts lisibles, alertes teintées douces.">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="flex flex-wrap items-start gap-2 p-6">
              <Badge variant="success">Payé</Badge>
              <Badge variant="info">Envoyé</Badge>
              <Badge variant="neutral">Brouillon</Badge>
              <Badge variant="error">Impayé</Badge>
              <Badge variant="warning">En attente</Badge>
              <Badge variant="accent">Nouveau</Badge>
            </Card>
            <div className="space-y-3">
              <Alert variant="success" title="Document enregistré">
                Votre devis a été créé avec succès.
              </Alert>
              <Alert variant="info" title="Information">
                Le devis a été envoyé au client.
              </Alert>
              <Alert variant="warning" title="Vérifiez les informations">
                Certains champs semblent incomplets.
              </Alert>
              <Alert variant="error" title="Une erreur est survenue">
                Réessayez dans un instant.
              </Alert>
            </div>
          </div>
        </Section>

        {/* Cards + Table */}
        <Section id="data" title="Cards & Tableau" desc="Aérés, sans quadrillage, actions discrètes.">
          <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>DEV-024</CardTitle>
                  <Badge variant="info">Envoyé</Badge>
                </div>
                <CardDescription>Entreprise XYZ · Aujourd&apos;hui</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-h2 text-foreground">245 000 FCFA</p>
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[12px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-5 py-3 font-semibold">Document</th>
                    <th className="px-5 py-3 font-semibold">Client</th>
                    <th className="px-5 py-3 font-semibold">Montant</th>
                    <th className="px-5 py-3 font-semibold">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { d: "DEV-024", c: "Entreprise XYZ", m: "245 000", s: "info", l: "Envoyé" },
                    { d: "FAC-014", c: "Société ABC", m: "120 000", s: "neutral", l: "Brouillon" },
                    { d: "DEV-023", c: "Client Particulier", m: "85 000", s: "error", l: "Impayé" },
                    { d: "FAC-013", c: "Construction Pro", m: "560 000", s: "success", l: "Payé" },
                  ].map((r) => (
                    <tr key={r.d} className="border-t border-border/70">
                      <td className="flex items-center gap-2 px-5 py-3.5 font-medium">
                        <FileText className="size-4 text-muted-foreground" /> {r.d}
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground">{r.c}</td>
                      <td className="px-5 py-3.5 font-semibold">{r.m} FCFA</td>
                      <td className="px-5 py-3.5">
                        <Badge variant={r.s as "info" | "neutral" | "error" | "success"}>
                          {r.l}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        </Section>

        <footer className="border-t border-border pt-8 text-center text-[13px] text-muted-foreground">
          OREN Design System · Inter · Lucide Icons · Next.js + Tailwind +
          shadcn/ui
        </footer>
      </main>
    </div>
  );
}
