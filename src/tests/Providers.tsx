import axios from "axios";
import { PropsWithChildren } from "react";
import { MemoryRouter } from "react-router";
import AppContext from "../AppContext";
import { AppTheme } from "../Theme";

interface ProvidersProps extends PropsWithChildren {
  guest?: boolean;
}

export const Providers = ({ children, guest = false }: ProvidersProps) => {
  const ctx = {
    isGuest: guest,
    isAuthenticated: !guest,
    theme: new AppTheme(),
    axiosInstance: guest ? undefined : axios.create({ baseURL: "/" }),
  };

  return (
    <AppContext.Provider value={ctx as never}>
      <MemoryRouter>{children}</MemoryRouter>
    </AppContext.Provider>
  );
};
