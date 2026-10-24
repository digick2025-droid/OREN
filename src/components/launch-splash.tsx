/* =============================================================
   OREN — Écran d'ouverture de l'app installée
   Prend le relais de l'écran de lancement natif d'Android (fond + icône,
   non animable) : l'anneau se trace, les lignes de vitesse arrivent, le mot
   OREN apparaît, puis l'écran s'efface sur l'app.

   100 % HTML/CSS rendu côté serveur : visible dès le premier affichage, sans
   attendre l'hydratation. N'apparaît qu'en mode installé (display-mode
   standalone, voir globals.css) et une fois par lancement : un rechargement
   ou une redirection après connexion ne le rejoue pas.
   ============================================================= */

const SEEN_KEY = "oren_splash";

/** Script bloquant, à placer dans <head> : masque l'écran s'il a déjà été vu. */
export const LAUNCH_SPLASH_SCRIPT = `
(function(){try{
  if(!window.matchMedia("(display-mode: standalone)").matches)return;
  if(sessionStorage.getItem("${SEEN_KEY}"))document.documentElement.classList.add("splash-seen");
  else sessionStorage.setItem("${SEEN_KEY}","1");
}catch(e){}})();
`;

export function LaunchSplash() {
  return (
    <div className="launch-splash" aria-hidden="true">
      <svg viewBox="0 0 124 104" fill="none" className="launch-splash__mark">
        <g
          stroke="hsl(var(--accent))"
          strokeWidth="14"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path
            className="launch-splash__ring"
            d="M34 36.6 A41 41 0 1 1 34.5 68.7"
            pathLength={1}
          />
          <line className="launch-splash__bar" x1="14" y1="44" x2="56" y2="44" />
          <line
            className="launch-splash__bar launch-splash__bar--2"
            x1="8"
            y1="60"
            x2="50"
            y2="60"
          />
        </g>
      </svg>
      <span className="launch-splash__word">OREN</span>
    </div>
  );
}
