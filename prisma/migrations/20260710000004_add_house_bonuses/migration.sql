CREATE TABLE IF NOT EXISTS "house_bonuses" (
  "id" SERIAL PRIMARY KEY,
  "school_id" INTEGER NOT NULL REFERENCES "schools"("id"),
  "staff_id" INTEGER NOT NULL REFERENCES "staff"("id"),
  "house" VARCHAR(100) NOT NULL,
  "points" INTEGER NOT NULL,
  "reason" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "house_bonuses_school_id_house_idx" ON "house_bonuses"("school_id", "house");
