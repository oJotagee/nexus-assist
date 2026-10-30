import type { Metadata } from 'next';

import { LoginForm } from './_components/login-form';
import { LoginHero } from './_components/login-hero';
import { NexoLogo } from '@/components/nexo-logo';

export const metadata: Metadata = { title: 'Entrar' };

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <LoginHero />

      <section className="flex flex-col bg-white px-6 py-6 sm:px-10">
        <header className="flex items-center justify-between gap-4 text-sm">
          <NexoLogo className="lg:invisible" />
          <p className="text-muted-foreground">
            Problemas para entrar?{' '}
            <a
              href="tel:4000"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Ligue no ramal 4000
            </a>
          </p>
        </header>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">
            <h1 className="font-serif text-4xl font-normal tracking-tight">Entrar</h1>
            <p className="mt-2 mb-8 text-sm text-muted-foreground">
              Use seu e-mail corporativo e a senha da rede Nexo.
            </p>
            <LoginForm />
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>© 2026 Nexo · Service desk de TI</span>
          <a href="#privacidade" className="hover:text-foreground">
            Privacidade e uso de dados
          </a>
        </footer>
      </section>
    </main>
  );
}
