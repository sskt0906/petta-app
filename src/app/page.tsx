import {redirect} from "next/navigation";
export default function RootPage() {
  redirect("/login");
  return null; // これは実際には表示されない
}