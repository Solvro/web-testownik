"use client";

import formbricks from "@formbricks/js";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export function FormbricksProvider() {
  const pathname = usePathname();
  const searchParameters = useSearchParams();

  useEffect(() => {
    void formbricks.setup({
      environmentId: "cmkylmmsh0009s4017ostyze7",
      appUrl: "https://formbricks.b.solvro.pl",
    });
  }, []);

  useEffect(() => {
    void formbricks.registerRouteChange();
  }, [pathname, searchParameters]);

  return null;
}
