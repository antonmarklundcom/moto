// Semilla curada de ciudades (DATABASE_SCHEMA.md §2.3).
// Departamentos verificados por geografía política de Paraguay (fuentes: Wikipedia
// "Fernando de la Mora, Paraguay", "Alto Paraná Department", municipios.gov.py).
// Asunción es Distrito Capital, no pertenece a ningún departamento — se deja
// constancia explícita en vez de inventar un departamento.
// [VERIFICAR: grafía oficial con acentos y nombres de departamento contra fuente
// oficial de la Dirección General de Estadística, Encuestas y Censos antes de
// producción, tal como pide DATABASE_SCHEMA.md §2.3.]

export type CitySeed = {
  name: string;
  slug: string;
  department: string;
  isMetroAsuncion: boolean;
  sortOrder: number;
};

export const citySeeds: CitySeed[] = [
  { name: "Asunción", slug: "asuncion", department: "Distrito Capital", isMetroAsuncion: true, sortOrder: 10 },
  { name: "San Lorenzo", slug: "san-lorenzo", department: "Central", isMetroAsuncion: true, sortOrder: 20 },
  { name: "Luque", slug: "luque", department: "Central", isMetroAsuncion: true, sortOrder: 30 },
  { name: "Capiatá", slug: "capiata", department: "Central", isMetroAsuncion: true, sortOrder: 40 },
  { name: "Lambaré", slug: "lambare", department: "Central", isMetroAsuncion: true, sortOrder: 50 },
  { name: "Fernando de la Mora", slug: "fernando-de-la-mora", department: "Central", isMetroAsuncion: true, sortOrder: 60 },
  { name: "Ñemby", slug: "nemby", department: "Central", isMetroAsuncion: true, sortOrder: 70 },
  { name: "Mariano Roque Alonso", slug: "mariano-roque-alonso", department: "Central", isMetroAsuncion: true, sortOrder: 80 },
  { name: "Limpio", slug: "limpio", department: "Central", isMetroAsuncion: true, sortOrder: 90 },
  { name: "Ciudad del Este", slug: "ciudad-del-este", department: "Alto Paraná", isMetroAsuncion: false, sortOrder: 100 },
  { name: "Encarnación", slug: "encarnacion", department: "Itapúa", isMetroAsuncion: false, sortOrder: 110 },
  { name: "Pedro Juan Caballero", slug: "pedro-juan-caballero", department: "Amambay", isMetroAsuncion: false, sortOrder: 120 },
  { name: "Coronel Oviedo", slug: "coronel-oviedo", department: "Caaguazú", isMetroAsuncion: false, sortOrder: 130 },
  { name: "Villarrica", slug: "villarrica", department: "Guairá", isMetroAsuncion: false, sortOrder: 140 },
  { name: "Concepción", slug: "concepcion", department: "Concepción", isMetroAsuncion: false, sortOrder: 150 },
];
