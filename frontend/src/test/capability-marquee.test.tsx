import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
const motion = vi.hoisted(() => ({
  paused: vi.fn(),
  revert: vi.fn(),
  fromTo: vi.fn(),
}));
vi.mock("gsap", () => ({
  gsap: {
    fromTo: motion.fromTo,
    context: (callback: () => void) => {
      callback();
      return { revert: motion.revert };
    },
  },
}));
import { CapabilityMarquee } from "../components/landing/CapabilityMarquee";
beforeEach(() => {
  vi.clearAllMocks();
  motion.fromTo.mockReturnValue({ paused: motion.paused });
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});
it("loops left to right, offers persistent pause and reverts the tween on unmount", () => {
  const ui = render(<CapabilityMarquee />);
  expect(motion.fromTo).toHaveBeenCalledWith(
    expect.anything(),
    { xPercent: -50 },
    expect.objectContaining({ xPercent: 0, repeat: -1, ease: "none" }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Pause capability scrolling" }),
  );
  expect(motion.paused).toHaveBeenLastCalledWith(true);
  fireEvent.click(
    screen.getByRole("button", { name: "Resume capability scrolling" }),
  );
  expect(motion.paused).toHaveBeenLastCalledWith(false);
  expect(screen.getAllByRole("list")).toHaveLength(1);
  ui.unmount();
  expect(motion.revert).toHaveBeenCalled();
});
it("does not create a tween when reduced motion is requested", () => {
  vi.spyOn(window, "matchMedia").mockReturnValue({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as MediaQueryList);
  render(<CapabilityMarquee />);
  expect(motion.fromTo).not.toHaveBeenCalled();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(screen.getAllByRole("listitem")).toHaveLength(4);
});
