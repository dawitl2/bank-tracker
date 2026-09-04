import { act, render, screen } from "@testing-library/react";
import useApolloViewport from "./useApolloViewport";

function Harness({ open }) {
  const ref = useApolloViewport(open);
  return open ? <div ref={ref} data-testid="overlay" /> : null;
}

describe("Apollo keyboard viewport", () => {
  const originalViewport = window.visualViewport;
  let viewport;

  beforeEach(() => {
    viewport = new EventTarget();
    viewport.height = 844;
    viewport.offsetTop = 0;
    Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
  });

  afterEach(() => {
    Object.defineProperty(window, "visualViewport", { configurable: true, value: originalViewport });
  });

  test("follows keyboard resize and pan, then removes listeners on close", () => {
    const remove = jest.spyOn(viewport, "removeEventListener");
    const { rerender } = render(<Harness open />);
    const overlay = screen.getByTestId("overlay");
    expect(overlay.style.getPropertyValue("--apollo-visible-height")).toBe("844px");
    act(() => {
      viewport.height = 390;
      viewport.dispatchEvent(new Event("resize"));
      viewport.offsetTop = 24;
      viewport.dispatchEvent(new Event("scroll"));
    });
    expect(overlay.style.getPropertyValue("--apollo-visible-height")).toBe("390px");
    expect(overlay.style.getPropertyValue("--apollo-visible-top")).toBe("24px");
    rerender(<Harness open={false} />);
    expect(remove).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(remove).toHaveBeenCalledWith("scroll", expect.any(Function));
    rerender(<Harness open />);
    expect(screen.getByTestId("overlay").style.getPropertyValue("--apollo-visible-height")).toBe("390px");
  });

  test("keeps CSS fallback available without the visual viewport API", () => {
    Object.defineProperty(window, "visualViewport", { configurable: true, value: undefined });
    render(<Harness open />);
    expect(screen.getByTestId("overlay").style.getPropertyValue("--apollo-visible-height")).toBe("");
  });
});
