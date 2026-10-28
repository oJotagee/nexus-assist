import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.email('Informe um e-mail válido.').trim().toLowerCase(),
  password: z.string().min(1, 'Informe a senha.'),
  remember: z.boolean(),
});

export type LoginSchemaData = z.infer<typeof loginSchema>;

export function useLoginSchema() {
  return useForm<LoginSchemaData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', remember: true },
    mode: 'onBlur',
  });
}
