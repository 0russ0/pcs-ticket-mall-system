import { prisma } from "@/lib/prisma";

export const DEFAULT_SETTINGS = {
  max_points_per_day: "0", // 0 = unlimited
  point_expiration_days: "0", // 0 = no expiration
  allow_negative_points: "false",
  store_status: "open", // open | closed
};

export async function getSettings(schoolId: number): Promise<Record<string, string>> {
  const rows = await prisma.adminSetting.findMany({ where: { schoolId } });
  const settings: Record<string, string> = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    if (row.settingValue !== null) settings[row.settingKey] = row.settingValue;
  }
  return settings;
}

export async function getSetting(schoolId: number, key: string): Promise<string> {
  const row = await prisma.adminSetting.findUnique({
    where: { schoolId_settingKey: { schoolId, settingKey: key } },
  });
  return row?.settingValue ?? DEFAULT_SETTINGS[key as keyof typeof DEFAULT_SETTINGS] ?? "";
}

export async function setSetting(schoolId: number, key: string, value: string) {
  return prisma.adminSetting.upsert({
    where: { schoolId_settingKey: { schoolId, settingKey: key } },
    create: { schoolId, settingKey: key, settingValue: value },
    update: { settingValue: value },
  });
}
