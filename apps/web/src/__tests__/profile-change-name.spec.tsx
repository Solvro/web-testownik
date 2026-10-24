import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ACCOUNT_TYPE } from "@testownik/core/user/types";
import type { UserData } from "@testownik/core/user/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProfileChangeNameForm } from "@/components/profile/profile-change-name-form";

const mocks = vi.hoisted(() => ({
  updateUserProfile: vi.fn(),
  refreshToken: vi.fn(),
  refresh: vi.fn(),
  toastError: vi.fn(),
  toastWarning: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
    warning: mocks.toastWarning,
    success: mocks.toastSuccess,
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock("@/services", () => ({
  getUserService: () => ({
    updateUserProfile: mocks.updateUserProfile,
    refreshToken: mocks.refreshToken,
  }),
}));

const emailProfile: UserData = {
  id: "user-1",
  full_name: "Anna Nowak",
  first_name: "Anna",
  last_name: "Nowak",
  photo: null,
  student_number: "123456",
  email: "anna@example.com",
  has_custom_photo: false,
  is_superuser: false,
  is_staff: false,
  hide_profile: false,
  account_type: ACCOUNT_TYPE.EMAIL,
  account_level: "basic",
};

const studentProfile: UserData = {
  ...emailProfile,
  account_type: ACCOUNT_TYPE.STUDENT,
};

const guestProfile: UserData = {
  ...emailProfile,
  account_type: ACCOUNT_TYPE.GUEST,
};

function setup(userData: UserData = emailProfile) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onClose = vi.fn();
  const user = userEvent.setup();
  const view = render(
    <QueryClientProvider client={client}>
      <ProfileChangeNameForm userData={userData} onClose={onClose} />
    </QueryClientProvider>,
  );
  return { client, onClose, user, ...view };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.refreshToken.mockResolvedValue(true);
});

afterEach(() => {
  cleanup();
});

describe("ProfileChangeNameForm", () => {
  describe("permissions and account types", () => {
    it("non-EMAIL account sees the info alert and no inputs", () => {
      setup(studentProfile);

      expect(
        screen.getByText("Imię i nazwisko pobierane z USOS"),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          /Twoje dane profilowe są automatycznie pobierane z systemu USOS/,
        ),
      ).toBeInTheDocument();
      expect(screen.queryByLabelText("Imię")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Nazwisko")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Zapisz" }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Zamknij" }),
      ).toBeInTheDocument();
    });

    it("guest account sees the guest error alert and no inputs", () => {
      setup(guestProfile);

      expect(
        screen.getByText("Funkcja niedostępna w trybie gościa"),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Zaloguj się na swoje konto, aby móc edytować profil/),
      ).toBeInTheDocument();
      expect(screen.queryByLabelText("Imię")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Nazwisko")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Zapisz" }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Zamknij" }),
      ).toBeInTheDocument();
    });

    it("EMAIL account sees input fields and action buttons", () => {
      setup(emailProfile);

      expect(screen.getByLabelText("Imię")).toHaveValue("Anna");
      expect(screen.getByLabelText("Nazwisko")).toHaveValue("Nowak");
      expect(
        screen.getByRole("button", { name: "Anuluj" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Zapisz" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByText("Imię i nazwisko pobierane z USOS"),
      ).not.toBeInTheDocument();
    });
  });

  describe("saving and form submission", () => {
    it("EMAIL account save calls PATCH user/ with trimmed first_name/last_name", async () => {
      mocks.updateUserProfile.mockResolvedValueOnce({
        ...emailProfile,
        first_name: "Jan",
        last_name: "Kowalski",
        full_name: "Jan Kowalski",
      });

      const { onClose, user } = setup(emailProfile);

      const firstNameInput = screen.getByLabelText("Imię");
      const lastNameInput = screen.getByLabelText("Nazwisko");

      await user.clear(firstNameInput);
      await user.type(firstNameInput, "  Jan  ");
      await user.clear(lastNameInput);
      await user.type(lastNameInput, "  Kowalski  ");

      const saveButton = screen.getByRole("button", { name: "Zapisz" });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mocks.updateUserProfile).toHaveBeenCalledWith({
          first_name: "Jan",
          last_name: "Kowalski",
        });
      });

      await waitFor(() => {
        expect(mocks.refreshToken).toHaveBeenCalled();
      });

      expect(mocks.refresh).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalledOnce();
      expect(mocks.toastSuccess).toHaveBeenCalledOnce();
      expect(mocks.toastWarning).not.toHaveBeenCalled();
    });

    it("Enter in a field submits", async () => {
      mocks.updateUserProfile.mockResolvedValueOnce({
        ...emailProfile,
        first_name: "Jan",
        last_name: "Nowak",
        full_name: "Jan Nowak",
      });

      const { onClose, user } = setup(emailProfile);

      const firstNameInput = screen.getByLabelText("Imię");
      await user.clear(firstNameInput);
      await user.type(firstNameInput, "  Jan{enter}");

      await waitFor(() => {
        expect(mocks.updateUserProfile).toHaveBeenCalledWith({
          first_name: "Jan",
          last_name: "Nowak",
        });
      });

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledOnce();
      });
    });

    it("mutation failure surfaces the inline error and keeps the dialog open", async () => {
      mocks.updateUserProfile.mockRejectedValueOnce(new Error("Network error"));

      const { onClose, user } = setup(emailProfile);

      const firstNameInput = screen.getByLabelText("Imię");
      await user.clear(firstNameInput);
      await user.type(firstNameInput, "Katarzyna");

      const saveButton = screen.getByRole("button", { name: "Zapisz" });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mocks.updateUserProfile).toHaveBeenCalledWith({
          first_name: "Katarzyna",
          last_name: "Nowak",
        });
      });

      const inlineError = await screen.findByRole("alert");
      expect(inlineError).toHaveTextContent(
        "Nie udało się zaktualizować nazwy profilu. Spróbuj ponownie.",
      );
      for (const label of ["Imię", "Nazwisko"]) {
        expect(screen.getByLabelText(label)).toHaveAttribute(
          "aria-invalid",
          "true",
        );
        expect(screen.getByLabelText(label)).toHaveAttribute(
          "aria-describedby",
          inlineError.id,
        );
      }

      // Dialog stays open: inputs and buttons remain available
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByLabelText("Imię")).toBeEnabled();
      expect(screen.getByRole("button", { name: "Zapisz" })).toBeEnabled();
      expect(mocks.toastError).not.toHaveBeenCalled();
      expect(mocks.toastWarning).not.toHaveBeenCalled();
      expect(mocks.toastSuccess).not.toHaveBeenCalled();
      await user.type(firstNameInput, "a");
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      for (const label of ["Imię", "Nazwisko"]) {
        expect(screen.getByLabelText(label)).toHaveAttribute(
          "aria-invalid",
          "false",
        );
        expect(screen.getByLabelText(label)).not.toHaveAttribute(
          "aria-describedby",
        );
      }
    });

    it.each(["false", "rejection"])(
      "shows only a warning when token refresh fails with %s",
      async (failure) => {
        mocks.updateUserProfile.mockResolvedValueOnce(emailProfile);
        if (failure === "false") {
          mocks.refreshToken.mockResolvedValueOnce(false);
        } else {
          mocks.refreshToken.mockRejectedValueOnce(new Error("Network error"));
        }

        const { onClose, user } = setup();
        await user.type(screen.getByLabelText("Imię"), "a");
        await user.click(screen.getByRole("button", { name: "Zapisz" }));

        await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
        expect(mocks.refresh).toHaveBeenCalledOnce();
        expect(mocks.toastWarning).toHaveBeenCalledExactlyOnceWith(
          "Nazwę zapisano. Może minąć chwila, zanim zaktualizuje się w menu.",
        );
        expect(mocks.toastSuccess).not.toHaveBeenCalled();
        expect(mocks.toastError).not.toHaveBeenCalled();
      },
    );

    it("resets changes when clicking Resetuj", async () => {
      const { user } = setup(emailProfile);

      const firstNameInput = screen.getByLabelText("Imię");
      await user.clear(firstNameInput);
      await user.type(firstNameInput, "Zmienione");

      const resetButton = screen.getByRole("button", { name: "Resetuj" });
      await user.click(resetButton);

      expect(firstNameInput).toHaveValue("Anna");
      expect(
        screen.queryByRole("button", { name: "Resetuj" }),
      ).not.toBeInTheDocument();
    });
  });
});
