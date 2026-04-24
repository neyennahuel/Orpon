import { prisma } from "./prisma";

export async function getPriceSettings() {
  return prisma.priceSetting.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
}
