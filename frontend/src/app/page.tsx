import { redirect } from 'next/navigation';

// O proxy já redireciona por papel; isto cobre o acesso sem sessão.
export default function Home() {
  redirect('/login');
}
