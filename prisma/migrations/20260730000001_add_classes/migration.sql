CREATE TABLE IF NOT EXISTS "classes" (
  "id" SERIAL PRIMARY KEY,
  "school_id" INTEGER NOT NULL REFERENCES "schools"("id"),
  "teacher_id" INTEGER NOT NULL REFERENCES "staff"("id"),
  "name" VARCHAR(200) NOT NULL,
  "period" VARCHAR(50),
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE ("school_id", "teacher_id", "name", "period")
);

CREATE TABLE IF NOT EXISTS "student_classes" (
  "id" SERIAL PRIMARY KEY,
  "student_id" INTEGER NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "class_id" INTEGER NOT NULL REFERENCES "classes"("id") ON DELETE CASCADE,
  UNIQUE ("student_id", "class_id")
);

CREATE INDEX IF NOT EXISTS "classes_school_id_teacher_id_idx" ON "classes"("school_id", "teacher_id");
CREATE INDEX IF NOT EXISTS "student_classes_class_id_idx" ON "student_classes"("class_id");
