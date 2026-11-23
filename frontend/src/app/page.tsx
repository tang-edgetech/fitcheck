import type { Metadata } from "next";
import Tester from "@/components/tester/Tester";

export const metadata: Metadata = {
  title: "Responsive tester",
};

export default function Home() {
  return <Tester />;
}
