CREATE TABLE IF NOT EXISTS "golden_bulldogs" (
  "id" SERIAL PRIMARY KEY,
  "school_id" INTEGER NOT NULL REFERENCES "schools"("id"),
  "staff_id" INTEGER NOT NULL REFERENCES "staff"("id"),
  "student_id" INTEGER NOT NULL REFERENCES "students"("id"),
  "category_id" INTEGER NOT NULL REFERENCES "point_categories"("id"),
  "observed_date" DATE NOT NULL,
  "description" TEXT NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "golden_bulldogs_school_student_idx" ON "golden_bulldogs"("school_id", "student_id");
