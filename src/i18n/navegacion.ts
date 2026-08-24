import { createNavigation } from "next-intl/navigation";
import { routing } from "./rutas";

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
