CREATE TABLE "digest_recipients" (
  "id" SERIAL PRIMARY KEY,
  "school_id" INTEGER NOT NULL,
  "email" VARCHAR(255) NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "digest_recipients_school_id_email_key" UNIQUE ("school_id", "email"),
  CONSTRAINT "digest_recipients_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id")
);
