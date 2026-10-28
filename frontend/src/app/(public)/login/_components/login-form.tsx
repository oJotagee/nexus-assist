'use client';

import { useMutation } from '@tanstack/react-query';
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getSession, signIn } from 'next-auth/react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Field, FieldContent, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { type LoginSchemaData, useLoginSchema } from './schemas';

const DEMO_ACCOUNTS = [
  { email: 'ana.souza@nexo.com.br', label: 'Ana · funcionária' },
  { email: 'fabio.nunes@nexo.com.br', label: 'Fábio · funcionário' },
  { email: 'rafael.lima@nexo.com.br', label: 'Rafael · analista N2' },
];

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setValue,
    setFocus,
    formState: { errors },
  } = useLoginSchema();

  const login = useMutation({
    mutationFn: async (values: LoginSchemaData) => {
      const result = await signIn('credentials', {
        email: values.email,
        password: values.password,
        redirect: false,
      });

      if (result?.error === 'CredentialsSignin') {
        throw new Error('Não encontramos esse e-mail corporativo.');
      }
      if (result?.error)
        throw new Error('Não foi possível entrar agora. Tente novamente em instantes.');

      return getSession();
    },
    onSuccess: (session) => {
      router.replace(session?.user.role === 'ANALYST' ? '/console' : '/atendimento');
      router.refresh();
    },
  });

  function fillDemo(email: string) {
    setValue('email', email, { shouldValidate: true });
    setValue('password', 'demo', { shouldValidate: true });
    setFocus('password');
  }

  return (
    <form
      className="flex flex-col gap-5"
      noValidate
      onSubmit={handleSubmit((values) => login.mutate(values))}
    >
      <Field data-invalid={!!errors.email}>
        <FieldLabel htmlFor="login-email">E-mail corporativo</FieldLabel>
        <FieldContent>
          <div className="relative">
            <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="login-email"
              type="email"
              autoComplete="username"
              placeholder="ana.souza@nexo.com.br"
              className="h-11 pl-9"
              aria-invalid={!!errors.email}
              {...register('email')}
            />
          </div>
          <FieldError errors={[errors.email]} />
        </FieldContent>
      </Field>

      <Field data-invalid={!!errors.password}>
        <div className="flex items-center justify-between">
          <FieldLabel htmlFor="login-password">Senha</FieldLabel>
          <a
            href="tel:4000"
            className="text-xs font-medium text-primary underline-offset-4 hover:underline"
          >
            Esqueci minha senha
          </a>
        </div>
        <FieldContent>
          <div className="relative">
            <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              className="h-11 px-9"
              aria-invalid={!!errors.password}
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <FieldError errors={[errors.password]} />
        </FieldContent>
      </Field>

      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          className="size-4 rounded accent-primary"
          {...register('remember')}
        />
        Manter conectado neste computador
      </label>

      {login.error && (
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          {login.error.message}
        </p>
      )}

      <Button type="submit" size="lg" className="h-11 w-full text-sm" disabled={login.isPending}>
        {login.isPending ? <Loader2 className="animate-spin" /> : null}
        Entrar
        {!login.isPending && <ArrowRight />}
      </Button>

      <div className="mt-2 rounded-lg border border-dashed p-3">
        <p className="text-xs text-muted-foreground">
          Protótipo: qualquer senha funciona para as contas de exemplo.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => fillDemo(account.email)}
              className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {account.label}
            </button>
          ))}
        </div>
      </div>
    </form>
  );
}
