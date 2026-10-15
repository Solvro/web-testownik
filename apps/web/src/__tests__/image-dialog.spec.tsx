import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ImageDialog } from "@/components/quiz/editor/image/image-dialog";

afterEach(cleanup);

function renderDialog(image: { image?: string; imageUploadId?: string }) {
  render(
    <ImageDialog
      open
      onOpenChange={vi.fn()}
      image={image.image ?? null}
      imageUrl={
        image.imageUploadId === undefined ? (image.image ?? null) : null
      }
      imageUploadId={image.imageUploadId ?? null}
      onImageChange={vi.fn()}
      onUpload={vi.fn()}
    />,
  );
}

describe("Image dialog", () => {
  it("offers only uploading for a new image", () => {
    renderDialog({});
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("URL zdjęcia")).not.toBeInTheDocument();
  });

  it("offers only uploading for an uploaded image", () => {
    renderDialog({
      image: "https://cdn.example/upload.png",
      imageUploadId: "u1",
    });
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });

  it("keeps the URL tab for an image which already uses an external URL", () => {
    renderDialog({ image: "https://example.com/image.png" });
    expect(screen.getByRole("tab", { name: "Podaj URL" })).toBeInTheDocument();
    expect(screen.getByLabelText("URL zdjęcia")).toHaveValue(
      "https://example.com/image.png",
    );
  });
});
