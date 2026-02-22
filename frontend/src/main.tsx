/// <reference types="fbtee/ReactTypes.d.ts" />

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { createLocaleContext } from "fbtee";
import { AppRouter } from "./router";
import "./styles.css";

const availableLanguages = new Map([
  ["en_US", "English"],
  ["id_ID", "Bahasa Indonesia"],
]);

const loadLocale = async (_locale: string) => {
  return {};
};

const LocaleContext = createLocaleContext({
  availableLanguages,
  clientLocales: [navigator.language, ...navigator.languages],
  loadLocale,
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LocaleContext>
      <RouterProvider router={AppRouter} />
    </LocaleContext>
  </StrictMode>,
);
