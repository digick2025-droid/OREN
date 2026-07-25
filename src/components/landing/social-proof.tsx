import { MapPin } from "lucide-react";

/* =============================================================
   OREN · Preuve sociale de la landing.

   Tant qu'il n'existe pas de vrais témoignages, on affiche une
   promesse honnête (aucun chiffre, aucun avatar inventé). Le jour où
   de vraies références existent, il suffit de passer `proofs` : la
   rangée d'avatars s'affiche à la place du pictogramme.
   ============================================================= */

export type LandingProof = {
  /** Initiales affichées dans la pastille. */
  initials: string;
  /** Nom complet — lu par les lecteurs d'écran. */
  name: string;
};

/** Teintes de pastille, piochées à tour de rôle (tokens, jamais de hex). */
const PROOF_TONES = [
  "bg-info",
  "bg-warning",
  "bg-success",
  "bg-accent",
] as const;

export function SocialProof({
  title,
  note,
  proofs = [],
}: {
  title: string;
  note?: string;
  proofs?: LandingProof[];
}) {
  return (
    <div className="mt-6 flex items-center gap-3">
      {proofs.length > 0 ? (
        <div className="flex shrink-0">
          {proofs.map((proof, index) => (
            <span
              key={proof.name}
              title={proof.name}
              className={`-ml-2.5 grid h-[34px] w-[34px] place-items-center rounded-full border-2 border-brand-navy text-[13px] font-extrabold text-white first:ml-0 ${PROOF_TONES[index % PROOF_TONES.length]}`}
            >
              {proof.initials}
            </span>
          ))}
        </div>
      ) : (
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10">
          <MapPin className="h-[18px] w-[18px] text-coral" />
        </span>
      )}
      <p className="text-[13px] leading-snug text-white/70">
        <b className="font-bold text-white">{title}</b>
        {note ? <span className="block">{note}</span> : null}
      </p>
    </div>
  );
}
