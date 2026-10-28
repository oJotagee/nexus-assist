export type SeedEmployee = {
  id: string;
  name: string;
  email: string;
  department: string;
  role: 'EMPLOYEE' | 'ANALYST';
  supportLevel: 'N1' | 'N2' | null;
};

export const SEED_EMPLOYEES = [
  {
    id: 'emp_ana',
    name: 'Ana Souza',
    email: 'ana.souza@nexo.com.br',
    department: 'Financeiro',
    role: 'EMPLOYEE',
    supportLevel: null,
  },
  {
    id: 'emp_carla',
    name: 'Carla Mendes',
    email: 'carla.mendes@nexo.com.br',
    department: 'Comercial',
    role: 'EMPLOYEE',
    supportLevel: null,
  },
  {
    id: 'emp_bruno',
    name: 'Bruno Tavares',
    email: 'bruno.tavares@nexo.com.br',
    department: 'Marketing',
    role: 'EMPLOYEE',
    supportLevel: null,
  },
  {
    id: 'emp_diego',
    name: 'Diego Ramos',
    email: 'diego.ramos@nexo.com.br',
    department: 'Operações',
    role: 'EMPLOYEE',
    supportLevel: null,
  },
  {
    id: 'emp_elisa',
    name: 'Elisa Prado',
    email: 'elisa.prado@nexo.com.br',
    department: 'RH',
    role: 'EMPLOYEE',
    supportLevel: null,
  },
  {
    id: 'emp_fabio',
    name: 'Fábio Nunes',
    email: 'fabio.nunes@nexo.com.br',
    department: 'Jurídico',
    role: 'EMPLOYEE',
    supportLevel: null,
  },
  {
    id: 'emp_gabriela',
    name: 'Gabriela Rocha',
    email: 'gabriela.rocha@nexo.com.br',
    department: 'Engenharia',
    role: 'EMPLOYEE',
    supportLevel: null,
  },
  {
    id: 'emp_rafael',
    name: 'Rafael Lima',
    email: 'rafael.lima@nexo.com.br',
    department: 'TI',
    role: 'ANALYST',
    supportLevel: 'N2',
  },
  {
    id: 'emp_julia',
    name: 'Júlia Castro',
    email: 'julia.castro@nexo.com.br',
    department: 'TI',
    role: 'ANALYST',
    supportLevel: 'N1',
  },
  {
    id: 'emp_marcos',
    name: 'Marcos Vieira',
    email: 'marcos.vieira@nexo.com.br',
    department: 'TI',
    role: 'ANALYST',
    supportLevel: 'N1',
  },
] as const satisfies readonly SeedEmployee[];

export type SeedEmployeeId = (typeof SEED_EMPLOYEES)[number]['id'];
