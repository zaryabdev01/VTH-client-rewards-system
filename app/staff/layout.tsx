import { StoreProvider } from "@/lib/store";

/** Server-state store is only mounted for the staff area — the public spin page never loads staff data. */
export default function StaffRoot({ children }: { children: React.ReactNode }) {
  return <StoreProvider>{children}</StoreProvider>;
}
