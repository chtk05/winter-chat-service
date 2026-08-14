import { redirect } from "next/navigation";

/**
 * The console's entry point is the inbox. D-008 puts route protection in
 * middleware, which is backend/foundation scope — this redirect is routing only.
 */
export default function Home() {
  redirect("/inbox");
}
