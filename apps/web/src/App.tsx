import { Toaster } from "sonner";
import { useMemo, useState } from "react";

import Header from "./components/header";
import SignInForm from "./components/sign-in-form";
import SignUpForm from "./components/sign-up-form";

function Dashboard() {
  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="mt-2 text-muted-foreground">
        SPA activa. Si iniciaste sesion correctamente, aqui puedes empezar a integrar tus modulos.
      </p>
    </main>
  );
}

function Login() {
  const [showSignIn, setShowSignIn] = useState(true);

  return (
    <main className="mx-auto max-w-2xl p-6">
      {showSignIn ? (
        <SignInForm onSwitchToSignUp={() => setShowSignIn(false)} />
      ) : (
        <SignUpForm onSwitchToSignIn={() => setShowSignIn(true)} />
      )}
    </main>
  );
}

export default function App() {
  const path = useMemo(() => window.location.pathname, []);

  return (
    <>
      <Header />
      {path === "/login" ? <Login /> : path === "/dashboard" ? <Dashboard /> : <Login />}
      <Toaster richColors />
    </>
  );
}