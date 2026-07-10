-- Add lifetime_points column to students (never decremented on redemption)
ALTER TABLE "students" ADD COLUMN "lifetime_points" INTEGER NOT NULL DEFAULT 0;

-- Backfill: set lifetime_points = sum of all positive point awards per student
UPDATE "students" s
SET "lifetime_points" = COALESCE((
  SELECT SUM(pa.points)
  FROM "point_awards" pa
  WHERE pa.student_id = s.id AND pa.points > 0
), 0);
