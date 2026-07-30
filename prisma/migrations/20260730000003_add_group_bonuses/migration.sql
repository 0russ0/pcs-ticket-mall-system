CREATE TABLE IF NOT EXISTS "group_bonuses" (
  "id" SERIAL PRIMARY KEY,
  "school_id" INTEGER NOT NULL REFERENCES "schools"("id"),
  "staff_id" INTEGER NOT NULL REFERENCES "staff"("id"),
  "group_type" VARCHAR(20) NOT NULL,
  "group_value" VARCHAR(200) NOT NULL,
  "points" INTEGER NOT NULL,
  "reason" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "group_bonuses_school_type_value_idx" ON "group_bonuses"("school_id", "group_type", "group_value");
