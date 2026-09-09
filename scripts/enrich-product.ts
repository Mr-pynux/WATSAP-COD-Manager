// Enrich the existing ShoeSpot product in the live DB with description + features
// (no re-seed → existing demo orders are preserved)
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const p = await prisma.product.findFirst({ where: { active: true } });
  if (!p) {
    console.log("no product found");
    return;
  }
  await prisma.product.update({
    where: { id: p.id },
    data: {
      name: "سنيكرز ShoeSpot Urban",
      description:
        "سنيكرز خفيف ومريح بتصميم عصري، صالح للاستعمال اليومي وللرياضة — والتوصيل فابور لجميع المدن، وكتخلص فقط ملي توصلك السلعة لباب دارك.",
      features: JSON.stringify([
        "جلد صناعي عالي الجودة كيتنفس",
        "نعل مطاطي مضاد للانزلاق",
        "خفيف بزاف — مناسب للمشي الطويل",
        "تصميم عصري كيمشي مع كل اللبسة",
      ]),
    },
  });
  console.log("product updated:", p.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
