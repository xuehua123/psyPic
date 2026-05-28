type PrismaClientConstructor<TClient> = new (options: {
  adapter: unknown;
}) => TClient;

type PrismaPgConstructor = new (options: {
  connectionString: string;
}) => unknown;

export async function createPostgresPrismaClient<TClient>(
  PrismaClient: PrismaClientConstructor<TClient>
) {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for database Prisma stores");
  }

  const adapterModule = (await import("@prisma/adapter-pg")) as {
    PrismaPg?: PrismaPgConstructor;
  };

  if (!adapterModule.PrismaPg) {
    throw new Error("@prisma/adapter-pg did not export PrismaPg");
  }

  return new PrismaClient({
    adapter: new adapterModule.PrismaPg({
      connectionString: databaseUrl
    })
  });
}
