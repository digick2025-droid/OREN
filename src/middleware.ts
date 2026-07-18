import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // La galerie /design-system est un outil de développement : on la masque en
  // production (404) tout en la laissant accessible en local.
  if (
    process.env.NODE_ENV === "production" &&
    request.nextUrl.pathname.startsWith("/design-system")
  ) {
    return new NextResponse(null, { status: 404 });
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Tout sauf les fichiers statiques et images.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
