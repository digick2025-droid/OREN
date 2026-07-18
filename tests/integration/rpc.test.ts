/**
 * Tests d'intégration — RPC métier Supabase.
 *
 *   - create_document            : totaux recalculés en base, numérotation,
 *                                  validations (type, lignes vides).
 *   - convert_document_to_invoice: devis → facture, copie des lignes,
 *                                  refus sur une facture.
 *   - assert_quota               : quota « à vie » de l'offre gratuite (3),
 *                                  levée de QUOTA_EXCEEDED au dépassement.
 *
 * Prérequis : instance Supabase + migrations + variables d'env
 * (voir tests/helpers/supabase-env.ts). Sinon la suite est ignorée.
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

type ItemInput = { name: string; unit?: string; quantity: number; unit_price: number };

describe.skipIf(!env)("RPC — create_document / convert / assert_quota", () => {
  const testEnv = env as TestEnv;
  const createdUserIds: string[] = [];
  let admin: SupabaseClient;
  let client: SupabaseClient;
  let company: string;

  async function createDoc(payload: Record<string, unknown>) {
    return client.rpc("create_document", {
      p_company_id: company,
      p_payload: payload,
    });
  }

  beforeAll(async () => {
    admin = adminClient(testEnv);
    const user = await createTestUser(testEnv, admin, createdUserIds, "rpc");
    client = user.client;
    company = await createCompany(client, "Entreprise RPC");
  }, 30_000);

  afterAll(async () => {
    await cleanupUsers(admin, createdUserIds);
  });

  describe("create_document", () => {
    it("crée un devis, recalcule les totaux et attribue DEV-001", async () => {
      const items: ItemInput[] = [
        { name: "Tube PVC", unit: "mètre", quantity: 8, unit_price: 2500 }, // 20000
        { name: "Main d'œuvre", unit: "forfait", quantity: 1, unit_price: 25000 }, // 25000
      ];
      const { data, error } = await createDoc({
        type: "devis",
        title: "Devis test",
        client_name: "Client",
        items,
      });
      expect(error).toBeNull();
      expect(data.type).toBe("devis");
      expect(data.number).toBe("DEV-001");
      expect(data.status).toBe("brouillon");
      // TVA désactivée par défaut → total = sous-total (pas de remise ici).
      expect(data.subtotal).toBe(45000);
      expect(data.total).toBe(45000);
    });

    it("applique une remise plafonnée au sous-total", async () => {
      const { data, error } = await createDoc({
        type: "devis",
        discount: 5000,
        items: [{ name: "x", quantity: 1, unit_price: 30000 }],
      });
      expect(error).toBeNull();
      expect(data.subtotal).toBe(30000);
      expect(data.discount).toBe(5000);
      expect(data.total).toBe(25000);
    });

    it("gère les quantités décimales (arrondi de la ligne)", async () => {
      const { data, error } = await createDoc({
        type: "devis",
        items: [{ name: "Sable", unit: "m3", quantity: 2.5, unit_price: 12000 }],
      });
      expect(error).toBeNull();
      expect(data.subtotal).toBe(30000);
    });

    it("incrémente la numérotation par entreprise (DEV-002, DEV-003…)", async () => {
      const { data } = await createDoc({
        type: "devis",
        items: [{ name: "x", quantity: 1, unit_price: 1000 }],
      });
      // Plusieurs devis déjà créés → le compteur est strictement croissant.
      expect(data.number).toMatch(/^DEV-\d{3}$/);
      const n = Number(data.number.slice(4));
      expect(n).toBeGreaterThanOrEqual(4);
    });

    it("refuse un type invalide (INVALID_TYPE)", async () => {
      const { error } = await createDoc({
        type: "bon_de_commande",
        items: [{ name: "x", quantity: 1, unit_price: 1000 }],
      });
      expect(error?.message).toContain("INVALID_TYPE");
    });

    it("refuse un document sans ligne (NO_ITEMS)", async () => {
      const { error } = await createDoc({ type: "devis", items: [] });
      expect(error?.message).toContain("NO_ITEMS");
    });

    it("écrit une entrée dans le journal d'activité", async () => {
      const { data: doc } = await createDoc({
        type: "devis",
        items: [{ name: "log", quantity: 1, unit_price: 1000 }],
      });
      const { data: logs } = await client
        .from("activity_logs")
        .select("action, entity_id")
        .eq("entity_id", doc.id);
      expect((logs ?? []).some((l) => l.action === "document.created")).toBe(true);
    });
  });

  describe("convert_document_to_invoice", () => {
    it("convertit un devis en facture FAC-, copie les lignes et trace l'origine", async () => {
      const { data: quote } = await createDoc({
        type: "devis",
        title: "À convertir",
        items: [
          { name: "A", quantity: 2, unit_price: 1500 },
          { name: "B", quantity: 1, unit_price: 4000 },
        ],
      });

      const { data: invoice, error } = await client.rpc(
        "convert_document_to_invoice",
        { p_document_id: quote.id },
      );
      expect(error).toBeNull();
      expect(invoice.type).toBe("facture");
      expect(invoice.number).toMatch(/^FAC-\d{3}$/);
      expect(invoice.converted_from).toBe(quote.id);
      expect(invoice.total).toBe(quote.total);

      const { data: lines } = await client
        .from("document_items")
        .select("name, line_total")
        .eq("document_id", invoice.id)
        .order("position");
      expect(lines).toHaveLength(2);
      expect(lines?.[0]?.line_total).toBe(3000);
    });

    it("refuse de convertir une facture (NOT_CONVERTIBLE)", async () => {
      const { data: quote } = await createDoc({
        type: "devis",
        items: [{ name: "x", quantity: 1, unit_price: 1000 }],
      });
      const { data: invoice } = await client.rpc("convert_document_to_invoice", {
        p_document_id: quote.id,
      });
      const { error } = await client.rpc("convert_document_to_invoice", {
        p_document_id: invoice.id,
      });
      expect(error?.message).toContain("NOT_CONVERTIBLE");
    });
  });

  describe("assert_quota — offre gratuite (3 documents à vie)", () => {
    it("bloque la création au-delà du quota à vie de l'offre gratuite", async () => {
      // Entreprise neuve et isolée : quota gratuit = 3 documents au total.
      const user = await createTestUser(testEnv, admin, createdUserIds, "quota");
      const c = user.client;
      const quotaCompany = await createCompany(c, "Entreprise Quota");

      const make = () =>
        c.rpc("create_document", {
          p_company_id: quotaCompany,
          p_payload: {
            type: "devis",
            items: [{ name: "x", quantity: 1, unit_price: 1000 }],
          },
        });

      const r1 = await make();
      const r2 = await make();
      const r3 = await make();
      expect(r1.error).toBeNull();
      expect(r2.error).toBeNull();
      expect(r3.error).toBeNull();

      // 4ᵉ document → quota atteint.
      const r4 = await make();
      expect(r4.error?.message).toContain("QUOTA_EXCEEDED");

      // assert_quota appelée directement lève aussi l'exception.
      const { error } = await c.rpc("assert_quota", {
        p_company_id: quotaCompany,
      });
      expect(error?.message).toContain("QUOTA_EXCEEDED");
    }, 30_000);
  });
});
