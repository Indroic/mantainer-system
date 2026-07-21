import { createFileRoute, Link } from "@tanstack/react-router";

import SignInForm from "@/components/sign-in-form";

export const Route = createFileRoute("/login")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="relative flex h-screen w-screen items-center justify-center bg-slate-950 overflow-hidden text-slate-100 font-sans">
      {/* Círculos con gradiente decorativos en el fondo */}
      <div className="absolute top-1/4 left-1/4 size-[400px] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 size-[400px] rounded-full bg-cyan-600/10 blur-[120px] pointer-events-none" />

      {/* Contenedor central premium Glassmorphic */}
      <div className="relative z-10 w-full max-w-md mx-4 rounded-3xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-2xl p-8 shadow-2xl shadow-slate-950/50">
        <div className="flex justify-center gap-2 items-center mb-6">
          <div className="p-2.5 rounded-xl bg-indigo-600/20 border border-indigo-500/30">
            <svg className="size-6 text-indigo-400 animate-spin-slow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
            SGMM Portal
          </span>
        </div>

        <SignInForm />

        <div className="mt-6 border-t border-slate-800/80 pt-4 text-center">
          <Link
            to="/setup-admin"
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-400 transition-colors hover:text-indigo-400"
          >
            Configurar administrador inicial
          </Link>
        </div>
      </div>
    </div>
  );
}
