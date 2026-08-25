import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Minimal seed: one university hierarchy + a sample guideline so the
// university/program selector has data to show. Idempotent.
async function main() {
  const university = await prisma.university.upsert({
    where: { name_country: { name: "Example University", country: "Somalia" } },
    update: {},
    create: { name: "Example University", country: "Somalia" },
  });

  const college = await prisma.college.upsert({
    where: {
      universityId_name: {
        universityId: university.id,
        name: "College of Graduate Studies",
      },
    },
    update: {},
    create: { name: "College of Graduate Studies", universityId: university.id },
  });

  const department = await prisma.department.upsert({
    where: {
      collegeId_name: { collegeId: college.id, name: "Research & Methodology" },
    },
    update: {},
    create: { name: "Research & Methodology", collegeId: college.id },
  });

  const program = await prisma.program.upsert({
    where: {
      departmentId_name: {
        departmentId: department.id,
        name: "MSc Research Methods",
      },
    },
    update: {},
    create: {
      name: "MSc Research Methods",
      degreeLevel: "Masters",
      departmentId: department.id,
    },
  });

  await prisma.guideline.upsert({
    where: {
      programId_category: {
        programId: program.id,
        category: "THESIS_CHAPTER",
      },
    },
    update: {},
    create: {
      programId: program.id,
      category: "THESIS_CHAPTER",
      citationStyle: "APA 7",
      referenceStyle: "APA 7",
      fontFamily: "Times New Roman",
      fontSizePt: 12,
      lineSpacing: 2.0,
      marginsCm: 2.54,
      minWords: 3000,
      requiredSections: [
        "Introduction",
        "Methodology",
        "Results",
        "Discussion",
        "References",
      ],
      prohibitedFormatting: ["Colored text", "Decorative fonts"],
    },
  });

  console.log("Seed complete: Example University → MSc Research Methods");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
