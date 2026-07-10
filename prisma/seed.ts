import { PrismaClient, ProductCategory } from "@prisma/client";
import { refreshLeaderboard, TEAMS } from "../lib/leaderboard";

const prisma = new PrismaClient();

const SCHOOLS = [
  { name: "Pleasant Valley Elementary", slug: "pleasant-valley" },
  { name: "Riverside Elementary", slug: "riverside" },
];

const CATEGORIES = ["Perseverance", "Compassion", "Self-Control"];

const PRODUCTS: { name: string; description?: string; pointsCost: number; category: ProductCategory; inventoryLimit: number | null }[] = [
  // Physical Items
  { name: "Colored Pencil Pack (12)", description: "12 colored pencils in a wooden box", pointsCost: 50, category: "physical_item", inventoryLimit: 100 },
  { name: "Eraser Set", pointsCost: 25, category: "physical_item", inventoryLimit: 100 },
  { name: "Pencil Case", pointsCost: 40, category: "physical_item", inventoryLimit: 100 },
  { name: "Notebook (100 pages)", pointsCost: 35, category: "physical_item", inventoryLimit: 100 },
  { name: "Sticker Sheet Pack", pointsCost: 20, category: "physical_item", inventoryLimit: 200 },
  { name: "Bookmarks (5-pack)", pointsCost: 15, category: "physical_item", inventoryLimit: 200 },
  { name: "Water Bottle (school branded)", pointsCost: 75, category: "physical_item", inventoryLimit: 50 },
  { name: "Backpack", pointsCost: 150, category: "physical_item", inventoryLimit: 20 },
  { name: "T-Shirt (school branded)", pointsCost: 100, category: "physical_item", inventoryLimit: 50 },
  { name: "Hat/Visor (school branded)", pointsCost: 60, category: "physical_item", inventoryLimit: 50 },
  { name: "Headphones (basic)", pointsCost: 200, category: "physical_item", inventoryLimit: 20 },
  { name: "Gift Card ($5)", pointsCost: 100, category: "physical_item", inventoryLimit: 30 },
  { name: "Gift Card ($10)", pointsCost: 200, category: "physical_item", inventoryLimit: 30 },
  { name: "Book (student choice)", pointsCost: 125, category: "physical_item", inventoryLimit: 50 },
  { name: "Puzzle (50-piece)", pointsCost: 80, category: "physical_item", inventoryLimit: 30 },
  { name: "Craft Kit", pointsCost: 90, category: "physical_item", inventoryLimit: 30 },
  { name: "Fidget Spinner", pointsCost: 30, category: "physical_item", inventoryLimit: 100 },
  { name: "Trading Card Pack", pointsCost: 50, category: "physical_item", inventoryLimit: 100 },
  { name: "School Supplies Bundle", pointsCost: 110, category: "physical_item", inventoryLimit: 50 },
  { name: "Lunch Box", pointsCost: 95, category: "physical_item", inventoryLimit: 30 },

  // Experiences
  { name: "Movie Time in Classroom", pointsCost: 200, category: "experience", inventoryLimit: null },
  { name: "Special Lunch with Principal", pointsCost: 300, category: "experience", inventoryLimit: 10 },
  { name: "Extra Recess (15 min)", pointsCost: 100, category: "experience", inventoryLimit: null },
  { name: "Field Trip (local museum)", pointsCost: 500, category: "experience", inventoryLimit: 30 },
  { name: "Pizza Party (class)", pointsCost: 400, category: "experience", inventoryLimit: null },
  { name: "Ice Cream Social", pointsCost: 250, category: "experience", inventoryLimit: null },
  { name: "Skateboard/Roller Skate Day", pointsCost: 350, category: "experience", inventoryLimit: 30 },
  { name: "Music/Dance Performance", pointsCost: 275, category: "experience", inventoryLimit: 30 },
  { name: "Outdoor Adventure Day", pointsCost: 450, category: "experience", inventoryLimit: 30 },
  { name: "Science Experiment Day", pointsCost: 350, category: "experience", inventoryLimit: 30 },
  { name: "Art Class (special instructor)", pointsCost: 300, category: "experience", inventoryLimit: 30 },
  { name: "Bowling Trip", pointsCost: 350, category: "experience", inventoryLimit: 30 },
  { name: "Water Park Day", pointsCost: 500, category: "experience", inventoryLimit: 30 },
  { name: "Sports Event Tickets", pointsCost: 300, category: "experience", inventoryLimit: 20 },
  { name: "Game Tournament (school-wide)", pointsCost: 250, category: "experience", inventoryLimit: null },
  { name: "Virtual Reality Experience", pointsCost: 400, category: "experience", inventoryLimit: 20 },
  { name: "Coding/Tech Workshop", pointsCost: 350, category: "experience", inventoryLimit: 30 },
  { name: "Drama/Theater Performance", pointsCost: 300, category: "experience", inventoryLimit: 30 },
  { name: "Talent Show Slot", pointsCost: 200, category: "experience", inventoryLimit: 20 },
  { name: "Nature Center Trip", pointsCost: 450, category: "experience", inventoryLimit: 30 },

  // Privileges
  { name: "Homework Pass (skip 1 assignment)", pointsCost: 75, category: "privilege", inventoryLimit: null },
  { name: "Free Choice Time (30 min)", pointsCost: 50, category: "privilege", inventoryLimit: null },
  { name: "Line Leader for a Week", pointsCost: 40, category: "privilege", inventoryLimit: null },
  { name: "Classroom DJ (pick playlist)", pointsCost: 60, category: "privilege", inventoryLimit: null },
  { name: "No Uniform Day", pointsCost: 85, category: "privilege", inventoryLimit: null },
  { name: "Lunch with Teacher of Choice", pointsCost: 100, category: "privilege", inventoryLimit: null },
  { name: "Extra Computer/Tablet Time", pointsCost: 80, category: "privilege", inventoryLimit: null },
  { name: "Pet for a Day (classroom)", pointsCost: 120, category: "privilege", inventoryLimit: null },
  { name: "Teacher's Helper Role", pointsCost: 70, category: "privilege", inventoryLimit: null },
  { name: "Choose Next Class Activity", pointsCost: 65, category: "privilege", inventoryLimit: null },
];

const GRADES = ["K", "1", "2", "3", "4", "5"];
const FIRST_NAMES = ["Olivia", "Liam", "Emma", "Noah", "Ava", "Ethan", "Sophia", "Mason", "Isabella", "James", "Mia", "Lucas", "Charlotte", "Henry", "Amelia", "Alexander", "Harper", "Benjamin", "Evelyn", "Logan", "Abigail", "Jacob", "Emily", "Michael", "Ella"];
const LAST_NAMES = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson", "White", "Harris"];

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

async function main() {
  for (const schoolData of SCHOOLS) {
    const school = await prisma.school.upsert({
      where: { slug: schoolData.slug },
      create: schoolData,
      update: {},
    });

    console.log(`Seeding ${school.name}...`);

    // Categories
    for (const name of CATEGORIES) {
      await prisma.pointCategory.upsert({
        where: { schoolId_name: { schoolId: school.id, name } },
        create: { schoolId: school.id, name, isActive: true },
        update: {},
      });
    }

    // Default settings
    const defaultSettings: Record<string, string> = {
      max_points_per_day: "0",
      point_expiration_days: "0",
      allow_negative_points: "false",
      store_status: "open",
    };
    for (const [key, value] of Object.entries(defaultSettings)) {
      await prisma.adminSetting.upsert({
        where: { schoolId_settingKey: { schoolId: school.id, settingKey: key } },
        create: { schoolId: school.id, settingKey: key, settingValue: value },
        update: {},
      });
    }

    // Products (50)
    const existingProducts = await prisma.product.count({ where: { schoolId: school.id } });
    if (existingProducts === 0) {
      await prisma.product.createMany({
        data: PRODUCTS.map((p) => ({
          schoolId: school.id,
          name: p.name,
          description: p.description || null,
          pointsCost: p.pointsCost,
          category: p.category,
          inventoryLimit: p.inventoryLimit,
          inventoryAvailable: p.inventoryLimit,
          isActive: true,
        })),
      });
    }

    // 225 students across 6 grades, ~6 homerooms per grade, 4 teams
    const existingStudents = await prisma.student.count({ where: { schoolId: school.id } });
    if (existingStudents === 0) {
      const studentsData = [];
      let idCounter = 1;
      const studentsPerGrade = Math.ceil(225 / GRADES.length);

      for (const grade of GRADES) {
        for (let i = 0; i < studentsPerGrade; i++) {
          const homeroomNum = (i % 2) + 1;
          const homeroom = `${grade}-${homeroomNum === 1 ? "Room A" : "Room B"}`;
          const team = TEAMS[idCounter % TEAMS.length];
          studentsData.push({
            schoolId: school.id,
            externalId: `${schoolData.slug.toUpperCase().slice(0, 2)}${String(idCounter).padStart(4, "0")}`,
            firstName: pick(FIRST_NAMES, idCounter),
            lastName: pick(LAST_NAMES, idCounter + 7),
            grade,
            homeroom,
            team,
            totalPoints: Math.floor(Math.random() * 200),
          });
          idCounter++;
          if (studentsData.length >= 225) break;
        }
        if (studentsData.length >= 225) break;
      }

      await prisma.student.createMany({ data: studentsData });
    }

    // 75 staff (1 admin, rest teachers) - placeholder emails for SSO mapping
    const existingStaff = await prisma.staff.count({ where: { schoolId: school.id } });
    if (existingStaff === 0) {
      const staffData = [];
      for (let i = 1; i <= 75; i++) {
        staffData.push({
          schoolId: school.id,
          googleEmail: `${schoolData.slug}.staff${i}@example.edu`,
          firstName: pick(FIRST_NAMES, i + 3),
          lastName: pick(LAST_NAMES, i),
          role: i === 1 ? ("admin" as const) : ("teacher" as const),
        });
      }
      await prisma.staff.createMany({ data: staffData });
    }

    await refreshLeaderboard(school.id);
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
