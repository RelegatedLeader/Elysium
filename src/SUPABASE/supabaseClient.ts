import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://fbdryowkfbgdkwcokwvi.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiZHJ5b3drZmJnZGt3Y29rd3ZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxNjcwMDMsImV4cCI6MjA3MTc0MzAwM30.0-1qOyr5sRD5teraSCloEEO-wVZ-YPUtkmmBMdusZFI"; // Replace with your Supabase anon key from Settings > API

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
