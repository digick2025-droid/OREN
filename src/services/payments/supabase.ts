/**
 * Le client service role a quitté ce dossier : les relances push s'en servent
 * aussi, et rien dans son rôle n'est propre aux paiements. Réexporté ici pour
 * ne pas casser les imports (et les mocks de tests) existants.
 */
export { createServiceClient } from "@/lib/supabase/service";
