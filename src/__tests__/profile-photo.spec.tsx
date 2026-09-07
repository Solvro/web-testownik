import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProfilePhotoDialog } from "@/components/profile/profile-photo-dialog";
import { userProfileQueryKey } from "@/hooks/use-user-profile";
import { UserService } from "@/services/user.service";
import type { UserData } from "@/types/user";

const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
  remove: vi.fn(),
  refreshToken: vi.fn(),
  refresh: vi.fn(),
  revokePreview: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("@/services", () => ({
  getUserService: () => ({
    uploadProfilePhoto: mocks.upload,
    deleteProfilePhoto: mocks.remove,
    refreshToken: mocks.refreshToken,
  }),
}));

const profile: UserData = {
  id: "user-1",
  full_name: "Anna Nowak",
  photo: null,
  student_number: "123",
  email: "anna@example.com",
  has_custom_photo: false,
  is_superuser: false,
  is_staff: false,
  hide_profile: false,
  account_type: "email",
  account_level: "basic",
};

const goldProfile: UserData = { ...profile, account_level: "gold" };

function setup(userData: UserData = goldProfile) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onClose = vi.fn();
  const view = render(
    <QueryClientProvider client={client}>
      <ProfilePhotoDialog userData={userData} onClose={onClose} />
    </QueryClientProvider>,
  );
  return { client, onClose, ...view };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.refreshToken.mockResolvedValue(true);
  URL.createObjectURL = vi.fn(() => "blob:photo-preview");
  URL.revokeObjectURL = mocks.revokePreview;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("profile photo editor", () => {
  it.each(["basic", "silver"] as const)(
    "lets %s users pick a predefined avatar but not upload a file",
    async (accountLevel) => {
      const fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: vi
          .fn()
          .mockResolvedValue(new Blob(["preset-image"], { type: "image/png" })),
      });
      vi.stubGlobal("fetch", fetch);
      mocks.upload.mockResolvedValue({ ...profile, has_custom_photo: true });
      const { onClose } = setup({ ...profile, account_level: accountLevel });
      expect(screen.queryByLabelText("Wybierz plik")).not.toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: /^Awatar / })).toHaveLength(
        8,
      );
      await userEvent.click(screen.getByRole("button", { name: "Awatar 2" }));
      expect(screen.getByRole("button", { name: "Awatar 2" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await userEvent.click(
        screen.getByRole("button", { name: "Zapisz zdjęcie" }),
      );
      await waitFor(() => {
        expect(onClose).toHaveBeenCalledOnce();
      });
      expect(fetch).toHaveBeenCalledWith(
        "https://api.dicebear.com/9.x/adventurer/png?seed=Anna+Nowak+2",
      );
      const uploaded = mocks.upload.mock.calls[0][0] as File;
      expect(uploaded).toBeInstanceOf(File);
      expect(uploaded.name).toBe("avatar.png");
      expect(uploaded.type).toBe("image/png");
      expect(uploaded.size).toBe(12);
    },
  );

  it("keeps a failed preset selection available for retry without uploading a URL", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const { onClose } = setup(profile);
    await userEvent.click(screen.getByRole("button", { name: "Awatar 1" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Zapisz zdjęcie" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Nie udało się zapisać",
    );
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Awatar 1" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByRole("button", { name: "Zapisz zdjęcie" }),
    ).toBeEnabled();
  });

  it("lets Gold users switch between a preset and the same personal file", async () => {
    setup();
    const user = userEvent.setup();
    const file = new File(["photo"], "photo.png", { type: "image/png" });
    await user.upload(screen.getByLabelText("Wybierz plik"), file);
    await user.click(screen.getByRole("button", { name: "Awatar 1" }));
    expect(mocks.revokePreview).toHaveBeenCalledWith("blob:photo-preview");
    await user.upload(screen.getByLabelText("Wybierz plik"), file);
    expect(screen.getByRole("button", { name: "Awatar 1" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    mocks.upload.mockResolvedValue(profile);
    await user.click(screen.getByRole("button", { name: "Zapisz zdjęcie" }));
    await waitFor(() => {
      expect(mocks.upload).toHaveBeenCalledWith(file);
    });
  });

  it("uploads a file, updates the profile cache, refreshes the avatar and releases the preview", async () => {
    const updated = {
      ...profile,
      photo: "https://test.local/media/photo.avif",
      has_custom_photo: true,
    };
    mocks.upload.mockResolvedValue(updated);
    const { client, onClose, unmount } = setup();
    const user = userEvent.setup();
    const file = new File(["photo"], "photo.png", { type: "image/png" });
    await user.upload(screen.getByLabelText("Wybierz plik"), file);
    await user.click(screen.getByRole("button", { name: "Zapisz zdjęcie" }));
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledOnce();
    });
    expect(mocks.upload).toHaveBeenCalledWith(file);
    expect(client.getQueryData(userProfileQueryKey)).toEqual(updated);
    expect(mocks.refreshToken).toHaveBeenCalledOnce();
    expect(mocks.refresh).toHaveBeenCalledOnce();
    unmount();
    expect(mocks.revokePreview).toHaveBeenCalledWith("blob:photo-preview");
  });

  it("restores the account photo and updates has_custom_photo", async () => {
    mocks.remove.mockResolvedValue(profile);
    const { client, onClose } = setup({ ...profile, has_custom_photo: true });
    await userEvent.click(
      screen.getByRole("button", { name: "Przywróć domyślne zdjęcie" }),
    );
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledOnce();
    });
    expect(mocks.remove).toHaveBeenCalledOnce();
    expect(client.getQueryData(userProfileQueryKey)).toEqual(profile);
  });

  it("keeps the selected file and dialog open when the upload fails", async () => {
    mocks.upload.mockRejectedValue(new Error("offline"));
    const { onClose } = setup();
    await userEvent.upload(
      screen.getByLabelText("Wybierz plik"),
      new File(["photo"], "photo.png", { type: "image/png" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Zapisz zdjęcie" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Nie udało się zapisać",
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Zapisz zdjęcie" }),
    ).toBeEnabled();
    expect(mocks.refreshToken).not.toHaveBeenCalled();
  });

  it("rejects SVG and oversized files before sending a request", () => {
    setup();
    const input = screen.getByLabelText("Wybierz plik");
    for (const file of [
      new File(["svg"], "avatar.svg", { type: "image/svg+xml" }),
      new File([new Uint8Array(10 * 1024 * 1024 + 1)], "large.png", {
        type: "image/png",
      }),
    ]) {
      fireEvent.change(input, { target: { files: [file] } });
      expect(screen.getByRole("alert")).toHaveTextContent("do 10 MB");
      expect(
        screen.getByRole("button", { name: "Zapisz zdjęcie" }),
      ).toBeDisabled();
    }
    expect(mocks.upload).not.toHaveBeenCalled();
  });
});

it("sends multipart photo content without forcing a JSON Content-Type and uses DELETE to reset", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(Response.json(profile, { status: 200 }));
  vi.stubGlobal("fetch", fetch);
  const service = new UserService("http://test.local/api/");
  const file = new File(["photo"], "photo.png", { type: "image/png" });
  await service.uploadProfilePhoto(file);
  const [url, options] = fetch.mock.calls[0] as [string, RequestInit];
  expect(url).toBe("http://test.local/api/user/photo/");
  expect(options.method).toBe("POST");
  expect((options.body as FormData).get("photo")).toBe(file);
  expect(new Headers(options.headers).has("Content-Type")).toBe(false);
  fetch.mockResolvedValue(Response.json(profile, { status: 200 }));
  await service.deleteProfilePhoto();
  expect(fetch).toHaveBeenLastCalledWith(
    url,
    expect.objectContaining({ method: "DELETE" }),
  );
});
