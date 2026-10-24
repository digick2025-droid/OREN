import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  enqueueDocument,
  isNetworkError,
  outboxFor,
  readOutbox,
  syncOutbox,
} from "./outbox";
import type { CreateDocumentPayload } from "@/types/database";

/** localStorage, window et navigator minimaux : l'environnement est `node`. */
function installerNavigateur(): void {
  const donnees = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (c: string) => donnees.get(c) ?? null,
    setItem: (c: string, v: string) => void donnees.set(c, v),
    removeItem: (c: string) => void donnees.delete(c),
  });
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("navigator", { onLine: true });
}

function payload(title: string): CreateDocumentPayload {
  return {
    type: "devis",
    status: "brouillon",
    client_id: null,
    client_name: "",
    client_phone: "",
    title,
    note: "",
    conditions: "",
    discount: 0,
    items: [{ name: "Câble", unit: "m", category: "article", quantity: 2, unit_price: 500 }],
  };
}

type Reponse = { data: unknown; error: { message: string } | null };

/**
 * Faux client Supabase : `rpc` et l'insertion de client répondent selon les
 * files fournies ; la recherche de doublon renvoie `existants`.
 */
function fauxSupabase(opts: {
  rpc?: Reponse[];
  client?: Reponse[];
  existants?: Reponse;
}) {
  const rpc = vi.fn(async () => opts.rpc?.shift() ?? { data: null, error: null });
  const insertClient = vi.fn();
  const recherche = {
    select: () => recherche,
    eq: () => recherche,
    gte: () => recherche,
    is: () => recherche,
    limit: async () => opts.existants ?? { data: [], error: null },
  };
  const from = vi.fn((table: string) => {
    if (table === "clients") {
      return {
        insert: (values: unknown) => {
          insertClient(values);
          return {
            select: () => ({
              single: async () => opts.client?.shift() ?? { data: null, error: null },
            }),
          };
        },
      };
    }
    return recherche;
  });
  return {
    supabase: { rpc, from } as unknown as SupabaseClient,
    rpc,
    insertClient,
  };
}

const RESEAU = { data: null, error: { message: "TypeError: Failed to fetch" } };

beforeEach(() => {
  installerNavigateur();
});

describe("isNetworkError", () => {
  it("reconnaît les échecs fetch des trois moteurs", () => {
    expect(isNetworkError(new Error("TypeError: Failed to fetch"))).toBe(true);
    expect(isNetworkError({ message: "Load failed" })).toBe(true);
    expect(
      isNetworkError(new Error("NetworkError when attempting to fetch resource.")),
    ).toBe(true);
  });

  it("ne confond pas un refus de la base avec une coupure", () => {
    expect(isNetworkError(new Error("QUOTA_EXCEEDED"))).toBe(false);
    expect(isNetworkError({ message: "FORBIDDEN" })).toBe(false);
  });

  it("considère toute erreur comme réseau quand le navigateur est hors ligne", () => {
    vi.stubGlobal("navigator", { onLine: false });
    expect(isNetworkError(new Error("QUOTA_EXCEEDED"))).toBe(true);
  });
});

describe("syncOutbox", () => {
  it("envoie dans l'ordre de saisie et vide la boîte", async () => {
    enqueueDocument({ companyId: "c1", payload: payload("A"), total: 1000 });
    enqueueDocument({ companyId: "c1", payload: payload("B"), total: 1000 });
    const { supabase, rpc } = fauxSupabase({
      rpc: [
        { data: { id: "d1", type: "devis" }, error: null },
        { data: { id: "d2", type: "devis" }, error: null },
      ],
    });

    const { synced } = await syncOutbox(supabase, "c1");

    expect(synced.map((d) => d.id)).toEqual(["d1", "d2"]);
    expect(rpc.mock.calls.map((c) => (c as unknown[])[1])).toMatchObject([
      { p_company_id: "c1", p_payload: { title: "A" } },
      { p_company_id: "c1", p_payload: { title: "B" } },
    ]);
    expect(readOutbox()).toEqual([]);
  });

  it("n'envoie jamais les documents d'une autre entreprise", async () => {
    enqueueDocument({ companyId: "autre", payload: payload("X"), total: 1000 });
    const { supabase, rpc } = fauxSupabase({});

    await syncOutbox(supabase, "c1");

    expect(rpc).not.toHaveBeenCalled();
    expect(outboxFor("autre")).toHaveLength(1);
  });

  it("s'arrête à la première coupure et garde tout", async () => {
    enqueueDocument({ companyId: "c1", payload: payload("A"), total: 1000 });
    enqueueDocument({ companyId: "c1", payload: payload("B"), total: 1000 });
    const { supabase, rpc } = fauxSupabase({ rpc: [RESEAU] });

    const { synced, failed } = await syncOutbox(supabase, "c1");

    expect(synced).toEqual([]);
    expect(failed).toEqual([]);
    expect(rpc).toHaveBeenCalledTimes(1);
    const [a, b] = outboxFor("c1");
    expect(a?.attempts).toBe(1);
    expect(a?.error).toBeUndefined();
    expect(b?.attempts).toBe(0);
  });

  it("marque un refus de la base et passe au suivant", async () => {
    enqueueDocument({ companyId: "c1", payload: payload("A"), total: 1000 });
    enqueueDocument({ companyId: "c1", payload: payload("B"), total: 1000 });
    const { supabase } = fauxSupabase({
      rpc: [
        { data: null, error: { message: "QUOTA_EXCEEDED" } },
        { data: { id: "d2", type: "devis" }, error: null },
      ],
    });

    const { synced, failed } = await syncOutbox(supabase, "c1");

    expect(synced.map((d) => d.id)).toEqual(["d2"]);
    expect(failed).toHaveLength(1);
    expect(outboxFor("c1")).toMatchObject([
      { payload: { title: "A" }, error: "QUOTA_EXCEEDED" },
    ]);
  });

  it("crée le client saisi hors ligne avant le document, une seule fois", async () => {
    enqueueDocument({
      companyId: "c1",
      payload: payload("A"),
      newClient: { name: "Awa", phone: "690000000" },
      total: 1000,
    });
    const premier = fauxSupabase({
      client: [{ data: { id: "cl1" }, error: null }],
      rpc: [RESEAU],
    });
    await syncOutbox(premier.supabase, "c1");
    expect(premier.insertClient).toHaveBeenCalledWith({
      company_id: "c1",
      name: "Awa",
      phone: "690000000",
    });

    // Second essai : le client existe déjà, seul le document part.
    const second = fauxSupabase({ rpc: [{ data: { id: "d1", type: "devis" }, error: null }] });
    await syncOutbox(second.supabase, "c1");

    expect(second.insertClient).not.toHaveBeenCalled();
    expect(second.rpc).toHaveBeenCalledWith("create_document", {
      p_company_id: "c1",
      p_payload: expect.objectContaining({ client_id: "cl1" }),
    });
    expect(readOutbox()).toEqual([]);
  });

  it("ne recrée pas un document déjà arrivé en base lors d'un essai précédent", async () => {
    enqueueDocument({ companyId: "c1", payload: payload("A"), total: 1000 });
    // Premier essai : la réponse se perd en route.
    await syncOutbox(fauxSupabase({ rpc: [RESEAU] }).supabase, "c1");

    const { supabase, rpc } = fauxSupabase({
      existants: { data: [{ id: "d1", type: "devis" }], error: null },
    });
    const { synced } = await syncOutbox(supabase, "c1");

    expect(rpc).not.toHaveBeenCalled();
    expect(synced.map((d) => d.id)).toEqual(["d1"]);
    expect(readOutbox()).toEqual([]);
  });
});
