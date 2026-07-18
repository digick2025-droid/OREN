/**
 * Tests d'intégration — Isolation RLS entre deux entreprises.
 *
 * On vérifie qu'une entreprise ne peut jamais lire ni modifier les données
 * d'une autre : documents, lignes, clients, journal d'activité. C'est la
 * garantie de sécurité centrale du produit (multi-tenant sur une seule base).
 *
 * Prérequis : instance Supabase avec les migrations appliquées + variables
 * d'environnement (voir tests/helpers/supabase-env.ts). Sans elles, la suite
 * est ignorée proprement.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  adminClient,
  cleanupUsers,
  createCompany,
  createTestUser,
  getTestEnv,
  type TestEnv,
} from "../helpers/supabase-env";

const env = getTestEnv();

describe.skipIf(!env)("RLS — isolation entre deux entreprises", () => {
  const testEnv = env as TestEnv;
  const createdUserIds: string[] = [];
  let admin: SupabaseClient;

  // Entreprise A
  let clientA: SupabaseClient;
  let companyA: string;
  let docA: string;

  // Entreprise B (son tenant est créé pour l'isolation ; l'id n'est pas relu).
  let clientB: SupabaseClient;

  beforeAll(async () => {
    admin = adminClient(testEnv);

    const userA = await createTestUser(testEnv, admin, createdUserIds, "rls-a");
    clientA = userA.client;
    companyA = await createCompany(clientA, "Entreprise A");

    const userB = await createTestUser(testEnv, admin, createdUserIds, "rls-b");
    clientB = userB.client;
    await createCompany(clientB, "Entreprise B");

    // A crée un devis via la RPC.
    const { data, error } = await clientA.rpc("create_document", {
      p_company_id: companyA,
      p_payload: {
        type: "devis",
        title: "Chantier confidentiel A",
        client_name: "Client A",
        client_phone: "+237690000000",
        items: [{ name: "Prestation", unit: "forfait", quantity: 1, unit_price: 50000 }],
      },
    });
    if (error) throw new Error(`seed docA failed: ${error.message}`);
    docA = data.id as string;
  }, 30_000);

  afterAll(async () => {
    await cleanupUsers(admin, createdUserIds);
  });

  it("A voit son propre document", async () => {
    const { data, error } = await clientA
      .from("documents")
      .select("id, title")
      .eq("id", docA);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0]?.title).toBe("Chantier confidentiel A");
  });

  it("B ne voit AUCUN document de A (liste vide)", async () => {
    const { data, error } = await clientB.from("documents").select("id");
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("B ne peut pas lire le document de A par son id", async () => {
    const { data, error } = await clientB
      .from("documents")
      .select("id")
      .eq("id", docA);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("B ne voit pas les lignes du document de A", async () => {
    const { data, error } = await clientB
      .from("document_items")
      .select("id")
      .eq("document_id", docA);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("B ne voit pas l'entreprise de A", async () => {
    const { data } = await clientB
      .from("companies")
      .select("id")
      .eq("id", companyA);
    expect(data ?? []).toHaveLength(0);
  });

  it("B ne voit pas le journal d'activité de A", async () => {
    const { data } = await clientB
      .from("activity_logs")
      .select("id")
      .eq("company_id", companyA);
    expect(data ?? []).toHaveLength(0);
  });

  it("B ne peut pas mettre à jour le document de A (0 ligne affectée)", async () => {
    const { data } = await clientB
      .from("documents")
      .update({ title: "piraté" })
      .eq("id", docA)
      .select("id");
    // La RLS filtre la ligne : aucune mise à jour, et le titre reste intact.
    expect(data ?? []).toHaveLength(0);

    const { data: check } = await clientA
      .from("documents")
      .select("title")
      .eq("id", docA)
      .single();
    expect(check?.title).toBe("Chantier confidentiel A");
  });

  it("B ne peut pas créer de document dans l'entreprise de A (FORBIDDEN)", async () => {
    const { error } = await clientB.rpc("create_document", {
      p_company_id: companyA,
      p_payload: {
        type: "devis",
        items: [{ name: "x", quantity: 1, unit_price: 1000 }],
      },
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("FORBIDDEN");
  });

  it("B ne peut pas convertir le devis de A (FORBIDDEN)", async () => {
    const { error } = await clientB.rpc("convert_document_to_invoice", {
      p_document_id: docA,
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("FORBIDDEN");
  });

  it("une entreprise ne peut pas s'attribuer un client dans le tenant d'une autre", async () => {
    // B tente d'insérer un client rattaché à l'entreprise de A → refus RLS.
    const { error } = await clientB
      .from("clients")
      .insert({ company_id: companyA, name: "Client injecté" })
      .select("id");
    expect(error).not.toBeNull();
  });
});
