// Semilla de categorías, tal como las define DATABASE_SCHEMA.md §2.5.
// Nota del documento: los nombres visibles deben validarse con un comercio
// antes de fijarse (CONTENT_STRATEGY.md). No se inventa vocabulario nuevo acá,
// se usa el que ya está en el documento normativo.

export type CategorySeed = {
  name: string;
  slug: string;
  sortOrder: number;
};

export const categorySeeds: CategorySeed[] = [
  { name: "Naked", slug: "naked", sortOrder: 10 },
  { name: "Scooter", slug: "scooter", sortOrder: 20 },
  { name: "Cub", slug: "cub", sortOrder: 30 },
  { name: "Enduro / Cross", slug: "enduro-cross", sortOrder: 40 },
  { name: "Touring", slug: "touring", sortOrder: 50 },
  { name: "Deportiva", slug: "deportiva", sortOrder: 60 },
  { name: "Custom / Chopper", slug: "custom-chopper", sortOrder: 70 },
  { name: "Motocarro de carga", slug: "motocarro-carga", sortOrder: 80 },
  { name: "Eléctrica", slug: "electrica", sortOrder: 90 },
  { name: "Cuatriciclo", slug: "cuatriciclo", sortOrder: 100 },
];
